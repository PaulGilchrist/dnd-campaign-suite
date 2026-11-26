/**
 * Token status indicators (roadmap Item 6 — token status rings + ownership
 * tint): the PURE derivation of what a map token shows for a creature —
 * active conditions plus campaign target effects aimed at it — in the
 * exact label/tone/tooltip language the tracker badges use (shared
 * conditionDisplay helpers + the targetEffectDefinitions registry).
 *
 * Per-token, derived, never stored: this reads the live store values handed
 * in by the rendering component (useRuntimeValue subscriptions) and returns
 * a fresh array. Zero writes, zero new runtime keys — the indicator set is
 * a projection of activeConditions/targetEffects, never a second source.
 */
import { getEffectDefinition } from './targetEffectDefinitions.js'
import { CONDITION_DESCRIPTIONS } from './effectDescriptions.js'
import {
  conditionLabel,
  conditionTone,
  normalizeConditionKeys,
  resolveEffectTone,
} from './conditionDisplay.js'

/** Corner chips stay legible at normal zoom — beyond this rides a "+N" chip. */
export const TOKEN_STATUS_VISIBLE_LIMIT = 3

/** Radius of the uniform condition ring (SVG surfaces): the shared token disc
 * radius (20, Players.jsx / PlacedItems.jsx) + clearance, so the dashed ring
 * encircles the art without touching it (Item 5 — ONE treatment everywhere). */
export const TOKEN_CONDITION_RING_RADIUS = 24

/** Badge-lane target resolution: te.target may be a name or a name array. */
function resolveTeTarget(te) {
  return Array.isArray(te.target) ? te.target[0] : te.target
}

/** Compact map chip glyph: the first letter of the SAME label the tracker
 * badge shows (Font Awesome classes are CSS-pseudo-element glyphs and can't
 * render inside SVG <text> without copying the class→codepoint table — so
 * the chip carries label letter + tone color + full label/description in
 * its <title> tooltip instead). */
export function indicatorGlyph(label) {
  return String(label).charAt(0).toUpperCase()
}

/** One condition chip, tracker-identical (label/tone/tooltip law shared). */
function conditionIndicator(key) {
  const label = conditionLabel(key)
  return {
    id: `condition-${key}`,
    label,
    glyph: indicatorGlyph(label),
    tone: conditionTone(key),
    tooltip: CONDITION_DESCRIPTIONS[label] || label,
  }
}

/** One targetEffect chip from the registry def; unregistered keys degrade
 * honestly (label = key, neutral tone), mirroring StatusBadges. */
function effectIndicator(te, creatureName) {
  if (!te || resolveTeTarget(te) !== creatureName) return null
  const def = getEffectDefinition(te.effect)
  const label = def?.label || te.effect
  const description = def?.description || label
  return {
    id: `effect-${te.effect}`,
    label,
    glyph: indicatorGlyph(label),
    tone: resolveEffectTone(def?.cls || 'effect-neutral'),
    tooltip: te.source ? `${description} (from ${te.source})` : description,
  }
}

/**
 * Build the ordered indicator list for one creature: conditions first (the
 * most load-bearing states), then campaign target effects aimed at it.
 * Deduped by label (the tracker's dedupeByLabel contract) — a Poisoned
 * condition and the Thri-Kreen "Poisoned" te row render ONE chip.
 */
export function buildTokenStatusIndicators(creatureName, activeConditions, targetEffects) {
  const indicators = []
  const seenLabels = new Set()

  const push = (indicator) => {
    if (!indicator || seenLabels.has(indicator.label)) return
    seenLabels.add(indicator.label)
    indicators.push(indicator)
  }

  for (const key of normalizeConditionKeys(activeConditions)) push(conditionIndicator(key))
  for (const te of targetEffects || []) push(effectIndicator(te, creatureName))

  return indicators
}

/**
 * The uniform "wears a condition ring" predicate (Item 5): TRUE when the
 * creature's indicator set — the SAME registry derivation the chips use,
 * conditions + campaign targetEffects aimed at it — is non-empty. Every
 * surface reads THIS one helper (indoor chip layer, hex marching-order
 * avatars); no surface re-implements "has conditions?" off the raw buckets.
 */
export function hasTokenStatusIndicators(creatureName, activeConditions, targetEffects) {
  return buildTokenStatusIndicators(creatureName, activeConditions, targetEffects).length > 0
}
