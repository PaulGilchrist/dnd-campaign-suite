export function stripParenthetical(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}
