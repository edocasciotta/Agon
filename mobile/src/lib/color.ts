// Shared color math for deriving theme shades from a studio's chosen brand color.
// Mirrors the darken()/lighten() helpers in frontend/src/renderer/src/App.tsx so
// mobile and desktop produce visually consistent shades from the same hex input.

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value)
}

export function darken(hex: string, amount = 0.12): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return rgbToHex(
    Math.round(r * (1 - amount)),
    Math.round(g * (1 - amount)),
    Math.round(b * (1 - amount))
  )
}

export function lighten(hex: string, amount = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return rgbToHex(
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount)
  )
}

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, n))
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp8(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
