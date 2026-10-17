// @maintained-by-ai
// featBuffService.computeAllFeatBuffs.2024.test.js — LANE #3/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject: src/services/character/featBuffService.js
// computeAllFeatBuffs (L583-633). Canonical seam map lives in the lane #1 header
// (featBuffService.applyFeatBuffsToFormData.test.js) — READ FIRST.
//
// THIS LANE CONTRACT (#2018): computeAllFeatBuffs is the AGGREGATION ENVELOPE on the
// 2024 structured path — four-category object ({abilityScoreIncreases, proficiencies,
// resistances, features}), featName/featDescription stamped onto every increase and
// featName onto every feature post-parse, items concatenated in feat-selection order.
//   - PURE-RETURN: formData is read-only here (rules/feats/featAbilityChoices); unlike
//     the #2016 writer there is NO in-place mutation and NO accumulation across calls
//     (that seam's non-idempotency + #2017 reset do not apply to this lane — pinned).
//   - findFeat is intentionally NOT mocked (featFinder.js is a pure lookup over the
//     passed allFeats — it has no internal disk cache). Fixtures are verbatim rows from
//     public/data/2024/feats.json; expected envelopes are actual observed outputs of the
//     real parser for those rows (as-is canon, verified 2026-10-16).
//   - Resistances stay [] on the 2024 structured path: parse2024Resistance routes
//     resistance benefits into `features`, never the `resistances` array (the 5e twin
//     #2019 fills `resistances` from text). Structural pin here; per-benefit parsing
//     canon is #2022.
//
// SHED HERE (duplicates elsewhere): benefits-without-type / null filtering and
// single-feat multi-benefit parsing → #2022 computeFeatBuffs.2024 (its `ASI Feat`/
// `Prof Feat`/Feat A-B fabricated fixtures were also near-clones of this lane's old
// body — now replaced by disk-verbatim rows). Empty-formData envelope + not-found
// null tolerance → #2020 edge-cases. saveType resolution + SPA-cache mutation quirk
// (featBuffService.js:626-627 mutates rows only for automation.type ===
// 'save_proficiency' with fallbackTypes) → #2021 resilient; the rows selected here
// (free_spell/passive/utility/proficiency/bonus_action) deliberately never enter that
// resolver, so no cache mutation is triggered or sanitized in this lane.
//
// LIVENESS (verified by grep 2026-10-16): computeAllFeatBuffs is LIVE canon —
// useWizardFeatBuffs.js:83, useWizardFeatAbilityChoices.js:117/182,
// WizardStepAbilities.jsx:300, rules.js:255 (PlayerStats build). No timers.

import { describe, it, expect, vi, afterEach } from 'vitest';

import feats2024 from '../../../public/data/2024/feats.json' with { type: 'json' };

import { computeAllFeatBuffs } from './featBuffService.js';

