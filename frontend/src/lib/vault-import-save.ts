import { postVaultItemAdd } from './api'
import { encrypt } from './vaultCrypto'
import type { ImportItem } from './vault-import'

/** Bound network concurrency and stop future writes as soon as the vault locks. */
export async function saveVaultImport({ items, key, canContinue, touch, onSaved }: {
  items: ImportItem[]
  key: CryptoKey
  canContinue: () => boolean
  touch: () => void
  onSaved: (item: ImportItem) => void
}) {
  let position = 0, saved = 0, error = ''
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (!error && canContinue() && position < items.length) {
      const item = items[position++]
      try {
        touch()
        const sealed = await encrypt(key, JSON.stringify(item.data))
        if (error || !canContinue()) return
        await postVaultItemAdd({ title: item.title, category: item.category, ...sealed })
        saved++
        onSaved(item)
      } catch (failure) { error = failure instanceof Error ? failure.message : 'Could not save this row.' }
    }
  }))
  return { saved, error }
}
