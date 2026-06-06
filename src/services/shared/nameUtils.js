export function stripParenthetical(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

export function stripNumericSuffix(name) {
  return name?.replace(/\s+\d+$/, '') || ''
}
