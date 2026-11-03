import { useAuthStore } from '@/store/auth'

const profileKey = (field: string) => `context:profile:${useAuthStore.getState().user?.id || 'guest'}:${field}`

function emit() {
  window.dispatchEvent(new Event('context:profile-changed'))
}

export function getUserName(): string {
  try {
    return (localStorage.getItem(profileKey('name')) ?? useAuthStore.getState().user?.name ?? '').trim()
  } catch {
    return ''
  }
}

export function setUserName(name: string) {
  try {
    const trimmed = name.trim()
    if (trimmed) localStorage.setItem(profileKey('name'), trimmed)
    else localStorage.removeItem(profileKey('name'))
  } catch {
    // ignore
  }
  emit()
}

export function getUserAvatar(): string | null {
  try {
    return localStorage.getItem(profileKey('avatar')) ?? useAuthStore.getState().user?.avatar ?? null
  } catch {
    return null
  }
}

export function setUserAvatar(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(profileKey('avatar'), dataUrl)
    else localStorage.removeItem(profileKey('avatar'))
  } catch {
    // storage may be full; ignore rather than break the app
  }
  emit()
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Downscale + compress an uploaded avatar so localStorage stays small. */
export function readAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Pick an image file'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Could not read that image'))
      image.onload = () => {
        const size = 160
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Canvas unavailable'))
          return
        }
        const scale = Math.max(size / image.width, size / image.height)
        const width = image.width * scale
        const height = image.height * scale
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
