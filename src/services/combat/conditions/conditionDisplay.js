/**
 * Canonical badge/tone DISPLAY helpers for conditions and target effects.
 *
 * Every surface that renders status — the Initiative/sheet badges
 * (ConditionEffectBadges via CreatureBadge), the GM Screen (StatusBadges)
 * and the map token indicators (TokenStatusIndicators) — reads labels and
 * semantic tones from HERE, so map and tracker read identically. Surfaces
 * must never re-implement capitalization, the invisible-as-buff law or the
 * semantic-tone fold.
 *
 * Icons are deliberately NOT folded here: Font Awesome class names live on
 * each registry row (targetEffectDefinitions.js `icon` field) — the only
 * icon source of truth — and condition badges have never carried an icon on
 * any surface (CharConditions renders label-only badges).
 */

// Semantic-tone fold for raw registry cls values. Moved VERBATIM from
// ConditionEffectBadges.jsx (resolveCls) so every surface agrees: stealth-
// attack reads neutral, speed-zero/cannot-act fold to plain debuff red, and
// "attacks against the target have Disadvantage" (a defensive boon) folds
// to buff blue. Everything else keeps its own badge tone (CreatureBadge.css
// still styles the alias classes directly).
const EFFECT_TO_SEMANTIC = {
  'effect-stealth-attack': 'effect-neutral',
  'effect-speed-zero': 'effect-debuff',
  'effect-target-disadv': 'effect-buff',
  'effect-cannot-act': 'effect-debuff',
}

/** Map a registry cls to the semantic tone class a badge/chip should carry. */
export function resolveEffectTone(cls) {
  return EFFECT_TO_SEMANTIC[cls] || cls
}

/**
 * Condition tone law (sheet CharConditions / GM Screen StatusBadges / map
 * tokens): Invisible reads as a buff, every other condition uses the
 * condition (red-save) tone.
 */
export function conditionTone(key) {
  return String(key).toLowerCase() === 'invisible' ? 'effect-buff' : 'effect-condition'
}

/**
 * Normalize a runtime activeConditions entry (string key, or an object
 * carrying a key) to its display label — same capitalization contract as
 * the sheet's CharConditions badges. (Moved from gm-screen/partyRowData.js
 * to become the shared contract for map token indicators too.)
 */
export function conditionLabel(key) {
  if (key === 'speed_zero') return 'Speed 0'
  return String(key).charAt(0).toUpperCase() + String(key).slice(1)
}

/** Unique condition keys from a runtime activeConditions array. */
export function normalizeConditionKeys(raw) {
  if (!Array.isArray(raw)) return []
  return [...new Set(
    raw
      .map(entry => (typeof entry === 'string' ? entry : entry?.key))
      .filter(Boolean)
  )]
}
