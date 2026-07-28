import type { RandomSource } from './type'

const splitWords = (value: string) =>
  value
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .match(/[A-Za-z\d]+/g) ?? []

export function capitalize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

export function camelCase(value: string) {
  const words = splitWords(value).map((word) => word.toLowerCase())

  return words.map((word, index) => (index === 0 ? word : capitalize(word))).join('')
}

export function pascalCase(value: string) {
  return splitWords(value)
    .map((word) => capitalize(word.toLowerCase()))
    .join('')
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

export function truncate(value: string, length: number, omission = '…') {
  const characters = Array.from(value)

  if (characters.length <= length) return value
  if (length <= 0) return ''

  const omissionCharacters = Array.from(omission)

  if (omissionCharacters.length >= length) {
    return omissionCharacters.slice(0, length).join('')
  }

  return `${characters.slice(0, length - omissionCharacters.length).join('')}${omission}`
}

const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character])
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mask(value: string, visibleStart = 0, visibleEnd = 4, maskCharacter = '*') {
  const characters = Array.from(value)
  const start = Math.max(0, visibleStart)
  const end = Math.max(0, visibleEnd)

  if (start + end >= characters.length) return value

  return `${characters.slice(0, start).join('')}${maskCharacter.repeat(characters.length - start - end)}${end ? characters.slice(-end).join('') : ''}`
}

const defaultRandomAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function randomString(length: number, alphabet = defaultRandomAlphabet, random: RandomSource = Math.random) {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError('length must be a non-negative integer')
  }

  if (!alphabet.length && length > 0) {
    throw new Error('alphabet must not be empty')
  }

  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
}
