// @maintained-by-ai
/**
 * Regression lock for `bug-ruleset-switch-ledger-persists-overcap-feats-skills`.
 *
 * Before the fix, classifyFeats kept ANY feat whose NAME existed in the
 * target ruleset, ignoring the feat SLOTS that build actually has. A 2024
 * level-1 character carries its Origin feat (Savage Attacker from Soldier);
 * switching it to 5e printed "Feats — 1 kept, 0 removed Savage Attacker"
 * even though a 5e level-1 build holds ZERO feats, so the wizard persisted
 * "selected 1 of 0 allowed feat(s)" to the character file and re-saved it
 * forever.
 *
 * Now the ledger consults the TARGET ruleset's own slot count (getFeatLimits
 * math — the same source WizardStepFeats uses for "N of M allowed") and
 * classifies legal rows past that cap as REMOVED (reason: over-cap), naming
 * the ruleset + level. It also proves the kept background's own Origin feat
 * still survives without consuming a slot (the switch toward 2024 lane).
 *
 * Real public/data files, real level-1 draft — no mocks in the classifier lane.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyRulesetSwitch,
  applyRulesetSwitchToFormData,
  DROP_REASONS,
} from './rulesetSwitchPreview.js';

import realFeats5e from '../../../public/data/feats.json';
import realFeats2024 from '../../../public/data/2024/feats.json';
import realClasses5e from '../../../public/data/classes.json';
import realBackgrounds2024 from '../../../public/data/2024/backgrounds.json';

// The shape the live bug rode: a 2024 level-1 Soldier Human Fighter whose
// origin feat row (Savage Attacker) exists by name in the 5e data too.
const lv1Draft = (overrides = {}) => ({
  level: 1,
  class: { name: 'Fighter', subclass: { name: 'Champion' } },
  abilities: [
    { name: 'Strength', baseScore: 15, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Dexterity', baseScore: 14, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Constitution', baseScore: 13, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Intelligence', baseScore: 10, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Wisdom', baseScore: 12, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Charisma', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
  ],
  spells: [],
  feats: [],
  background: '',
  ...overrides,
});

const dropOf = (group, name) => group.dropped.find(row => row.name === name);

describe('classifyRulesetSwitch — over-cap feat removal (2024 → 5e level 1)', () => {
  it('removes the origin feat as over-cap: 5e grants no feats at level 1', () => {
    // getFeatLimits for 5e level 1 returns allowed = 0 (no available_level ≤ 1).
    const preview = classifyRulesetSwitch({
      formData: lv1Draft({ feats: ['Savage Attacker'], background: 'Soldier' }),
      targetRuleset: '5e',
      targetFeats: realFeats5e,
      targetClasses: realClasses5e,
      targetBackgrounds: [],
      targetFeatAllowed: 0,
    });

    expect(preview.feats.kept).toEqual([]);
    const row = dropOf(preview.feats, 'Savage Attacker');
    expect(row).toBeTruthy();
    expect(row.reason).toBe(DROP_REASONS.OVER_CAP);
    expect(row.detail).toContain('grants no feats at level 1');
    // Ledger copy is byte-honest: 0 kept, 1 removed.
    expect(preview.feats.dropped).toHaveLength(1);
  });

  it('applyRulesetSwitchToFormData writes the removal — the feat cannot survive the commit', () => {
    const formData = lv1Draft({ rules: '2024', feats: ['Savage Attacker'], background: 'Soldier' });
    const preview = classifyRulesetSwitch({
      formData,
      targetRuleset: '5e',
      targetFeats: realFeats5e,
      targetClasses: realClasses5e,
      targetBackgrounds: [],
      targetFeatAllowed: 0,
    });
    const applied = applyRulesetSwitchToFormData(formData, preview);
    expect(applied.rules).toBe('5e');
    expect(applied.feats).toEqual([]);
  });

  it('legal row WITHIN the target cap still survives (cap is not a blanket drop)', () => {
    // 5e level 4 grants 1 feat; a single no-prerequisite feat stays kept.
    const preview = classifyRulesetSwitch({
      formData: lv1Draft({ level: 4, feats: ['Alert'] }),
      targetRuleset: '5e',
      targetFeats: realFeats5e,
      targetClasses: realClasses5e,
      targetBackgrounds: [],
      targetFeatAllowed: 1,
    });
    expect(preview.feats.kept).toEqual(['Alert']);
    expect(preview.feats.dropped).toEqual([]);
  });

  it('only the first `allowed` legal feats survive; the rest are named over-cap', () => {
    const preview = classifyRulesetSwitch({
      formData: lv1Draft({ level: 8, feats: ['Alert', 'Savage Attacker', 'Lucky'] }),
      targetRuleset: '5e',
      targetFeats: realFeats5e,
      targetClasses: realClasses5e,
      targetBackgrounds: [],
      targetFeatAllowed: 2,
    });
    expect(preview.feats.kept).toEqual(['Alert', 'Savage Attacker']);
    const row = dropOf(preview.feats, 'Lucky');
    expect(row.reason).toBe(DROP_REASONS.OVER_CAP);
    expect(row.detail).toContain('grants only 2 feat(s) at level 8');
  });
});

describe('classifyRulesetSwitch — pre-selected origin feat is not over-cap (5e → 2024)', () => {
  it('kept 2024 background grants its origin feat outside the slot count', () => {
    // Switching toward 2024: the retained Soldier background's own feat is
    // pre-selected (WizardStepFeats shows "(Pre-selected)"), so a level-1
    // character with the allowed slot at 0 still keeps Savage Attacker.
    const preview = classifyRulesetSwitch({
      formData: lv1Draft({ rules: '5e', feats: ['Savage Attacker'], background: 'Soldier' }),
      targetRuleset: '2024',
      targetFeats: realFeats2024,
      targetClasses: [],
      targetBackgrounds: realBackgrounds2024,
      targetFeatAllowed: 0,
    });

    expect(preview.background.kept).toBe('Soldier');
    expect(preview.feats.kept).toEqual(['Savage Attacker']);
    expect(preview.feats.dropped).toEqual([]);
  });
});
