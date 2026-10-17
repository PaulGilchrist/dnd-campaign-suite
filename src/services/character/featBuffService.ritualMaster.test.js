// @maintained-by-ai
// featBuffService.ritualMaster.test.js — LANE #9/9 (FINAL) of the featBuffService
// nine-lane cluster (queue #2016-2024) — CLOSURES the cluster. Subject: the
// ritual_spells automation threading seam of src/services/character/featBuffService.js:
// the aggregate resolver branch computeAllFeatBuffs L613-619 (ritual_spells +
// spellCastingAbility resolution), fed by the parse2024Spell passthrough (#2022's
// parser table, re-entered here only for the disk Ritual Master row) and consumed
// collector-side by the REAL automationCollector/Router/InfoBuilder (rules.js:255
// applyFeatBuffs → addFeatFeatures → collectAutomationFromFeatures — the exact
// collector my lane re-invokes with the feat-shaped feature; no rules.test.js mock
// home covers an UNMOCKED feat→ritualSpells bucket pass: every rules suite stubs
// computeAllFeatBuffs, e.g. rules.test.js:107).
//
// THREADS PINNED (this lane only):
//   1. computeFeatBuffs(disk Ritual Master, '2024'): parse2024Spell DEFAULT branch
//      (featBuffService.js:425-430 — automationType 'ritual_spells' is not free_spell,
//      name has no 'level 1') emits the spell feature with automation BY REFERENCE.
//   2. 5e attach negation (#2023 seam): the same disk row under ruleset '5e' attaches
//      NOTHING — benefits are objects (string-guard skips them) and disk Ritual Master
//      carries NO feat-level automation (verified), so the feat.automation attach
//      (L563-573) stays silent. ritual_spells rides the 2024 path ONLY.
//   3. Aggregate resolver branch L613-619: spellCastingAbility resolved via
//      resolveFeatChosenAbility (shared/abilityLookup.js:34-42) — ladder:
//      key startsWith(featName) → value {assignment} → plain-string value → null;
//      on non-null AND differing, automation is REPLACED via spread (L617) —
//      NON-mutating, unlike the saveType branch's in-place write (L626-627, #2021's
//      SPA-cache flag). Disk cached rows therefore stay intact through this lane.
//   4. Collector-side: threaded feature → collectAutomationFromFeatures (real, no
//      mocks) → automationInfoBuilder passiveHandlers.ritual_spells (passive.js:136-147,
//      normalizes quickRitual/chosenSpells via !! and spellCastingAbility via ''-fallback)
//      → routePassiveRule PASSIVE_RULE_SPECIAL_EFFECTS (automationRouter.js:94) →
//      EXACT ritualSpells bucket row, never duplicated into passives/specialActions.
//
// FIXTURE RE-ANCHOR (mandatory disk check done 2026-10-16): the former hand-typed
// RITUAL_MASTER_FEAT was FABRICATED-by-truncation — its automation and
// ability_score_increase blocks matched disk verbatim, but both benefit descriptions
// were cut mid-sentence and feat-level description/prerequisites/tags/index/
// repeatable were absent. Now anchored verbatim via the cluster's pickFeat/cloneDeep
// idiom (#2021/#2022) from public/data/2024/feats.json; expected shapes reference the
// disk row's own fields so drift fails loudly.
//
// SYNTHETIC PROBES (labeled, disk-unreachable): disk 2024/feats.json contains EXACTLY
// ONE ritual_spells automation row (Ritual Master/Ritual Spells, chosenSpells:true) —
// the chosenSpells-GUARD-FALSE side of the L614 branch is unreachable with disk data
// (also verified: public/data/5e feats.json has zero ritual rows). One labeled probe pins it.
//
// SHED: parser tables → #2022/#2023; aggregate envelope + featName stamping → #2018/19;
// saveType resolver + SPA-cache mutation → #2021; formData writer/clear → #2016/17.
//
// LIVENESS (verified by grep 2026-10-16): LIVE chain — bucket consumers:
// spellCalc2024.js:402/482/609 (ritual spell injection + Ritual Master chosen-spell
// gate), spellPreparationService.js:862 (quickRitualHold), restRules-longRest.js:695
// (Quick Ritual recharge), automationInfoBuilder/passive.js:136 (row builder). Tests
// restRules-longRest.ritualMaster.test.js / spellCalc2024-ritualMaster.test.js consume
// the bucket shape this lane produces upstream.
//
// No timers. findFeat mocked (computeAllFeatBuffs input seam); collector stays REAL.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneDeep } from 'lodash';

