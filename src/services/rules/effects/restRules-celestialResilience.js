// Shared preamble for Celestial Resilience temp HP granting on rests.
// Validates Celestial Patron class, feature presence, and level, then
// computes self temp HP (warlock level + Charisma modifier).
// Returns null when not applicable; throws when level is missing.
export function getCelestialResilienceSelfTempHp(playerStats, restTag) {
  if (playerStats.class?.major?.name !== 'Celestial Patron' && playerStats.class?.subclass?.name !== 'Celestial Patron') return null
  const features = playerStats.specialActions || []
  const feature = features.find(f => f.name === 'Celestial Resilience')
  if (!feature) return null
  if (playerStats.level == null) {
    console.error(`[restRules] ${restTag}: playerStats.level is missing for celestial patron temp HP`)
    throw new Error('playerStats.level is required for celestial patron temp HP')
  }
  const chaMod = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus || 0
  const selfTempHp = playerStats.level + chaMod
  return selfTempHp <= 0 ? null : selfTempHp
}
