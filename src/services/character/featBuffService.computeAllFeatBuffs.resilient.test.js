// @maintained-by-ai
// featBuffService.computeAllFeatBuffs.resilient.test.js — LANE #2021/9 of the featBuffService
// nine-lane cluster (map in featBuffService.applyFeatBuffsToFormData.test.js header, #2016 law).
// Subject seam: computeAllFeatBuffs (featBuffService.js:583-633) saveType resolution for the
// Resilient feat via resolveSaveTypeFromChoices → shared/abilityLookup.resolveFeatChosenAbility
// (canonical FT-094 contract: featAbilityChoices keys are "<Feat>-<featListIndex>", value is
// { assignment: '<Ability>' } or a plain string — returned RAW, no ability-name normalization).
//
// FIXTURES: verbatim disk rows, imported from public/data/feats.json (5e) and
// public/data/2024/feats.json (2024), deep-cloned fresh per test. Real flow verified:
// rules.js:255 applyFeatBuffs loads via dataLoader.loadFeatData(is2024 ? '2024' : '5e') —
// a 5e character passes public/data/feats.json rows, a 2024 character passes
// public/data/2024/feats.json rows; both real wizard lanes (useWizardFeatBuffs.js:83,
// useWizardFeatAbilityChoices.js:117/182) feed formData.rules through unchanged. findFeat is
// NOT mocked here — it is a pure exact-name lookup (shared/featFinder.js) exercised for real
// against the disk rows.
//
// CARRIED DEFECT/QUIRK PIN x3 (#2016/#2018/#2020 carry; playbook test-setup-playbook.md:357)
// — SPA-CACHE ROW MUTATION at featBuffService.js:626-627:
//   feature.automation.saveType = resolved; delete feature.automation.fallbackTypes;
//   feature.automation reaches the resolver as a DIRECT REFERENCE, not a copy, whenever the
//   row carries the automation: 5e top-level feat.automation passthrough (L563-572) and 2024
//   parse2024SavingThrow benefit.automation passthrough (L334). dataLoader.loadData caches the
//   parsed feats.json ARRAY per version for the whole SPA session (dataCache), so the writes
//   land on the shared cached row and persist across navigation without reload:
//   - 5e real row has BOTH text benefits AND top-level automation → computeAllFeatBuffs
//     emits TWO save_proficiency features per Resilient: [text-derived (FRESH automation
//     object, safe to mutate), row-reference feature]. Resolution mutates only the second.
//   - 2024 real row routes its ONLY save_proficiency feature through the row reference →
//     every resolution permanently rewrites cached row.benefits[1].automation.
//   Worse consequence pinned below: once fallbackTypes is deleted from the cached row, the
//   resolver GUARD (L620-623 requires non-empty fallbackTypes) can never re-fire for that
//   row — later choice changes silently never apply (stale saveType until page reload).
//   Pinned honestly, NOT sanitized. FLAG: FINAL REPORT.
//
// Non-mutation legs use FRESH cloneDeep fixtures (imported module objects are shared by
// vitest's module registry; each test clones its own copy) so no pin depends on execution
// order — cf. invocationCallOrder discipline. No console spies (no #2020 restore-leak), no
// timers, exact envelopes only (no bare toBeDefined).
//
// SHED (other lanes): envelope aggregation mechanics → #2018 (2024) / #2019 (5e); null/
// undefined tolerance → #2020; benefit-text parser internals → #2022/#2023; ritual_spells
// spellCastingAbility branch (L614-618) → #2024.

