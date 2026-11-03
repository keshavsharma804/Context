import type { VaultCategory } from './api'
import { cleanVaultData } from './vault-fields'

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const IMPORT_MAX_ROWS = 1000
export type ImportSheet = { name: string; headers: string[]; rows: string[][]; headerRow?: number; sourceRows?: string[][]; sourceStartRow?: number }
export type ImportItem = { row: number; title: string; category: VaultCategory; data: Record<string, string> }
export const IMPORT_FIELDS = ['title', 'category', 'service', 'username', 'password', 'url', 'phone', 'authenticator', 'two_step_verification', 'notes', 'whose',
  'bank', 'account_holder', 'account_number', 'account_type', 'ifsc', 'branch', 'cardholder', 'card_number',
  'expiry', 'cvv', 'pin', 'card_network', 'card_type', 'id_type', 'id_number', 'full_name', 'dob',
  'expiry_date', 'address', 'upi_id', 'upi_provider', 'beneficiary', 'linked_bank', 'upi_pin', 'content']

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const aliases: Record<string, string> = Object.create(null)
for (const field of IMPORT_FIELDS) aliases[normalize(field)] = field
for (const [target, names] of Object.entries({
  title: ['name', 'item name', 'label', 'title'], category: ['type', 'item type', 'category'],
  username: ['email', 'email address', 'user', 'login', 'login username', 'login_username'],
  password: ['pass', 'pwd', 'login password', 'login_password'], url: ['website', 'website url', 'login uri', 'login_uri', 'site link', 'website link', 'link'],
  phone: ['phone no', 'phone number', 'mobile', 'mobile number', 'contact number'],
  authenticator: ['authenicator', 'authenticator app', 'authenticator secret', 'totp secret'],
  two_step_verification: ['two factor authentication', '2fa', 'two step', '2 step verification'],
  service: ['app', 'service name', 'site'], notes: ['note', 'comments', 'extra'],
  account_number: ['account no', 'account num', 'a/c no'], account_holder: ['holder', 'account holder name'],
  card_number: ['card no'], expiry: ['expiration', 'expiry month year'], id_number: ['document number', 'aadhaar number', 'passport number'],
  upi_id: ['vpa', 'upi', 'upi address'],
})) for (const name of names) aliases[normalize(name)] = target

export function detectColumns(headers: string[]) { return headers.map(header => aliases[normalize(header)] || '') }

export function selectImportHeader(sheet: ImportSheet, headerRow: number): ImportSheet {
  const source = sheet.sourceRows
  const start = sheet.sourceStartRow || 1
  if (!source || headerRow < start || headerRow >= start + source.length) throw new Error('Choose a header row within the sheet.')
  const index = headerRow - start
  const width = Math.max(...source.map(row => row.length))
  const headers = Array.from({ length: width }, (_, column) => String(source[index][column] ?? '').replace(/^\uFEFF/, '').trim() || `Column ${column + 1}`)
  const rows = source.slice(index + 1).map(row => headers.map((_, column) => String(row[column] ?? '')))
  if (rows.filter(row => row.some(cell => cell.trim())).length > IMPORT_MAX_ROWS) throw new Error('Use at most 1,000 data rows per tab.')
  return { ...sheet, headerRow, headers, rows }
}

function findHeaderRow(rows: string[][]) {
  let first = rows.findIndex(row => row.some(cell => cell.trim()))
  if (first < 0) return -1
  let best = first, score = 1
  rows.slice(0, 25).forEach((row, index) => {
    const matched = new Set(detectColumns(row).filter(Boolean)).size
    if (matched > score) { score = matched; best = index }
  })
  return best
}

export function googleSheetCsvUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Enter a valid Google Sheets URL.') }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Use an HTTPS docs.google.com spreadsheet URL.')
  }
  const published = url.pathname.match(/^\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)\/pub(?:html)?\/?$/)
  const regular = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)(?:\/|$)/)
  if (!published && !regular) throw new Error('This URL does not identify a Google spreadsheet.')
  const gid = new URLSearchParams(url.hash.slice(1)).get('gid') || url.searchParams.get('gid')
  if (gid && !/^\d+$/.test(gid)) throw new Error('The sheet tab ID is invalid.')
  const output = new URL(published
    ? `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv`
    : `https://docs.google.com/spreadsheets/d/${regular![1]}/export?format=csv`)
  if (gid) output.searchParams.set('gid', gid)
  return output.toString()
}

