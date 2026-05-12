export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function randomInt(min: number, max: number) {
  const lower = Math.ceil(min)
  const upper = Math.floor(max)

  return Math.floor(Math.random() * (upper - lower + 1)) + lower
}
