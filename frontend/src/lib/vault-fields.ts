import type { VaultCategory } from './api'

export const VAULT_FIELDS: Record<VaultCategory, string[]> = {
  bank: ['bank', 'account_holder', 'account_number', 'account_type', 'ifsc', 'branch', 'upi_id', 'whose'],
  card: ['cardholder', 'card_number', 'expiry', 'cvv', 'pin', 'card_network', 'card_type', 'bank'],
  id: ['id_type', 'id_number', 'full_name', 'dob', 'expiry_date', 'address'],
  upi: ['upi_id', 'upi_provider', 'beneficiary', 'linked_bank', 'upi_pin'],
  password: ['username', 'password', 'url', 'service'],
  note: ['note_title', 'content'],
}
const CATEGORY_KEYS = new Set(Object.values(VAULT_FIELDS).flat())
const DEFAULTS: Record<VaultCategory, Record<string, string>> = {
  bank: { whose: 'Me', account_type: 'Savings' },
  card: { card_network: 'Visa', card_type: 'Credit' },
  id: { id_type: 'Aadhaar Card' },
  upi: { upi_provider: 'GPay' },
  password: {}, note: {},
}

export function vaultDefaults(category: VaultCategory) { return { ...DEFAULTS[category] } }

export function cleanVaultData(category: VaultCategory, data: Record<string, unknown>): Record<string, string> {
  const allowed = new Set(VAULT_FIELDS[category])
  return Object.fromEntries(Object.entries(data).filter(([key]) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && (!CATEGORY_KEYS.has(key) || allowed.has(key))
  ).map(([key, value]) => [key, String(value ?? '')]))
}

export function visibleVaultFields(category: VaultCategory, data: Record<string, unknown>) {
  const clean = cleanVaultData(category, data)
  const keys = [...VAULT_FIELDS[category], ...Object.keys(clean)]
  return [...new Set(keys)].filter(key => !key.startsWith('file_') && key !== 'custom_title' && clean[key]?.trim())
    .map(key => [key, clean[key]] as const)
}