export async function readImportSheets(input: ArrayBuffer | string): Promise<ImportSheet[]> {
  if ((typeof input === 'string' ? new TextEncoder().encode(input).length : input.byteLength) > IMPORT_MAX_BYTES) throw new Error('Use a spreadsheet smaller than 5 MB.')
  if (typeof input === 'string' && /^\s*(?:<!doctype|<html)/i.test(input)) throw new Error('Google returned a sign-in page. Download the sheet as XLSX or CSV and upload it instead.')
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(input, { type: typeof input === 'string' ? 'string' : 'array',
    raw: true, cellFormula: false, cellHTML: false, sheetRows: IMPORT_MAX_ROWS + 27 })
  if (workbook.SheetNames.length > 30) throw new Error('Use a workbook with 30 tabs or fewer.')
  const sheets: ImportSheet[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'])
    if (range.e.r - range.s.r > IMPORT_MAX_ROWS + 25 || range.e.c - range.s.c >= 100) throw new Error('Use at most 1,000 data rows, 25 introductory rows, and 100 columns per tab.')
    const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true })
    const sourceRows = grid.map(row => row.map(cell => String(cell ?? '')))
    const header = findHeaderRow(sourceRows)
    if (header < 0 || header >= sourceRows.length - 1) continue
    const sourceStartRow = range.s.r + 1
    sheets.push(selectImportHeader({ name, headers: [], rows: [], sourceRows, sourceStartRow }, sourceStartRow + header))
  }
  if (!sheets.length) throw new Error('No data rows found. Add column names above your data.')
  return sheets
}

export async function loadGoogleSheet(value: string, signal?: AbortSignal) {
  const csvUrl = googleSheetCsvUrl(value)
  let response: Response
  try { response = await fetch(csvUrl, { credentials: 'omit', referrerPolicy: 'no-referrer', signal }) }
  catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Google could not provide this sheet. For private sheets, download XLSX or CSV and upload it. Keep sheets with passwords private.')
  }
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('This sheet is not available for URL import. Download it as XLSX or CSV and upload it instead.')
  if (Number(response.headers.get('content-length')) > IMPORT_MAX_BYTES) throw new Error('Use a spreadsheet smaller than 5 MB.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Could not read this sheet. Download it and upload the file instead.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      size += chunk.byteLength
      if (size > IMPORT_MAX_BYTES) { await reader.cancel(); throw new Error('Use a spreadsheet smaller than 5 MB.') }
      chunks.push(chunk)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return readImportSheets(new TextDecoder().decode(bytes))
}

const categories: Record<string, VaultCategory> = {
  bank: 'bank', bankaccount: 'bank', card: 'card', paymentcard: 'card', creditcard: 'card', debitcard: 'card',
  id: 'id', governmentid: 'id', govtid: 'id', document: 'id', password: 'password', passwords: 'password',
  login: 'password', logins: 'password', credentials: 'password', upi: 'upi', note: 'note', notes: 'note', securenote: 'note',
}

export function prepareImport(sheet: ImportSheet, mapping: string[], selected: VaultCategory | 'auto' = 'auto') {
  const mapped = mapping.filter(Boolean)
  if (new Set(mapped).size !== mapped.length) return { items: [], errors: ['Map each destination field only once.'] }
  const items: ImportItem[] = [], errors: string[] = []
  sheet.rows.forEach((row, index) => {
    const rowNumber = (sheet.headerRow || 1) + index + 1
    if (row.every(cell => !cell.trim())) return
    const data = Object.fromEntries(mapping.flatMap((field, column) => field ? [[field, row[column] ?? '']] : []))
    const categoryName = normalize(data.category || '')
    const explicitCategory = Object.hasOwn(categories, categoryName) ? categories[categoryName] : undefined
    const category = selected !== 'auto' ? selected : explicitCategory || (
      data.account_number ? 'bank' : data.card_number ? 'card' : data.id_number ? 'id' : data.upi_id ? 'upi' :
      data.username || data.password ? 'password' : data.content ? 'note' : undefined)
    if (!category) { errors.push(`Row ${rowNumber}: choose a category or map identifying fields.`); return }
    const title = (data.title || data.service || data.url || data.bank || data.note_title || data.id_type || data.upi_id || '').trim()
    const hasIdentifier = category === 'password' ? data.username || data.password : category === 'bank' ? data.account_number :
      category === 'card' ? data.card_number : category === 'id' ? data.id_number : category === 'upi' ? data.upi_id : data.content
    if (!title || !hasIdentifier?.trim()) { errors.push(`Row ${rowNumber}: add a title and the identifying fields for this category.`); return }
    delete data.title; delete data.category
    items.push({ row: rowNumber, title, category, data: cleanVaultData(category, data) })
  })
  if (!mapped.length) errors.unshift('Map at least one column.')
  return { items, errors }
}