const pickFeat = name => {
  const row = feats2024.find(f => f.name === name);
  if (!row) throw new Error(`public/data/2024/feats.json no longer contains '${name}' — re-anchor this lane`);
  return row;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('computeAllFeatBuffs — 2024 structured path (aggregation envelope)', () => {
  it('aggregates disk feats into the four-category envelope, concatenated in selection order', () => {
    const feyTouched = pickFeat('Fey Touched');
    const feyMagic = feyTouched.benefits.find(b => b.name === 'Fey Magic');

    const result = computeAllFeatBuffs(
      { rules: '2024', feats: ['Fey Touched', 'Skilled', 'Lucky'] },
      feats2024
    );

    expect(Object.keys(result).sort()).toEqual([
      'abilityScoreIncreases',
      'features',
      'proficiencies',
      'resistances',
    ]);

    // Fey Touched is the only ASI contributor; its multi-score choice shape
    // (amount:[1]) is #2022 parser canon — the stamp fields are this lane's.
    expect(result.abilityScoreIncreases).toHaveLength(1);
    expect(result.abilityScoreIncreases[0]).toMatchObject({
      name: 'any',
      isChoice: true,
      featName: 'Fey Touched',
      featDescription: feyTouched.description,
    });

    // Skilled contributes exactly one proficiency; proficiencies carry NO featName
    // stamp — threading here is by position/count only (stamps live on increases + features).
    expect(result.proficiencies).toEqual([
      {
        name: 'Proficiency',
        type: 'proficiency',
        isChoice: true,
        choose: 3,
        from: ['skills or tools'],
      },
    ]);

    // 2024 structured path never populates `resistances` (→ features) — see header.
    expect(result.resistances).toEqual([]);

    // Selection order threaded: Fey Touched's feature precedes Lucky's three.
    expect(result.features).toEqual([
      {
        name: 'Fey Magic',
        description: feyMagic.description,
        type: 'free_spell',
        automation: {
          type: 'free_spell',
          spell: ['Misty Step'],
          perSpellTracking: true,
          recharge: 'long_rest',
          casting_time: '1 bonus action',
        },
        featName: 'Fey Touched',
      },
      {
        name: 'Luck Points',
        description: 'You have a number of Luck Points equal to your Proficiency Bonus and can spend the points on the benefits below. You regain your expended Luck Points when you finish a Long Rest.',
        type: 'passive',
        featName: 'Lucky',
      },
      {
        name: 'Advantage',
        description: 'When you roll a d20 for a D20 Test, you can spend 1 Luck Point to give yourself Advantage on the roll.',
        type: 'utility',
        automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1, casting_time: '1 reaction' },
        featName: 'Lucky',
      },
      {
        name: 'Disadvantage',
        description: 'When a creature rolls a d20 for an attack roll against you, you can spend 1 Luck Point to impose Disadvantage on that roll.',
        type: 'utility',
        automation: { type: 'lucky_point', effect: 'disadvantage', target: 'attack_roll', cost: 1, casting_time: '1 reaction' },
        featName: 'Lucky',
      },
    ]);
  });

  it('stamps featName and featDescription verbatim from the disk row onto every increase and feature', () => {
    const observant = pickFeat('Observant');

    const result = computeAllFeatBuffs({ rules: '2024', feats: ['Observant'] }, feats2024);

    // Shape of the two-score ASI is pinned verbatim in #2022; here: stamp semantics.
    expect(result.abilityScoreIncreases).toHaveLength(1);
    expect(result.abilityScoreIncreases[0]).toMatchObject({
      name: 'any',
      amount: 1,
      isChoice: true,
      featName: 'Observant',
      featDescription: observant.description,
    });
    expect(result.abilityScoreIncreases[0].featDescription).toBe(observant.description);

    expect(result.proficiencies.map(p => p.name)).toEqual(['Keen Observer']);
    expect(result.resistances).toEqual([]);

    const quickSearch = observant.benefits.find(b => b.name === 'Quick Search');
    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toEqual({
      name: 'Quick Search',
      description: quickSearch.description,
      type: 'bonus_action',
      isBonusAction: true,
      featName: 'Observant',
    });
  });

  it('attaches featName to every feature from every feat (real findFeat, disk rows)', () => {
    const result = computeAllFeatBuffs({ rules: '2024', feats: ['Observant', 'Lucky'] }, feats2024);

    expect(result.features.map(f => f.featName)).toEqual([
      'Observant',
      'Lucky',
      'Lucky',
      'Lucky',
    ]);
    expect(result.features.map(f => f.name)).toEqual([
      'Quick Search',
      'Luck Points',
      'Advantage',
      'Disadvantage',
    ]);
  });

  it('is pure: does not mutate formData, returns a fresh envelope, stable across repeated calls', () => {
    const formData = {
      rules: '2024',
      feats: ['Fey Touched', 'Skilled'],
      abilities: [
        { name: 'Intelligence', featIncrease: 0 },
        { name: 'Wisdom', featIncrease: 0 },
      ],
      resistances: ['cold'],
    };
    const snapshot = JSON.parse(JSON.stringify(formData));

    const first = computeAllFeatBuffs(formData, feats2024);
    const second = computeAllFeatBuffs(formData, feats2024);

    // Contrast with the #2016 writer (featIncrease doubles, resistances merge-append,
    // undo via #2017 reset): this lane writes nothing and needs no reset seam.
    expect(JSON.parse(JSON.stringify(formData))).toEqual(snapshot);
    expect(first).not.toBe(formData);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(first.proficiencies).toHaveLength(1);
    expect(formData.resistances).toEqual(['cold']);
  });

  it('skips feat names that findFeat cannot resolve and aggregates the rest', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = computeAllFeatBuffs(
      { rules: '2024', feats: ['Fey Touched', 'Nonexistent Feat', 'Skilled'] },
      feats2024
    );

    expect(result.abilityScoreIncreases.map(i => i.featName)).toEqual(['Fey Touched']);
    expect(result.proficiencies.map(p => p.name)).toEqual(['Proficiency']);
    expect(result.resistances).toEqual([]);
    expect(result.features.map(f => f.featName)).toEqual(['Fey Touched']);
    // One miss on the real findFeat lookup path (its NOT FOUND log is featFinder's lane).
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});
