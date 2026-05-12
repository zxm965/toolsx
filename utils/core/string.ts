const splitWords = (value: string) =>
  value
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .match(/[A-Za-z\d]+/g) ?? []

export function capitalize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

export function camelCase(value: string) {
  const words = splitWords(value.toLowerCase())

  return words.map((word, index) => (index === 0 ? word : capitalize(word))).join('')
}

export function kebabCase(value: string) {
  return splitWords(value)
    .map((word) => word.toLowerCase())
    .join('-')
}

export function snakeCase(value: string) {
  return splitWords(value)
    .map((word) => word.toLowerCase())
    .join('_')
}

export function trim(value: string, chars?: string) {
  if (!chars) {
    return value.trim()
  }

  const pattern = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return value.replace(new RegExp(`^[${pattern}]+|[${pattern}]+$`, 'g'), '')
}
