import { stripParenthetical } from './nameUtils.js'

// XY 2026-11-23: miss logs spammed one console.error PER render pass (×3 identical
// per mount). Dedupe to once-per-name-per-load at the single miss exit — distinct
// names each keep their first-occurrence log (keyed by name, not a global one-shot).
const notFoundLogged = new Set()

// Test-isolation reset only: clears the once-per-name dedupe set so unit pins can
// each observe a fresh first-occurrence log. Never called by app code.
export function resetFeatFinderMissLog() {
  notFoundLogged.clear()
}

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
  // allFeats is already dereferenced at :4/:8 — bare call here (fix#336S / #1538:
  // the retired ?. was a vacuous chain hiding behind the earlier hard deref).
  if (!notFoundLogged.has(featName)) {
    notFoundLogged.add(featName)
    console.error('[findFeat] NOT FOUND:', featName, 'allFeats sample:', allFeats.slice(0, 5).map(f => f.name));
  }
  return null;
}
