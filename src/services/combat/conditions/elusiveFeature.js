// Elusive (Rogue lv18 in BOTH rulesets — 2024 classes.json:9843, 5e twin :9601):
// no attack roll can have Advantage against you unless Incapacitated. Detection is
// a name-match over the FULL rolled PlayerStats (rulesFactory.getPlayerStats);
// combatSummary player entries are feature-less stubs (encounterToInitiative.js:57),
// so every consumer — sheet lane (CharSheet.conditionEffects) AND NPC→PC monster-card
// lane (MonsterCardModal) — must source playerStats, never combatSummary entries.
// Level gating is implicit: the feature collectors only emit class features at
// ≤ character level. Lives in its own module so the strict vi.mock surfaces on
// conditionEffects.js (CLA-118 lesson) stay untouched.
export function hasElusiveFeature(playerStats) {
  if (!playerStats) return false;
  return [
    ...(playerStats.actions || []),
    ...(playerStats.bonusActions || []),
    ...(playerStats.reactions || []),
    ...(playerStats.specialActions || [])
  ].some(a => a.name === 'Elusive');
}
