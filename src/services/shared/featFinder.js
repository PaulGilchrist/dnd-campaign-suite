import { stripParenthetical } from './nameUtils.js'

export function findFeat(featName, allFeats) {
  const exact = allFeats.find(f => f.name === featName)
  if (exact) return exact
  const stripped = stripParenthetical(featName)
  if (stripped !== featName) {
    return allFeats.find(f => f.name === stripped)
  }
  return null
}