import { describe, it, expect, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';

import featsDisk5e from '../../../public/data/feats.json';
import featsDisk2024 from '../../../public/data/2024/feats.json';
import { computeAllFeatBuffs } from './featBuffService.js';
// findFeat intentionally NOT mocked: exact-name lookup on the allFeats array is exercised
// for real against verbatim disk rows (it console.errors only on genuine miss — never here).

const diskRow5e = featsDisk5e.find(f => f.name === 'Resilient');
const diskRow2024 = featsDisk2024.find(f => f.name === 'Resilient');

// The disk fallback ladder is Strength-default + five remaining abilities in canonical order.
// Exact-order pin (this lane's law): the ladder is ['Dexterity','Constitution','Intelligence',
// 'Wisdom','Charisma'] on BOTH rulesets' disk rows.
const FALLBACK_LADDER = ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

const saveProfs = result => result.features.filter(f => f.automation?.type === 'save_proficiency');

describe('computeAllFeatBuffs — 5e Resilient (verbatim public/data/feats.json row)', () => {
  // Fresh clone per test: fresh-copy fixtures keep non-mutation legs order-independent, and
  // mutation legs mutate ONLY their own row copy, never the imported disk module object.
  let row;
  let formData;

  beforeEach(() => {
    row = cloneDeep(diskRow5e);
    formData = { rules: '5e', feats: ['Resilient'] };
  });

  it('emits TWO save_proficiency features (text-derived + row-reference top-level automation), unresolvable choices leave both at the Strength default with the exact fallback ladder and never touch the row', () => {
    const result = computeAllFeatBuffs(formData, [row]);

    // Full exact envelope — the real disk row produces exactly two save_proficiency features:
    // the text-parsed one carries type 'saving_throw' with a FRESH automation object; the
    // top-level-automation passthrough carries type 'save_proficiency' and the ROW reference.
    expect(result.features).toEqual([
      {
        name: 'Resilient',
        description: 'You gain proficiency in saving throws using the chosen ability.',
        type: 'saving_throw',
        automation: {
          type: 'save_proficiency',
          saveType: 'Strength',
          fallbackTypes: FALLBACK_LADDER,
        },
        featName: 'Resilient',
      },
      {
        name: 'Resilient',
        description: ['Choose one ability score. You gain the following benefits:'],
        type: 'save_proficiency',
        automation: {
          type: 'save_proficiency',
          saveType: 'Strength',
          fallbackTypes: FALLBACK_LADDER,
        },
        featName: 'Resilient',
      },
    ]);
    expect(result.features[1].automation).toBe(row.automation); // direct row reference — the root of the mutation quirk

    // resolveFeatChosenAbility: no choices object → null → guard passes but nothing resolves.
    expect(row).toEqual(diskRow5e); // row untouched when unresolvable
    expect(result.abilityScoreIncreases).toEqual([
      {
        name: 'any',
        amount: 1,
        isChoice: true,
        description: 'Increase the chosen ability score by 1, to a maximum of 20.',
        max_value: 20,
        featName: 'Resilient',
        featDescription: ['Choose one ability score. You gain the following benefits:'],
      },
    ]);
    expect(result.proficiencies).toEqual([]);
    expect(result.resistances).toEqual([]);
  });

  it('resolves saveType from featAbilityChoices { assignment } on the "<Feat>-0" key — text feature updated fresh, row feature MUTATED in place (defect/quirk pin)', () => {
    formData.featAbilityChoices = { 'Resilient-0': { assignment: 'Dexterity' } };

    const result = computeAllFeatBuffs(formData, [row]);
    const feats = saveProfs(result);

    expect(feats).toHaveLength(2);
    expect(feats[0].automation).toEqual({ type: 'save_proficiency', saveType: 'Dexterity' });

    // QUIRK (featBuffService.js:626-627): the row-reference feature is mutated, and it IS
    // the passed row's cached automation object — saveType overwritten, fallbackTypes DELETED
    // straight onto the row.
    expect(feats[1].automation).toBe(row.automation);
    expect(row.automation).toEqual({ type: 'save_proficiency', saveType: 'Dexterity' });
  });

  it('resolves saveType from a plain-string choice value via the string branch, deleting fallbackTypes', () => {
    formData.featAbilityChoices = { 'Resilient-0': 'Constitution' };

    const result = computeAllFeatBuffs(formData, [row]);

    expect(saveProfs(result)[0].automation).toEqual({ type: 'save_proficiency', saveType: 'Constitution' });
    // Same row mutation as above — the string branch is not gentler to the cache.
    expect(row.automation).toEqual({ type: 'save_proficiency', saveType: 'Constitution' });
  });

  it('keeps Strength + intact fallback ladder when the choice key does not prefix-match the feat name', () => {
    formData.featAbilityChoices = { 'OtherFeat-0': { assignment: 'Wisdom' } };

    const result = computeAllFeatBuffs(formData, [row]);
    const feats = saveProfs(result);

    expect(feats[0].automation).toEqual({
      type: 'save_proficiency',
      saveType: 'Strength',
      fallbackTypes: FALLBACK_LADDER,
    });
    expect(feats[1].automation).toEqual({
      type: 'save_proficiency',
      saveType: 'Strength',
      fallbackTypes: FALLBACK_LADDER,
    });
    expect(row).toEqual(diskRow5e); // unresolvable → zero cache pollution
  });

  it('pins resolveFeatChosenAbility quirks: prefix match is loose (any "Resilient*" key wins, first-entry-wins for duplicates) and assignment is returned RAW (no normalization)', () => {
    // FT-094 canonical keys are "<Feat>-<idx>", but the implementation is startsWith +
    // first-entry + raw value. Pinning through this seam (abilityLookup has no own unit
    // canon): lowercase junk assignment reaches saveType verbatim AND onto the cached row.
    formData.featAbilityChoices = { 'Resilient-2': { assignment: 'dex' } };

    const result = computeAllFeatBuffs(formData, [row]);

    expect(saveProfs(result)[0].automation).toEqual({ type: 'save_proficiency', saveType: 'dex' });
    expect(row.automation).toEqual({ type: 'save_proficiency', saveType: 'dex' });
  });

  it('two Resilient entries with two choices still share ONE cached-row automation and both resolve to the FIRST choice entry (first-entry-wins, instance-2 choice is invisible)', () => {
    formData.feats = ['Resilient', 'Resilient'];
    formData.featAbilityChoices = {
      'Resilient-0': { assignment: 'Dexterity' },
      'Resilient-1': { assignment: 'Constitution' },
    };

    const result = computeAllFeatBuffs(formData, [row]);
    const feats = saveProfs(result);

    // 2 feats × (text feature + top-level automation feature) = 4.
    expect(feats).toHaveLength(4);
    expect(feats.map(f => f.automation.saveType)).toEqual(['Dexterity', 'Dexterity', 'Dexterity', 'Dexterity']);
    // The two row-derived features share the single mutated automation reference.
    expect(feats[1].automation).toBe(feats[3].automation);
    expect(feats[1].automation).toBe(row.automation);
    expect(row.automation).toEqual({ type: 'save_proficiency', saveType: 'Dexterity' });
  });
});

describe('computeAllFeatBuffs — 2024 Resilient (verbatim public/data/2024/feats.json row)', () => {
  let row;
  let formData;

  beforeEach(() => {
    row = cloneDeep(diskRow2024);
    formData = { rules: '2024', feats: ['Resilient'] };
  });

  it('routes the ONLY save_proficiency feature through the row reference (parse2024SavingThrow passthrough), unresolved it keeps Strength + exact fallback ladder and leaves the row pristine', () => {
    const result = computeAllFeatBuffs(formData, [row]);

    expect(result.features).toEqual([
      {
        name: 'Saving Throw Proficiency',
        description: 'You gain saving throw proficiency with the chosen ability.',
        type: 'saving_throw',
        automation: {
          type: 'save_proficiency',
          saveType: 'Strength',
          fallbackTypes: FALLBACK_LADDER,
        },
        featName: 'Resilient',
      },
    ]);
    expect(saveProfs(result)[0].automation).toBe(row.benefits[1].automation); // no fresh buffer in the 2024 lane
    expect(row).toEqual(diskRow2024);
    // ASI shape here is scores.length>2 → amount wrapped to [1] (envelope canon → #2018).
    expect(result.abilityScoreIncreases).toEqual([
      {
        name: 'any',
        amount: [1],
        isChoice: true,
        description: 'Choose one ability in which you lack saving throw proficiency. Increase the chosen ability score by 1, to a maximum of 20.',
        max_value: 20,
        featName: 'Resilient',
        featDescription: diskRow2024.description,
      },
    ]);
  });

  it('resolves saveType from featAbilityChoices by MUTATING the cached 2024 row itself — the only feature is the row reference (defect/quirk pin)', () => {
    formData.featAbilityChoices = { 'Resilient-0': { assignment: 'Constitution' } };

    const result = computeAllFeatBuffs(formData, [row]);

    expect(saveProfs(result)[0].automation).toEqual({ type: 'save_proficiency', saveType: 'Constitution' });
    // QUIRK (L626-627 via parse2024SavingThrow L334 reference): the write lands on
    // row.benefits[1].automation — in production the dataCache-cached feats row.
    expect(row.benefits[1].automation).toEqual({ type: 'save_proficiency', saveType: 'Constitution' });
    expect(row.benefits[1].automation.fallbackTypes).toBeUndefined();
  });
});

describe('computeAllFeatBuffs — SPA-cache persistence of the row mutation (no reload between calls)', () => {
  // Models production faithfully: dataLoader.loadData caches the parsed feats.json per
  // version for the whole SPA session (dataCache), so the same row object flows through
  // EVERY computeAllFeatBuffs call until reload. The same [cachedRow] array stands in
  // for the cached allFeats; real findFeat resolves by exact name.

  it('5e: second compute with a CHANGED choice returns split-brain saveTypes — fresh text feature follows the new choice, row feature is frozen at the first resolution (guard dead after fallbackTypes deleted)', () => {
    const cachedRow = cloneDeep(diskRow5e);

    const result1 = computeAllFeatBuffs(
      { rules: '5e', feats: ['Resilient'], featAbilityChoices: { 'Resilient-0': { assignment: 'Dexterity' } } },
      [cachedRow]
    );
    expect(result1.features.map(f => f.automation.saveType)).toEqual(['Dexterity', 'Dexterity']);

    // User changes the choice to Wisdom; no reload → same cached row object.
    const result2 = computeAllFeatBuffs(
      { rules: '5e', feats: ['Resilient'], featAbilityChoices: { 'Resilient-0': { assignment: 'Wisdom' } } },
      [cachedRow]
    );

    // DEFECT/QUIRK pin: within ONE result the two save_proficiency features DISAGREE.
    // Text-derived (fresh automation each parse) re-resolves to Wisdom; the row-derived
    // feature cannot re-resolve — fallbackTypes was deleted from the cached row on call 1,
    // so the L620-623 guard can never fire again for this row until reload.
    expect(result2.features.map(f => f.automation.saveType)).toEqual(['Wisdom', 'Dexterity']);
    expect(cachedRow.automation).toEqual({ type: 'save_proficiency', saveType: 'Dexterity' });
    expect(result2.features[1].automation).toBe(cachedRow.automation);
  });

  it('2024: a cleared choice NEVER reverts — the resolved saveType sticks to the cached row forever (guard needs fallbackTypes, gone after first resolution)', () => {
    const cachedRow = cloneDeep(diskRow2024);

    computeAllFeatBuffs(
      { rules: '2024', feats: ['Resilient'], featAbilityChoices: { 'Resilient-0': 'Constitution' } },
      [cachedRow]
    );

    // Wizard clears the selection entirely; disk default should return Strength — it cannot.
    const result = computeAllFeatBuffs({ rules: '2024', feats: ['Resilient'] }, [cachedRow]);

    // DEFECT/QUIRK pin: proficiency persists on the row even with NO active choice — the
    // saveType write survives and the guard is permanently disarmed for this cached row.
    expect(result.features).toHaveLength(1);
    expect(saveProfs(result)[0].automation).toEqual({ type: 'save_proficiency', saveType: 'Constitution' });
    expect(cachedRow.benefits[1].automation).toEqual({ type: 'save_proficiency', saveType: 'Constitution' });
  });
});

describe('fixture isolation', () => {
  it('after every mutation leg above, the imported disk rows are still pristine — every mutation stayed on per-test clones (no vitest-module-registry pollution)', () => {
    expect(diskRow5e.automation).toEqual({
      type: 'save_proficiency',
      saveType: 'Strength',
      fallbackTypes: FALLBACK_LADDER,
    });
    expect(diskRow2024.benefits[1].automation).toEqual({
      type: 'save_proficiency',
      saveType: 'Strength',
      fallbackTypes: FALLBACK_LADDER,
    });
  });
});
