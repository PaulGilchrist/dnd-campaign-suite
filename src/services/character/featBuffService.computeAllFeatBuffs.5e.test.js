// featBuffService.computeAllFeatBuffs.5e.test.js — LANE #4/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject: src/services/character/featBuffService.js
// computeAllFeatBuffs (L583-633) on the 5e TEXT path. Canonical seam map lives in the
// lane #1 header (featBuffService.applyFeatBuffsToFormData.test.js) — READ FIRST.
//
// THIS LANE CONTRACT (#2019): computeAllFeatBuffs is the AGGREGATION ENVELOPE on the
// 5e text path — four-category object ({abilityScoreIncreases, proficiencies, resistances,
// features}) built by routing each selected feat's string benefits through
// parse5eBenefitText via computeFeatBuffs, featName/featDescription stamped onto every
// increase and featName onto every feature, items concatenated in feat-selection order.
//   - RESISTANCES ARE POPULATED here (L563-573 text semantics): the twin #2018 pins
//     structural-always-[] on the 2024 structured path (resistances → features); this
//     lane is its counterpart — the disk 5e rows' resistance text fills the array
//     VERBATIM, regex word-capture quirks included (cross-ref both before changing).
//   - FEAT-LEVEL AUTOMATION THREADING (computeFeatBuffs L563-573, exercised through
//     this aggregate): a 5e feat row's `automation` object OR array appends threaded
//     features {name: feat.name, description: feat.description, type: auto.type ||
//     'passive'} AFTER the text-derived features, each stamped featName here.
//   - STAMP SEMANTICS: featDescription is the disk row's `description` verbatim —
//     an ARRAY of paragraphs on disk 5e rows (the old lane's `featDescription:
//     undefined` pin was an artifact of a description-less mocked row, not disk text).
//   - PURE-RETURN: formData is read-only (contrast the #2016 writer's in-place
//     featIncrease/resistances mutation + #2017 reset seam). No accumulation across
//     calls — pinned below alongside the no-cache-mutation guard: the rows selected
//     here (Observant passive_buff / Heavily Armored none / Dungeon Delver + Alert
//     conditional_advantage|passive_buff) never enter the L613-629 resolvers, so the
//     SPA-cache row-mutation quirk (L626-627, featBuffService.computeAllFeatBuffs
//     .resilient #2021) is not triggered on this lane. Resilient/ritual feats stay
//     out of these fixtures for that reason.
//   - findFeat is intentionally NOT mocked (featFinder.js is a pure lookup over the
//     passed allFeats — no internal disk cache). Fixtures are verbatim rows from
//     public/data/feats.json; expected envelopes are actual observed outputs of the
//     real parser for those rows (as-is canon, verified 2026-10-16).
//
// SHED HERE (duplicates elsewhere):
//   - Parser RULE internals (per-pattern ASI/proficiency/speed/initiative/HP/language/
//     resistance first-match-wins, Passive Benefit fallback, non-string skipping,
//     single-feat multi-category split) → #2023 computeFeatBuffs.5e canon. This lane
//     keeps only the AGGREGATION threading through the text path, not rule-table re-runs.
//   - Empty-formData envelope + not-found/null tolerance → #2020 edge-cases.
//   - saveType resolution via resolveFeatChosenAbility → #2021 resilient.
//   - 2024 structured envelope → #2018 twin.
// REMOVED (dead mock surface, carried rec from #2018): the old body mocked
// buffApplier.applyAbilityScoreIncreases/resetMiscBonuses/mergeDeduplicated —
// computeAllFeatBuffs calls NONE of them (featBuffService.js imports only
// mergeDeduplicated, used by the #2016 writer at L648; resetMiscBonuses does not
// even exist in buffApplier.js — only applyAbilityScoreIncreases and
// mergeDeduplicated are exported). Mock deleted; findFeat mock deleted in favor of
// real disk lookups; the fabricated 'War Caster' ASI+fire-resistance fixture (real
// disk War Caster has neither) is replaced by verbatim disk rows above.
//
// LIVENESS (verified by grep 2026-10-16): computeAllFeatBuffs is LIVE canon —
// useWizardFeatBuffs.js:83, useWizardFeatAbilityChoices.js:117/182,
// WizardStepAbilities.jsx:300, rules.js:255 (PlayerStats build). No timers.
// Anti-pattern hygiene: exact assertions only, disk-derived strings (no fabrication),
// no canned maps, no vacuous loops.

