import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import * as XLSX from 'xlsx'

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { readImportSheets, prepareImport, detectColumns, googleSheetCsvUrl, loadGoogleSheet, IMPORT_MAX_BYTES } = await server.ssrLoadModule('/src/lib/vault-import.ts')
  const { cleanVaultData, visibleVaultFields, vaultDefaults } = await server.ssrLoadModule('/src/lib/vault-fields.ts')
  const { VaultItemCard } = await server.ssrLoadModule('/src/components/vault/VaultItemCard.tsx')
  const csv = '\uFEFFname,url,username,password,notes\r\nGmail,https://mail.google.com,fixture@example.invalid,"  pass,word  ","line one\nline two"\r\n'
  const [sheet] = await readImportSheets(csv)
  const result = prepareImport(sheet, detectColumns(sheet.headers))
  assert.equal(result.errors.length, 0)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].category, 'password')
  assert.equal(result.items[0].data.password, '  pass,word  ')
  assert.equal(result.items[0].data.notes, 'line one\nline two')
  assert.equal(result.items[0].title, 'Gmail')
  assert.ok(!('account_type' in result.items[0].data))

  const bankSheet = (await readImportSheets('title,account no,ifsc\nPersonal,001234567890,TEST0000123'))[0]
  assert.equal(prepareImport(bankSheet, detectColumns(bankSheet.headers)).items[0].data.account_number, '001234567890')
  const duplicate = prepareImport(sheet, ['username', 'username', '', '', ''])
  assert.equal(duplicate.items.length, 0)
  assert.ok(duplicate.errors[0].includes('only once'))
  assert.ok(prepareImport(sheet, sheet.headers.map(() => '')).errors.length)
  assert.deepEqual(detectColumns(['constructor', '__proto__']), ['', ''])
  const emptyPasswordSheet = { name: 'Empty', headers: ['name', 'password'], rows: [['Fixture', '']] }
  assert.ok(prepareImport(emptyPasswordSheet, ['title', 'password'], 'password').errors.length)
  const mixed = { name: 'Mixed', headers: ['title', 'type', 'username', 'password', 'account_number'], rows: [
    ['Login', 'Logins', 'fixture', 'private', ''], ['Account', 'bank', '', '', '0012'],
  ] }
  assert.deepEqual(prepareImport(mixed, detectColumns(mixed.headers)).items.map(item => item.category), ['password', 'bank'])

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([['title', 'account number'], ['Account', 123]])
  worksheet.B2.z = '000000'
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bank')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['name', 'username', 'password'], ['Service', 'fixture', 'secret']]), 'Logins')
  const binary = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const tabs = await readImportSheets(binary)
  assert.equal(tabs.length, 2)
  assert.equal(tabs[0].rows[0][1], '000123')
  assert.equal(prepareImport(tabs[1], detectColumns(tabs[1].headers)).items[0].category, 'password')
  await assert.rejects(readImportSheets(new ArrayBuffer(IMPORT_MAX_BYTES + 1)), /5 MB/)
  await assert.rejects(readImportSheets('title,password\n' + 'Fixture,secret\n'.repeat(1001)), /1,000/)
  await assert.rejects(readImportSheets('<!doctype html><html>Login required</html>'), /sign-in page/)

  assert.equal(new URL(googleSheetCsvUrl('https://docs.google.com/spreadsheets/d/fixtureId/edit#gid=42')).searchParams.get('gid'), '42')
  assert.ok(googleSheetCsvUrl('https://docs.google.com/spreadsheets/d/e/fixturePublished/pubhtml?gid=3').includes('/d/e/fixturePublished/pub?'))
  for (const bad of ['http://docs.google.com/spreadsheets/d/fixture/edit', 'https://docs.google.com.evil.invalid/spreadsheets/d/fixture', 'https://evil.invalid/', 'https://docs.google.com/spreadsheets/d/fixture/edit#gid=bad']) {
    assert.throws(() => googleSheetCsvUrl(bad))
  }
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (url, options) => { assert.equal(options.credentials, 'omit'); return new Response('name,username,password\nFixture,user,secret', { headers: { 'content-type': 'text/csv' } }) }
    assert.equal((await loadGoogleSheet('https://docs.google.com/spreadsheets/d/fixture/edit'))[0].rows.length, 1)
    globalThis.fetch = async () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } })
    await assert.rejects(loadGoogleSheet('https://docs.google.com/spreadsheets/d/fixture/edit'), /not available/)
  } finally { globalThis.fetch = originalFetch }

  const polluted = { whose: 'Me', account_type: 'Savings', id_type: 'Aadhaar Card', card_network: 'Visa', username: 'fixture', password: 'private-password', service: 'Gmail' }
  const cleaned = cleanVaultData('password', polluted)
  assert.ok(!('account_type' in cleaned) && !('id_type' in cleaned) && !('card_network' in cleaned))
  assert.equal(visibleVaultFields('password', polluted)[0][0], 'username')
  assert.deepEqual(vaultDefaults('password'), {})
  const card = renderToStaticMarkup(React.createElement(VaultItemCard, { item: { id: 1, title: 'Gmail', category: 'password', data: polluted, created_at: '2026-11-04', updated_at: '2026-11-04' }, onEdit() {}, onDelete() {} }))
  assert.ok(card.includes('Logins'))
  assert.ok(card.includes('Username'))
  assert.ok(!card.includes('Savings') && !card.includes('Aadhaar') && !card.includes('Visa'))
  assert.ok(!card.includes('private-password'))

  // Verify parsed secrets survive the existing encryption flow and never appear in ciphertext.
  globalThis.window = { crypto: globalThis.crypto }
  const { encrypt, decrypt } = await server.ssrLoadModule('/src/lib/vaultCrypto.ts')
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const encrypted = await encrypt(key, JSON.stringify(result.items[0].data))
  assert.ok(!encrypted.ciphertext.includes('pass,word'))
  assert.equal(JSON.parse(await decrypt(key, encrypted.ciphertext, encrypted.iv)).password, '  pass,word  ')
  const { saveVaultImport } = await server.ssrLoadModule('/src/lib/vault-import-save.ts')
  globalThis.document = { cookie: '' }
  const batch = Array.from({ length: 8 }, (_, index) => ({ ...result.items[0], row: index + 2, title: `Fixture ${index}` }))
  let running = 0, peak = 0, calls = 0
  const successful = new Set()
  const initialFetch = globalThis.fetch
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body)
      assert.deepEqual(Object.keys(payload).sort(), ['category', 'ciphertext', 'iv', 'title'])
      assert.ok(!options.body.includes('pass,word'))
      assert.equal(JSON.parse(await decrypt(key, payload.ciphertext, payload.iv)).username, 'fixture@example.invalid')
      calls++; running++; peak = Math.max(peak, running)
      const failure = calls === 2
      await new Promise(resolve => setTimeout(resolve, failure ? 0 : 5))
      running--
      if (failure) return Response.json({ ok: false, error: 'Fixture failure' }, { status: 503 })
      return Response.json({ ok: true })
    }
    const firstPass = await saveVaultImport({ items: batch, key, touch() {}, canContinue: () => true, onSaved: item => successful.add(item.row) })
    assert.equal(firstPass.error, 'Fixture failure')
    assert.ok(firstPass.saved > 0 && firstPass.saved < batch.length)
    assert.ok(peak <= 3)
    globalThis.fetch = async () => Response.json({ ok: true })
    const retry = await saveVaultImport({ items: batch.filter(item => !successful.has(item.row)), key, touch() {}, canContinue: () => true,
      onSaved: item => { assert.ok(!successful.has(item.row)); successful.add(item.row) } })
    assert.equal(retry.saved + firstPass.saved, 8)
    assert.equal(successful.size, 8)
    const locked = await saveVaultImport({ items: batch, key, touch() { throw new Error('Must not run when locked') }, canContinue: () => false, onSaved() { assert.fail('Saved while locked') } })
    assert.equal(locked.saved, 0)
  } finally { globalThis.fetch = initialFetch }
  console.log('PASS: CSV quoting, multiline values, leading zeros, XLSX tabs, category detection, mapping validation, bounded imports, Sheets URL validation, private-sheet errors, legacy login cleanup, masking, and encryption round trip.')
} finally { await server.close() }
