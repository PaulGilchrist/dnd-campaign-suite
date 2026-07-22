import { stripParenthetical } from './nameUtils.js'

export function findFeat(featName, allFeats) {
  if (featName === 'Boon Of Fortitude') {
    console.error('[findFeat] LOOKING FOR:', featName, 'allFeats count:', allFeats?.length, 'first 3 names:', allFeats?.slice(0, 3).map(f => f.name));
  }
  const exact = allFeats.find(f => f.name === featName)
  if (exact) return exact
  const stripped = stripParenthetical(featName)
  if (stripped !== featName) {
    return allFeats.find(f => f.name === stripped)
  }
  console.error('[findFeat] NOT FOUND:', featName);
  return null;
}
