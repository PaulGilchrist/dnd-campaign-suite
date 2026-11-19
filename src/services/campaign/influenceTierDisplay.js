/**
 * Faction influence tier canon — the ONE source for the 1–10 influence
 * thresholds and their four color-coded tiers. Extracted verbatim from the
 * Factions planner's former inline `getInfluenceStyle` (thresholds and hexes
 * unchanged); the planner's badge, the edit-form value chip, and the player
 * quest board's standing strip all resolve tiers through this module, with
 * the tier colors defined once in InfluenceBadge.css as CSS custom properties.
 */

export const INFLUENCE_TIERS = ['low', 'medium', 'high', 'extreme'];

// Thresholds preserved from the planner: <=3 low, <=6 medium, <=8 high, else
// extreme (influence is authored 1–10 by the form's range input).
export function getInfluenceTier(influence) {
  if (influence <= 3) return 'low';
  if (influence <= 6) return 'medium';
  if (influence <= 8) return 'high';
  return 'extreme';
}

/** Tier color-token class — carries --influence-tier-bg/color/border custom
 *  properties (defined in InfluenceBadge.css) for badges and meters alike. */
export function influenceTierClass(influence) {
  return `influence-tier--${getInfluenceTier(influence)}`;
}
