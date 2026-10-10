import { stripParenthetical } from './nameUtils.js'

export function findFeat(featName, allFeats) {
  const exact = allFeats.find(f => f.name === featName)
  if (exact) return exact
  const stripped = stripParenthetical(featName)
  if (stripped !== featName) {
    return allFeats.find(f => f.name === stripped)
  }
  console.error('[findFeat] NOT FOUND:', featName, 'allFeats sample:', allFeats?.slice(0, 5).map(f => f.name));
  return null;
}