import { describe, it, expect } from 'vitest';

import feats5e from '../../../public/data/feats.json' with { type: 'json' };

import { computeAllFeatBuffs } from './featBuffService.js';

const pickFeat = name => {
  const row = feats5e.find(f => f.name === name);
  if (!row) throw new Error(`public/data/feats.json no longer contains '${name}' — re-anchor this lane`);
  return row;
};

describe('computeAllFeatBuffs — 5e text path (aggregation envelope)', () => {
  it('aggregates disk feats into the four-category envelope, concatenated in selection order', () => {
    const heavily = pickFeat('Heavily Armored');
    const observant = pickFeat('Observant');

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Heavily Armored', 'Observant'] },
      feats5e
    );

    // Heavily Armored's non-choice ASI precedes Observant's two-score 'or' split —
    // selection order threaded. Per-benefit regex shapes are #2023 canon; the stamp
    // fields and ordering are this lane's. featDescription is the disk row's
    // description ARRAY verbatim (text rows stamp exactly what #2018 stamps verbatim).
    expect(result.abilityScoreIncreases).toEqual([
      {
        name: 'Strength',
        amount: 1,
        isChoice: false,
        max_value: 20,
        featName: 'Heavily Armored',
        featDescription: heavily.description,
      },
      {
        name: 'Intelligence',
        amount: 1,
        isChoice: true,
        max_value: 20,
        featName: 'Observant',
        featDescription: observant.description,
      },
      {
        name: 'Wisdom',
        amount: 1,
        isChoice: true,
        max_value: 20,
        featName: 'Observant',
        featDescription: observant.description,
      },
    ]);

    // Proficiencies carry NO featName stamp (same as #2018 — threading by position only).
    expect(result.proficiencies).toEqual([
      { name: 'Heavy Armor', type: 'proficiency' },
    ]);

    // No selected row here carries resistance text; see the Dungeon Delver pin below
    // for the populated counterpart of #2018's structural-always-[] twin.
    expect(result.resistances).toEqual([]);

    // Text-derived features in benefit order; threaded automation feature last.
    expect(result.features).toEqual([
      {
        name: 'Passive Benefit',
        description: observant.benefits[1],
        type: 'passive',
        featName: 'Observant',
      },
      {
        name: 'Passive Benefit',
        description: observant.benefits[2],
        type: 'passive',
        featName: 'Observant',
      },
      {
        name: 'Observant',
        description: observant.description,
        type: 'passive_buff',
        automation: observant.automation,
        featName: 'Observant',
      },
    ]);
  });

  it('populates resistances from disk text — counterpart of #2018 structural-always-[]', () => {
    const delver = pickFeat('Dungeon Delver');

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Dungeon Delver'] },
      feats5e
    );

    // RESISTANCE_PATTERN word-capture on the only resistance row in disk 5e feats
    // ('You have resistance to the damage dealt by traps.') yields the bare capture
    // word — as-is canon at this seam; per-pattern regex semantics are #2023's lane.
    expect(result.resistances).toEqual(['the']);

    // The matching benefit text lands in resistances ONLY — never also in features.
    expect(result.abilityScoreIncreases).toEqual([]);
    expect(result.proficiencies).toEqual([]);
    expect(result.features).toEqual([
      {
        name: 'Passive Benefit',
        description: delver.benefits[0],
        type: 'passive',
        featName: 'Dungeon Delver',
      },
      {
        name: 'Passive Benefit',
        description: delver.benefits[1],
        type: 'passive',
        featName: 'Dungeon Delver',
      },
      {
        name: 'Passive Benefit',
        description: delver.benefits[3],
        type: 'passive',
        featName: 'Dungeon Delver',
      },
      {
        name: 'Dungeon Delver',
        description: delver.description,
        type: 'conditional_advantage',
        automation: delver.automation,
        featName: 'Dungeon Delver',
      },
    ]);
  });

  it('threads an ARRAY feat-level automation into features after the text rows, featName on all', () => {
    const alert = pickFeat('Alert');

    const result = computeAllFeatBuffs({ rules: '5e', feats: ['Alert'] }, feats5e);

    // L563-573 array branch: three threaded features (name/description from the ROW,
    // type from each automation entry) appended after Alert's three text-derived ones.
    expect(result.features).toEqual([
      {
        name: 'Initiative Bonus',
        description: alert.benefits[0],
        type: 'initiative',
        value: 5,
        featName: 'Alert',
      },
      {
        name: 'Passive Benefit',
        description: alert.benefits[1],
        type: 'passive',
        featName: 'Alert',
      },
      {
        name: 'Passive Benefit',
        description: alert.benefits[2],
        type: 'passive',
        featName: 'Alert',
      },
      {
        name: 'Alert',
        description: alert.description,
        type: 'passive_buff',
        automation: alert.automation[0],
        featName: 'Alert',
      },
      {
        name: 'Alert',
        description: alert.description,
        type: 'passive_buff',
        automation: alert.automation[1],
        featName: 'Alert',
      },
      {
        name: 'Alert',
        description: alert.description,
        type: 'passive_buff',
        automation: alert.automation[2],
        featName: 'Alert',
      },
    ]);

    // Aggregation-lane stamp: EVERY feature from the threaded array carries featName.
    expect(result.features.map(f => f.featName)).toEqual(Array(6).fill('Alert'));
  });

  it('defaults to the 5e text path when formData.rules is absent', () => {
    const withRules = computeAllFeatBuffs({ rules: '5e', feats: ['Observant'] }, feats5e);
    const withoutRules = computeAllFeatBuffs({ feats: ['Observant'] }, feats5e);

    // L584: rules defaults to '5e' — absent field must take the SAME text branch,
    // byte-identical envelope.
    expect(withoutRules).toEqual(withRules);
    expect(withoutRules.abilityScoreIncreases).toHaveLength(2);
    expect(withoutRules.features).toHaveLength(3);
    expect(withoutRules.resistances).toEqual([]);
  });

  it('is pure: does not mutate formData or disk rows, returns a fresh envelope, stable across calls', () => {
    const formData = {
      rules: '5e',
      feats: ['Observant', 'Dungeon Delver'],
      abilities: [{ name: 'Intelligence', featIncrease: 0 }],
      resistances: ['cold'],
    };
    const snapshot = JSON.parse(JSON.stringify(formData));
    const selectedRows = feats5e.filter(f => ['Observant', 'Dungeon Delver'].includes(f.name));
    const rowsSnapshot = JSON.parse(JSON.stringify(selectedRows));

    const first = computeAllFeatBuffs(formData, feats5e);
    const second = computeAllFeatBuffs(formData, feats5e);

    // Contrast #2016 (featIncrease doubles, resistances merge-append, #2017 undo):
    // this lane writes nothing to formData and needs no reset seam.
    expect(JSON.parse(JSON.stringify(formData))).toEqual(snapshot);
    expect(formData.resistances).toEqual(['cold']);
    expect(first).not.toBe(formData);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);

    // Rows selected here never enter the L613-629 resolvers (no save_proficiency
    // fallbackTypes / ritual_spells chosenSpells), so the SPA-cache feats.json rows
    // are untouched — the deliberate contrast with #2021's mutation quirk.
    expect(JSON.parse(JSON.stringify(feats5e.filter(f => rowsSnapshot.some(r => r.name === f.name)))))
      .toEqual(rowsSnapshot);

    // Sanity: both feats contributed, selection order intact (Observant's 'or' ASI
    // splits into two increases; Dungeon Delver contributes resistances + features).
    expect(first.abilityScoreIncreases.map(i => i.featName)).toEqual(['Observant', 'Observant']);
    expect(first.resistances).toEqual(['the']);
    expect(first.features.map(f => f.featName)).toEqual([
      'Observant',
      'Observant',
      'Observant',
      'Dungeon Delver',
      'Dungeon Delver',
      'Dungeon Delver',
      'Dungeon Delver',
    ]);
  });
});
