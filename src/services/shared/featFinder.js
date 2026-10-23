import { stripParenthetical } from './nameUtils.js'

export function findFeat(featName, allFeats) {
  const exact = allFeats.find(f => f.name === featName)
  if (exact) return exact
  const stripped = stripParenthetical(featName)
  if (stripped !== featName) {
    const fallback = allFeats.find(f => f.name === stripped)
    if (fallback) return fallback
    // #1538: paren-query miss joins the canonical NOT FOUND miss exit below —
    // one miss vocabulary (null + log), never a silent undefined.
  }
  console.error('[findFeat] NOT FOUND:', featName, 'allFeats sample:', allFeats?.slice(0, 5).map(f => f.name));
  return null;
}