import feats2024 from '../../../public/data/2024/feats.json' with { type: 'json' };

import { findFeat } from '../shared/featFinder.js';
import { computeFeatBuffs, computeAllFeatBuffs } from './featBuffService.js';
import { collectAutomationFromFeatures } from '../combat/automation/automationCollector.js';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

const EMPTY = {
  abilityScoreIncreases: [],
  proficiencies: [],
  resistances: [],
  features: [],
};

const pickFeat = name => {
  const row = feats2024.find(f => f.name === name);
  if (!row) throw new Error(`public/data/2024/feats.json no longer contains '${name}' — re-anchor this lane`);
  return cloneDeep(row);
};

const diskBenefit = (feat, benefitName) => {
  const b = feat.benefits.find(x => typeof x === 'object' && x?.name === benefitName);
  if (!b) throw new Error(`disk row '${feat.name}' no longer has benefit '${benefitName}' — re-anchor this lane`);
  return b;
};

// Disk automation block, referenced (not retyped) so pins track the real row.
const RITUAL_AUTO = diskBenefit(pickFeat('Ritual Master'), 'Ritual Spells').automation;

describe('FT-068 Ritual Master — ritual_spells automation threading (lane #9/9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeFeatBuffs — disk row, parse2024Spell passthrough (2024 path)', () => {
    it('emits exactly the two ritual feature rows with the disk automation passed through BY REFERENCE', () => {
      const feat = pickFeat('Ritual Master');

      const buffs = computeFeatBuffs(feat, '2024');

      // Exact features array: the ASI benefit lands in abilityScoreIncreases, so the
      // features category is JUST the ritual pair — Quick Ritual stays a separate
      // utility row (its consumers read the quickRitual marker, not this row).
      expect(buffs.features).toEqual([
        {
          name: 'Ritual Spells',
          description: diskBenefit(feat, 'Ritual Spells').description,
          type: 'spell',
          automation: RITUAL_AUTO,
        },
        {
          name: 'Quick Ritual',
          description: diskBenefit(feat, 'Quick Ritual').description,
          type: 'utility',
          automation: undefined,
        },
      ]);

      // By-reference passthrough (L429): the SAME object, no copy, no spellCastingAbility
      // yet — that is attached downstream by the aggregate resolver branch.
      expect(buffs.features[0].automation).toBe(feat.benefits[1].automation);
      expect(buffs.features[0].automation).not.toHaveProperty('spellCastingAbility');
    });

    it('attaches NOTHING under ruleset 5e — object benefits skip the string loop and disk row has no feat-level automation', () => {
      const feat = pickFeat('Ritual Master');
      expect(feat.automation).toBeUndefined(); // disk guard for this pin

      expect(computeFeatBuffs(feat, '5e')).toEqual(EMPTY);
    });
  });

  describe('computeAllFeatBuffs — aggregate resolver branch L613-619 (spellCastingAbility ladder)', () => {
    const threaded = (featAbilityChoices, feat = pickFeat('Ritual Master')) => {
      findFeat.mockImplementation(name => (name === feat.name ? feat : null));
      return computeAllFeatBuffs(
        { rules: '2024', feats: ['Ritual Master'], featAbilityChoices },
        [feat]
      );
    };

    it('resolves { assignment } choice rows and replaces automation via spread, stamping featName', () => {
      const feat = pickFeat('Ritual Master');
      const result = threaded({ 'Ritual Master-2': { assignment: 'Charisma' } }, feat);

      expect(result.features).toHaveLength(2);
      const spellFeature = result.features.find(f => f.automation?.effect === 'ritual_spells');
      expect(spellFeature.featName).toBe('Ritual Master');
      expect(spellFeature.automation).toEqual({ ...RITUAL_AUTO, spellCastingAbility: 'Charisma' });
    });

    it('accepts a plain-string choice value as well as the { assignment } object form', () => {
      const result = threaded({ 'Ritual Master-2': 'Wisdom' });

      const spellFeature = result.features.find(f => f.automation?.effect === 'ritual_spells');
      expect(spellFeature.automation).toEqual({ ...RITUAL_AUTO, spellCastingAbility: 'Wisdom' });
    });

    it('leaves automation disk-verbatim when no choice exists or no key prefix-matches the feat name', () => {
      const absent = threaded(undefined);
      expect(absent.features.find(f => f.automation?.effect === 'ritual_spells').automation)
        .toEqual(RITUAL_AUTO);

      const wrongFeatKey = threaded({ 'Elemental Adept-0': { assignment: 'Intelligence' } });
      expect(wrongFeatKey.features.find(f => f.automation?.effect === 'ritual_spells').automation)
        .toEqual(RITUAL_AUTO);
    });

    it('is NON-mutating: spread-replacement (L617) never writes spellCastingAbility back onto the cached feat row', () => {
      // Unlike the saveType branch's in-place L626-627 write (#2021's SPA-cache flag),
      // this branch clones. rules.js:255 feeds findFeat from the SPA-cached feats.json
      // module, so a mutating ritual branch would poison every later consumer.
      const feat = pickFeat('Ritual Master');
      const snapshot = cloneDeep(feat);

      const result = threaded({ 'Ritual Master-2': { assignment: 'Charisma' } }, feat);

      expect(cloneDeep(feat)).toEqual(snapshot);
      const spellFeature = result.features.find(f => f.automation?.effect === 'ritual_spells');
      expect(spellFeature.automation).not.toBe(feat.benefits[1].automation);

      // SYNTHETIC probe — labeled: disk 2024/feats.json has exactly ONE ritual_spells
      // row (chosenSpells:true), so the chosenSpells-guard-false side of L614 is
      // disk-unreachable. A ritual_spells feature WITHOUT chosenSpells must NOT receive
      // a threaded spellCastingAbility, and the collector must normalize the missing
      // markers (passive.js:143-145: !! + ''-fallback).
      const syntheticFeat = {
        name: 'Ritual Master',
        benefits: [{
          name: 'Ritual Spells',
          type: 'spell',
          description: 'SYNTHETIC ritual_spells benefit without chosenSpells',
          automation: { type: 'ritual_spells', effect: 'ritual_spells', casting_time: 'passive' },
        }],
      };
      findFeat.mockReturnValue(syntheticFeat);
      const guarded = computeAllFeatBuffs(
        { rules: '2024', feats: ['Ritual Master'], featAbilityChoices: { 'Ritual Master-0': { assignment: 'Charisma' } } },
        []
      );
      expect(guarded.features).toHaveLength(1);
      expect(guarded.features[0].automation).toEqual(syntheticFeat.benefits[0].automation);

      const collected = collectAutomationFromFeatures(
        [{ name: guarded.features[0].name, type: guarded.features[0].type, automation: guarded.features[0].automation }],
        {}
      );
      expect(collected.ritualSpells).toEqual([
        {
          type: 'passive_rule',
          name: 'Ritual Spells',
          effect: 'ritual_spells',
          casting_time: 'passive',
          chosenSpells: false,
          quickRitual: false,
          spellCastingAbility: '',
          hasAutomation: true,
        },
      ]);
    });
  });

  describe('collector-side — real collector/router/builder (same call as rules.js addFeatFeatures)', () => {
    it('routes the threaded feat feature into the ritualSpells bucket as the exact builder row, never duplicated', () => {
      findFeat.mockImplementation(name => (name === 'Ritual Master' ? pickFeat('Ritual Master') : null));
      const buffs = computeAllFeatBuffs(
        { rules: '2024', feats: ['Ritual Master'], featAbilityChoices: { 'Ritual Master-2': { assignment: 'Charisma' } } },
        []
      );
      const spellFeature = buffs.features.find(f => f.automation?.effect === 'ritual_spells');

      // rules.js addFeatFeatures pushes { name, description, type, source, automation, featName }
      // into allFeatures, then collectAutomationFromFeatures(allFeatures, playerStats).
      const collected = collectAutomationFromFeatures(
        [{ name: spellFeature.name, type: spellFeature.type, automation: spellFeature.automation, featName: spellFeature.featName }],
        {}
      );

      // Exact row shape produced for every downstream consumer
      // (spellCalc2024.js:402-482 / spellPreparationService.js:862 / restRules-longRest.js:695).
      expect(collected.ritualSpells).toEqual([
        {
          type: 'passive_rule',
          name: 'Ritual Spells',
          effect: 'ritual_spells',
          casting_time: 'passive',
          chosenSpells: true,
          quickRitual: true,
          spellCastingAbility: 'Charisma',
          hasAutomation: true,
        },
      ]);
      // routePassiveRule returns early on a special bucket — no double-listing.
      expect(collected.passives).toEqual([]);
      expect(collected.specialActions).toEqual([]);
      expect(collected.actions).toEqual([]);
      expect(collected.bonusActions).toEqual([]);
      expect(collected.reactions).toEqual([]);
    });
  });
});
