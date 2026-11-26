/**
 * Difficulty bands shared by the Encounter Builder panel and the printed
 * encounter sheet (backlog Item 4) — one label set and one verdict function,
 * no duplication. Deliberately its own module (not exported from
 * encounterGenerator) so hosts that stub the generator's XP math in tests
 * never have to mirror these labels.
 */

// Index-aligned with ENCOUNTER_CONFIG.xpThresholds columns (0=Easy … 3=Deadly).
export const DIFFICULTY_LABELS = ['Easy', 'Medium', 'Hard', 'Deadly'];

// Ratio bands against the Medium threshold — byte-equivalent to the builder's
// historical local calculateDifficultyIndex (extracted, behavior unchanged).
export function calculateDifficultyIndex(effectiveXP, totalThreshold) {
  if (!totalThreshold) return 0;
  const ratio = effectiveXP / totalThreshold;
  if (ratio < 0.5) return 0;
  if (ratio < 1) return 1;
  if (ratio < 1.5) return 2;
  return 3;
}
