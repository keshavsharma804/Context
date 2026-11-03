const NAME_KEY = 'context:user-name'
const AVATAR_KEY = 'context:avatar'

function emit() {
  window.dispatchEvent(new Event('context:profile-changed'))
}

export function getUserName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

export function setUserName(name: string) {
  try {
    const trimmed = name.trim()
    if (trimmed) localStorage.setItem(NAME_KEY, trimmed)
    else localStorage.removeItem(NAME_KEY)
  } catch {
    // ignore
  }
  emit()
}

export function getUserAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY)
  } catch {
    return null
  }
}

export function setUserAvatar(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl)
    else localStorage.removeItem(AVATAR_KEY)
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
