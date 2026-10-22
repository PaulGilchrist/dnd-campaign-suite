// @maintained-by-ai
// Carrying-capacity law lane for the fixed rules.js:394-399 facade + rules-core.js:23
// bundle wiring (#1251). Pre-fix the facade delegated to abilityCalc.getHitPoints on
// BOTH ternary branches, so every persisted character carried carryingCapacity === HP
// (disk evidence: public/campaigns/test-campaign/HexWarlock.json computedStats
// carryingCapacity 73 === hitPoints 73 at STR totalScore 8 — RAW is 8 x 15 = 120 lb).
//
// LAW bytes (public/data/ability-scores.json, Strength entry, imported not retyped #1362):
//   "Carrying Capacity. Your carrying capacity is your Strength score multiplied by 15."
//   "Push, Drag, or Lift. ... up to twice your carrying capacity (or 30 times your
//    Strength score)." — the push arm has no function API anywhere in the codebase
//    (grep-zero getPush/getMaxDuration), so it is located-but-unimplemented; the test
//    below pins the law-text presence only, never fabricated behavior.
//   "For each size category above Medium, double the creature's carrying capacity ...
//    For a Tiny creature, halve these weights." — carried by playerStats.sizeMultiplier
//    (core/carryingCapacity.js:7-8).
// 2024: no public/data/2024/ability-scores.json exists on disk; 2024 races.json cites
// the same capacity law only via Goliath Powerful Build ("count as one size larger when
// determining your carrying capacity", :668). House convention: BOTH abilityCalc rulesets
// re-export the identical carryingCapacity.js helper (identity-pinned at
// abilityCalc2024.test.js:362), so one shared implementation serves both branches.
//
// No vi.mock here: honest real-module graph through the facade.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import rules from '../rules.js';
import { getCarryingCapacity as getCarryingCapacity5e } from './abilityCalc.js';
import { getCarryingCapacity as getCarryingCapacity2024 } from './abilityCalc2024.js';

// Disk law: extract the multiplier from the actual 5e rules text, never retype it.
const abilityScoresDisk = JSON.parse(readFileSync(
  resolve(process.cwd(), 'public/data/ability-scores.json'), 'utf8'));
const strLaw = abilityScoresDisk.find((a) => a.full_name === 'Strength').description;
const LAW_MULTIPLIER = Number(
  (strLaw.match(/carrying capacity is your Strength score multiplied by (\d+)/i) || [])[1]);

// Disk character bytes (#1362): HexWarlock abilities/hitPoints come from campaign disk.
const hexWarlockDisk = JSON.parse(readFileSync(
  resolve(process.cwd(), 'public/campaigns/test-campaign/HexWarlock.json'), 'utf8'));
const hexAbilities = hexWarlockDisk.computedStats.abilities;
const hexStrScore = hexAbilities.find((a) => a.name === 'Strength').totalScore;

function facadeCapacity(ruleset, strScore, sizeMultiplier) {
  return rules.getCarryingCapacity({
    rules: ruleset,
    abilities: [{ name: 'Strength', totalScore: strScore }],
    sizeMultiplier,
  });
}

describe('rules.getCarryingCapacity law table (facade -> real carryingCapacity.js)', () => {
  it('law multiplier parsed from public/data/ability-scores.json bytes is 15', () => {
    expect(strLaw).toMatch(/Push, Drag, or Lift/i); // push arm located, unimplemented API
    expect(LAW_MULTIPLIER).toBe(15);
  });

  it('capacity arms from the disk law table: STR 8/10/20 -> exact lb, both rulesets', () => {
    for (const ruleset of ['5e', '2024']) {
      expect(facadeCapacity(ruleset, 8)).toBe(8 * LAW_MULTIPLIER); // 120 lb
      expect(facadeCapacity(ruleset, 10)).toBe(10 * LAW_MULTIPLIER); // 150 lb
      expect(facadeCapacity(ruleset, 20)).toBe(20 * LAW_MULTIPLIER); // 300 lb
    }
  });

  it('sizeMultiplier arm (powerful build / Tiny) forwards through the facade', () => {
    expect(facadeCapacity('5e', 15, 2)).toBe(450); // STR 15 x 15 law x 2 (one size larger)
    expect(facadeCapacity('2024', 10, 0.5)).toBe(75); // Tiny halves
  });

  it('capacity is never the HP number for the same character (#1348 distinguishable)', () => {
    const capacity = rules.getCarryingCapacity({ rules: '5e', abilities: hexAbilities });
    expect(capacity).toBe(hexStrScore * LAW_MULTIPLIER); // STR 8 disk -> 120 lb
    expect(capacity).not.toBe(hexWarlockDisk.computedStats.hitPoints); // never 73 again
  });

  it('facade bundle forwards the real shared re-export identity on both rulesets', () => {
    expect(rules.getSubModules({ rules: '5e' }, {}).abilityCalc.getCarryingCapacity)
      .toBe(getCarryingCapacity5e);
    expect(rules.getSubModules({ rules: '2024' }, {}).abilityCalc.getCarryingCapacity)
      .toBe(getCarryingCapacity2024);
  });
});
