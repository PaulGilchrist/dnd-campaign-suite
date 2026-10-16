// featBuffService.computeFeatBuffs.2024.test.js — LANE #7/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject seam: computeFeatBuffs (featBuffService.js:531-577),
// 2024 STRUCTURED path. Canonical seam map lives in the lane #1 header
// (featBuffService.applyFeatBuffsToFormData.test.js, #2016 law); envelope/stamp canon #2018
// and resolver+mutation canon #2021 — READ FIRST.
//
// THIS LANE CONTRACT (#2022): the single-feat parser for benefits that are STRUCTURED objects
// (2024 rows: {name, description, type, automation?}). Pinned here, parser-internals canon:
//   - BENEFIT_PARSERS_2024 DISPATCH TABLE (L506-513): exactly six dedicated parsers
//     (ability_score_increase, proficiency, resistance, saving_throw, damage, spell); every
//     other benefit.type (verified disk enumeration: passive, utility, action, bonus_action,
//     reaction, movement, special, condition, heroic_inspiration_buff) routes through
//     parse2024OtherBenefit's name-rewrite probes + default passthrough (L447-504).
//   - L543 SKIP GUARD (#2018 citation: 'skip benefits without type' is OURS): a benefit must
//     be a non-null object with truthy .type or it contributes NOTHING. Disk-proven by Alert,
//     whose 3 benefits are bare STRINGS on disk — the whole feat parses to an empty envelope,
//     and its feat-level automation array is NEVER attached on the 2024 path (that attachment
//     at L563-573 is the 5e branch, #2019/#2023 territory).
//   - amount:[1] MULTI-SCORE ODDITY (#2018 citation: YOURS — pinned honestly, as-is): any ASI
//     with scores.length > 2 wraps a plain numeric amount into a [1]-array (L156-165); the
//     'variable' sentinel becomes [1, 2] (L145-154). Fey Touched / Skill Expert / epic boons
//     hit this on disk every parse. 2-score ASIs stay scalar with a scores[] array.
//   - MULTI-BENEFIT SINGLE FEAT: #2018 shed its fabricated near-clones of this lane's old
//     body (its old leg3 was a verbatim clone of this file's old L1132) and cites HERE as
//     owner — kept-here ownership verified and STRENGTHENED: former length-only assertions
//     replaced with exact per-category envelopes from verbatim disk rows (Durable, Magic
//     Initiate, Observant, Skill Expert, Boon Of Skill).
//   - benefits never reach `resistances` on this path (parse2024Resistance routes into
//     `features`; structural envelope pin is #2018, the per-benefit shape is ours).
//
// AUTOMATION THREADING (this seam only): automation passes through BY REFERENCE on
// passthrough branches (pinned below) and disk rows are NOT mutated here. The computeAllFeatBuffs
// saveType resolver that CONSUMES fallbackTypes and mutates cached rows (L620-628) is #2021 —
// NOT duplicated here; we pin that parse output keeps fallbackTypes INTACT (Resilient row).
//
// FIXTURES: verbatim rows from public/data/2024/feats.json (mandatory disk check done
// 2026-10-16), cloneDeep per pick (#2021 idiom) so no pin mutates the imported module.
// Former hand-typed fixtures corrected against disk: Defy Death/Speedy Recovery live on
// Durable (NOT Tough, whose only disk benefit is 'Increased Hit Points'); Brew Poison is
// type 'passive' with brew_poison automation (NOT a bonus_action carrying proficiency text);
// Resilient's saving_throw automation is save_proficiency/Strength+fallbackTypes (NOT
// saving_throw_proficiency/Constitution); the Tavern Brawler damage benefit is 'Damage Rerolls'.
// SYNTHETIC probes remain ONLY for branches disk data cannot reach, each labeled in-test:
// non-numeric ASI amounts (disk amounts are int|variable only), bonus_action-with-proficiency
// text (0 of 11 disk bonus_action benefits match), resistance/saving_throw without automation
// (disk resistance/saving_throw benefits all carry automation), weapon_mastery_choice and the
// non-damage 'Savage Strike' name (absent from disk), 'Level 1'-named spell with non-free_spell
// automation (branch-order probe L395→L404).
//
// SHED: aggregate envelope + featName/featDescription stamping → #2018; 5e text rules
// (first-match-wins + Passive Benefit fallback) → #2023; saveType resolution / SPA-cache
// mutation → #2021; ritual_spells threading → #2024; formData writer → #2016.
//
// LIVENESS (verified by grep 2026-10-16): LIVE — FeatItemDetails.jsx:18 calls
// computeFeatBuffs(feat, ruleset) directly for the wizard feat detail pane, and every
// computeAllFeatBuffs call (rules.js:255 PlayerStats build, useWizardFeatBuffs.js:83,
// useWizardFeatAbilityChoices.js:117/182) routes through it per feat (L597).
// No timers, no spies (parser is pure — nothing to restore), exact envelopes only.

import { describe, it, expect } from 'vitest';
import { cloneDeep } from 'lodash';

import feats2024 from '../../../public/data/2024/feats.json' with { type: 'json' };

import { computeFeatBuffs } from './featBuffService.js';

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

describe('computeFeatBuffs — 2024 structured path (single-feat parser)', () => {
  describe('entry guards (L539)', () => {
    it('returns the empty four-category envelope for null, undefined, and benefit-less feats', () => {
      expect(computeFeatBuffs(null, '2024')).toEqual(EMPTY);
      expect(computeFeatBuffs(undefined, '2024')).toEqual(EMPTY);
      expect(computeFeatBuffs({}, '2024')).toEqual(EMPTY);
    });

    it('returns the empty envelope when benefits is not an array or is empty', () => {
      expect(computeFeatBuffs({ benefits: 'not-an-array' }, '2024')).toEqual(EMPTY);
      expect(computeFeatBuffs({ benefits: [] }, '2024')).toEqual(EMPTY);
    });
  });

  describe('L543 benefit guard — skip benefits without type (#2018 citation: OURS)', () => {
    it('parses the disk Alert row (3 bare-string benefits) to a fully empty envelope — strings skipped, feat-level automation NEVER attached on the 2024 path', () => {
      const alert = pickFeat('Alert');
      // Disk sanity: Alert's benefits really are strings and it does carry feat-level automation.
      expect(alert.benefits.every(b => typeof b === 'string')).toBe(true);
      expect(Array.isArray(alert.automation)).toBe(true);

      expect(computeFeatBuffs(alert, '2024')).toEqual(EMPTY);
    });

    it('skips null entries and objects without type; only the typed benefit parses (SYNTHETIC guard shape)', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: 'Valid' },
            { description: 'No type' },
            null,
            'string benefit',
            42,
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: false, description: 'Valid', max_value: 20 },
      ]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });
  });

  describe('ability_score_increase parsing (feat-level config is disk canon — 70/71 rows carry it)', () => {
    it('single-score ASI parses non-choice, verbatim disk Great Weapon Master', () => {
      const feat = pickFeat('Great Weapon Master');
      const asiBenefit = diskBenefit(feat, 'Ability Score Increase');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'Strength',
          amount: 1,
          isChoice: false,
          description: asiBenefit.description, // 'Increase your Strength score by 1, to a maximum of 20.'
          max_value: 20,
        },
      ]);
      expect(result.resistances).toEqual([]);
    });

    it('two-score ASI stays scalar with a scores[] array, verbatim disk Poisoner', () => {
      const feat = pickFeat('Poisoner');
      const asiBenefit = diskBenefit(feat, 'Ability Score Increase');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          scores: ['Dexterity', 'Intelligence'],
          description: asiBenefit.description,
          max_value: 20,
        },
      ]);
    });

    it('multi-score ASI wraps a plain numeric amount into [1] — amount:[1] oddity pinned as-is (#2018 citation: OURS, L156-165)', () => {
      const feat = pickFeat('Fey Touched');
      const asiBenefit = diskBenefit(feat, 'Ability Score Increase');
      expect(feat.ability_score_increase).toEqual({
        scores: ['Intelligence', 'Wisdom', 'Charisma'],
        amount: 1,
        max_value: 20,
      });

      const result = computeFeatBuffs(feat, '2024');

      // No scores[] on this branch (contrast the 2-score leg): just name:'any' + [amount].
      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: [1],
          isChoice: true,
          description: asiBenefit.description, // 'Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20.'
          max_value: 20,
        },
      ]);
    });

    it("'variable' ASI amount parses to the [1, 2] range, verbatim disk Ability Score Improvement", () => {
      const feat = pickFeat('Ability Score Improvement');
      const asiBenefit = diskBenefit(feat, 'Ability Score Increase');
      expect(feat.ability_score_increase.amount).toBe('variable');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description: asiBenefit.description, // 'Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1.'
          max_value: 20,
        },
      ]);
    });

    it('respects max_value 30 through the multi-score branch, verbatim disk Boon Of Fortitude', () => {
      const feat = pickFeat('Boon Of Fortitude');
      const asiBenefit = diskBenefit(feat, 'Ability Score Increase');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: [1],
          isChoice: true,
          description: asiBenefit.description, // 'Increase one ability score of your choice by 1, to a maximum of 30.'
          max_value: 30,
        },
      ]);
    });

    it('silently skips when the ASI config is absent (disk Tough carries ability_score_increase:null) while its passive benefit still parses', () => {
      const feat = pickFeat('Tough');
      const hpBenefit = diskBenefit(feat, 'Increased Hit Points');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.features).toEqual([
        {
          name: 'Increased Hit Points',
          description: hpBenefit.description,
          type: 'passive',
          automation: hpBenefit.automation, // passive_buff / max_hp_increase / '2 * level', passed through
        },
      ]);
    });

    it('coerces non-numeric ASI amounts to 1 and passes array amounts through (SYNTHETIC — disk amounts are int|variable only)', () => {
      const single = computeFeatBuffs(
        { benefits: [{ type: 'ability_score_increase', description: '+? STR' }], ability_score_increase: { scores: ['Strength'], amount: 'unknown' } },
        '2024'
      );
      expect(single.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: false, description: '+? STR', max_value: 20 },
      ]);

      const pair = computeFeatBuffs(
        { benefits: [{ type: 'ability_score_increase', description: '+? STR/DEX' }], ability_score_increase: { scores: ['Strength', 'Dexterity'], amount: 'unknown' } },
        '2024'
      );
      expect(pair.abilityScoreIncreases).toEqual([
        { name: 'any', amount: 1, isChoice: true, scores: ['Strength', 'Dexterity'], description: '+? STR/DEX', max_value: 20 },
      ]);

      const multiArray = computeFeatBuffs(
        { benefits: [{ type: 'ability_score_increase', description: 'Multi ASI' }], ability_score_increase: { scores: ['Strength', 'Dexterity', 'Constitution'], amount: [1, 2] } },
        '2024'
      );
      expect(multiArray.abilityScoreIncreases).toEqual([
        { name: 'any', amount: [1, 2], isChoice: true, description: 'Multi ASI', max_value: 20 },
      ]);
    });
  });

  describe('proficiency parsing (all disk verbatim)', () => {
    it('splits all-skills vs generic-expertise across the two disk Boon Of Skill benefits, dropping both automations', () => {
      const feat = pickFeat('Boon Of Skill');
      const adept = diskBenefit(feat, 'All-Around Adept');
      const expertise = diskBenefit(feat, 'Expertise');
      // Disk sanity: both benefits carry passive_buff automations that the parser DISCARDS here.
      expect(adept.automation.type).toBe('passive_buff');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: [1],
          isChoice: true,
          description: diskBenefit(feat, 'Ability Score Increase').description,
          max_value: 30,
        },
      ]);
      // 'You gain proficiency in all skills.' → hardcoded all_skills sentinel (name rewrite).
      expect(result.proficiencies).toEqual([{ name: 'all_skills', type: 'skill' }]);
      // 'Choose one skill in which you lack Expertise…' has no 'proficiency' word → no broad-list
      // match → falls through as an expertise FEATURE, not a proficiency choice.
      expect(result.features).toEqual([
        { name: 'Expertise', description: expertise.description, type: 'expertise' },
      ]);
    });

    it('improvised weapons rewrite verbatim disk Tavern Brawler benefit text', () => {
      const feat = pickFeat('Tavern Brawler');
      const disc = computeFeatBuffs(feat, '2024');

      expect(disc.proficiencies).toEqual([
        { name: 'Improvised Weapons', type: 'proficiency' }, // from 'Improvised Weaponry': 'You have proficiency with improvised weapons.'
      ]);
    });

    it('falls back to a generic {name, type} proficiency when no pattern matches, verbatim disk Chef', () => {
      const feat = pickFeat('Chef');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.proficiencies).toEqual([
        { name: "Cook's Utensils", type: 'proficiency' }, // benefit name passed through verbatim, NOT capitalized-parsed from text
      ]);
    });

    it('recognizes Martial weapons keyword verbatim, and Simple weapons on a SYNTHETIC row (no disk counterpart)', () => {
      const martial = computeFeatBuffs(pickFeat('Martial Weapon Training'), '2024');
      expect(martial.proficiencies).toEqual([
        { name: 'Martial Weapons', type: 'proficiency' },
      ]);

      const simple = computeFeatBuffs(
        { benefits: [{ type: 'proficiency', name: 'Weapon Proficiency', description: 'You gain proficiency with Simple weapons.' }] },
        '2024'
      );
      expect(simple.proficiencies).toEqual([
        { name: 'Simple Weapons', type: 'proficiency' },
      ]);
    });

    it('parses armor training with and without shields, verbatim disk Heavily/Lightly Armored', () => {
      const heavy = computeFeatBuffs(pickFeat('Heavily Armored'), '2024');
      expect(heavy.proficiencies).toEqual([
        { name: 'Heavy Armor', type: 'proficiency' }, // 'You gain training with Heavy armor.'
      ]);

      const light = computeFeatBuffs(pickFeat('Lightly Armored'), '2024');
      expect(light.proficiencies).toEqual([
        { name: 'Light Armor', type: 'proficiency' },
        { name: 'Shields', type: 'proficiency' }, // 'You gain training with Light armor and Shields.' → two entries
      ]);
    });

    it('parses expertise with a specific skill list into a proficiency choice, verbatim disk Observant Keen Observer', () => {
      const feat = pickFeat('Observant');
      const keen = diskBenefit(feat, 'Keen Observer');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.proficiencies).toEqual([
        {
          name: 'Keen Observer',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['Insight, Investigation, Perception'], // 'or' connector stripped, list re-joined
          grantsExpertise: true,
        },
      ]);
      expect(keen.type).toBe('proficiency');
    });

    it('parses broad expertise selection into the full 18-skill list, verbatim disk Skill Expert Expertise', () => {
      const feat = pickFeat('Skill Expert');
      const expertise = diskBenefit(feat, 'Expertise');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.proficiencies[1]).toEqual({
        name: 'Expertise',
        type: 'proficiency',
        isChoice: true,
        choose: 1,
        from: ['Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival'],
        grantsExpertise: true,
      });
      expect(expertise.description).toBe('Choose one skill in which you have proficiency but lack Expertise. You gain Expertise with that skill.');
    });

    it('parses numeric count + from-list choices, verbatim disk Crafter, Skilled, Musician', () => {
      const crafter = computeFeatBuffs(pickFeat('Crafter'), '2024');
      expect(crafter.proficiencies).toEqual([
        { name: 'Tool Proficiency', type: 'proficiency', isChoice: true, choose: 3, from: ["Artisan's Tools"] },
      ]);

      const skilled = computeFeatBuffs(pickFeat('Skilled'), '2024');
      expect(skilled.proficiencies).toEqual([
        { name: 'Proficiency', type: 'proficiency', isChoice: true, choose: 3, from: ['skills or tools'] },
      ]);

      const musician = computeFeatBuffs(pickFeat('Musician'), '2024');
      expect(musician.proficiencies).toEqual([
        { name: 'Instrument Training', type: 'proficiency', isChoice: true, choose: 3, from: ['Musical Instruments'] },
      ]);
    });
  });

  describe('resistance benefit parsing (disk has exactly 2 resistance rows; both route to features, never resistances[])', () => {
    it('parses non-empty validTypes into a resistance_choice with count derived from resistanceType, verbatim disk Boon Of Energy Resistance', () => {
      const feat = pickFeat('Boon Of Energy Resistance');
      const ben = diskBenefit(feat, 'Energy Resistances');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.resistances).toEqual([]); // structural shed to #2018: 2024 path never fills resistances
      // The same disk row also carries a 'reaction' benefit → default passthrough (bonus coverage).
      expect(result.features).toHaveLength(2);
      expect(result.features[0]).toEqual({
        name: 'Energy Resistances',
        description: ben.description,
        type: 'resistance_choice',
        automation: {
          ...ben.automation, // boon_of_energy_resistance passthrough
          count: 2, // 'player_choice_2_from_list' → strip prefix/suffix → parseInt('2')
          validTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'],
        },
      });
      expect(result.features[1]).toEqual({
        name: 'Energy Redirection',
        description: diskBenefit(feat, 'Energy Redirection').description,
        type: 'reaction', // not in BENEFIT_PARSERS_2024 → default passthrough
        automation: diskBenefit(feat, 'Energy Redirection').automation,
      });
    });

    it('parses automation WITHOUT validTypes as a plain resistance feature, verbatim disk Heavy Armor Master', () => {
      const feat = pickFeat('Heavy Armor Master');
      const ben = diskBenefit(feat, 'Damage Reduction');

      const result = computeFeatBuffs(feat, '2024');

      const damageReduction = result.features.find(f => f.name === 'Damage Reduction');
      expect(damageReduction).toEqual({
        name: 'Damage Reduction',
        description: ben.description,
        type: 'resistance',
        automation: ben.automation, // damage_reduction / proficiency_bonus, passed through
      });
      expect(result.resistances).toEqual([]);
    });

    it('parses a resistance WITHOUT automation as a bare resistance feature (SYNTHETIC — every disk resistance carries automation)', () => {
      const result = computeFeatBuffs(
        { benefits: [{ type: 'resistance', name: 'Poison Resist', description: 'Resistance to poison' }] },
        '2024'
      );

      expect(result.features).toEqual([
        { name: 'Poison Resist', description: 'Resistance to poison', type: 'resistance' },
      ]);
    });
  });

  describe('saving_throw benefit parsing (disk has exactly 2 saving_throw rows, both with automation)', () => {
    it('passes the Resilient disk benefit through with fallbackTypes INTACT and automation BY REFERENCE — the resolver that consumes them lives in computeAllFeatBuffs (#2021), not here', () => {
      const feat = pickFeat('Resilient');
      const ben = diskBenefit(feat, 'Saving Throw Proficiency');
      const snapshot = cloneDeep(feat);

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toEqual([
        {
          name: 'Saving Throw Proficiency',
          description: 'You gain saving throw proficiency with the chosen ability.',
          type: 'saving_throw',
          automation: {
            type: 'save_proficiency',
            saveType: 'Strength',
            fallbackTypes: ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
          },
        },
      ]);
      // Passthrough is by reference (this is the surface #2021's cached-row mutation rides on),
      // but computeFeatBuffs itself never writes to the row.
      expect(result.features[0].automation).toBe(ben.automation);
      expect(cloneDeep(feat)).toEqual(snapshot);
      // Its 6-score ASI goes through the amount:[1] branch too.
      expect(result.abilityScoreIncreases[0]).toMatchObject({ name: 'any', amount: [1], max_value: 20 });
    });

    it('passes the Mage Slayer auto_reroll saving_throw benefit through verbatim', () => {
      const feat = pickFeat('Mage Slayer');
      const ben = diskBenefit(feat, 'Guarded Mind');

      const result = computeFeatBuffs(feat, '2024');

      const guarded = result.features.find(f => f.name === 'Guarded Mind');
      expect(guarded).toEqual({
        name: 'Guarded Mind',
        description: ben.description,
        type: 'saving_throw',
        automation: ben.automation, // auto_reroll / override_fail_to_success, passed through
      });
    });

    it('SKIPS a saving_throw without automation but keeps a bare resistance (SYNTHETIC guards — asymmetric early-return L329 vs L292)', () => {
      const skipped = computeFeatBuffs(
        { benefits: [{ type: 'saving_throw', name: 'Bare Save', description: 'Saving throw proficiency' }] },
        '2024'
      );
      expect(skipped).toEqual(EMPTY);

      const kept = computeFeatBuffs(
        { benefits: [{ type: 'resistance', name: 'Bare Resist', description: 'Resistance to poison' }] },
        '2024'
      );
      expect(kept.features).toEqual([
        { name: 'Bare Resist', description: 'Resistance to poison', type: 'resistance' },
      ]);
    });
  });

  describe('damage benefit parsing (name-rewrite table, all disk verbatim)', () => {
    it('reroll_damage_once_per_turn automation rewrites the benefit name to Savage Attacker', () => {
      const feat = pickFeat('Savage Attacker');
      const ben = diskBenefit(feat, 'Savage Strike');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toEqual([
        {
          name: 'Savage Attacker', // disk benefit is 'Savage Strike' — hardcoded rewrite
          description: ben.description,
          type: 'reroll_damage_once_per_turn',
          automation: { type: 'reroll_damage_once_per_turn' },
        },
      ]);
    });

    it("'Damage Die Reroll' benefit name maps to Great Weapon Fighting with hardcoded automation", () => {
      const feat = pickFeat('Great Weapon Fighting');
      const ben = diskBenefit(feat, 'Damage Die Reroll');
      expect(ben.automation).toBeUndefined(); // disk carries no automation — parser supplies it

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toEqual([
        {
          name: 'Great Weapon Fighting',
          description: ben.description,
          type: 'great_weapon_fighting',
          automation: { type: 'great_weapon_fighting' },
        },
      ]);
    });

    it('Enhanced Unarmed Strike keeps type damage and passes the attack_rider automation through, verbatim disk Unarmed Fighting', () => {
      const feat = pickFeat('Unarmed Fighting');
      const ben = diskBenefit(feat, 'Enhanced Unarmed Strike');

      const result = computeFeatBuffs(feat, '2024');

      const unarmed = result.features.find(f => f.name === 'Enhanced Unarmed Strike');
      expect(unarmed).toEqual({
        name: 'Enhanced Unarmed Strike',
        description: ben.description,
        type: 'damage',
        automation: ben.automation, // attack_rider 1d6/1d8 options, passed through
      });
    });

    it("'Extra Attack Damage' (disk Two Weapon Fighting) and 'Dual Wielding' (disk Crossbow Expert) both rewrite to two_weapon_fighting with hardcoded automation", () => {
      const twf = computeFeatBuffs(pickFeat('Two Weapon Fighting'), '2024');
      const extra = diskBenefit(pickFeat('Two Weapon Fighting'), 'Extra Attack Damage');
      expect(twf.features).toEqual([
        {
          name: 'Two Weapon Fighting',
          description: extra.description,
          type: 'two_weapon_fighting',
          automation: { type: 'two_weapon_fighting' },
        },
      ]);

      const cw = pickFeat('Crossbow Expert');
      const dual = diskBenefit(cw, 'Dual Wielding');
      const cwResult = computeFeatBuffs(cw, '2024');
      const dualFeature = cwResult.features.find(f => f.name === 'Dual Wielding');
      expect(dualFeature).toEqual({
        name: 'Dual Wielding', // this branch preserves the benefit name
        description: dual.description,
        type: 'two_weapon_fighting',
        automation: { type: 'two_weapon_fighting' }, // disk automation is null — parser supplies it
      });
    });

    it('passes an unrecognized damage benefit through with its own automation, verbatim disk Piercer Puncture', () => {
      const feat = pickFeat('Piercer');
      const puncture = diskBenefit(feat, 'Puncture');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toEqual([
        { name: 'Puncture', description: puncture.description, type: 'damage', automation: puncture.automation },
        expect.objectContaining({ name: 'Enhanced Critical', type: 'damage' }),
      ]);
    });
  });

  describe('spell benefit parsing', () => {
    it('free_spell automation passes through on the first dispatch branch, verbatim disk Fey Magic', () => {
      const feat = pickFeat('Fey Touched');
      const ben = diskBenefit(feat, 'Fey Magic');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toEqual([
        { name: 'Fey Magic', description: ben.description, type: 'free_spell', automation: ben.automation },
      ]);
      // Branch-order probe (SYNTHETIC): name says 'Level 1' with a NON-free_spell automation →
      // still routes free_spell via the L404 name branch when the automation type doesn't match.
      const levelOne = computeFeatBuffs(
        { benefits: [{ type: 'spell', name: 'Level 1 Spell', description: 'Spell benefit', automation: { type: 'some_spell' } }] },
        '2024'
      );
      expect(levelOne.features).toEqual([
        { name: 'Level 1 Spell', description: 'Spell benefit', type: 'free_spell', automation: { type: 'some_spell' } },
      ]);
    });

    it('Minor Telekinesis (disk automation:null) gets the parser-FABRICATED mage-hand automation', () => {
      const feat = pickFeat('Telekinesis');
      const ben = diskBenefit(feat, 'Minor Telekinesis');
      expect(ben.automation).toBeUndefined(); // disk sanity: automation is invented here

      const result = computeFeatBuffs(feat, '2024');

      const minor = result.features.find(f => f.name === 'Minor Telekinesis');
      expect(minor).toEqual({
        name: 'Minor Telekinesis',
        description: ben.description,
        type: 'spell',
        automation: { type: 'minor_telekinesis_spell', spell: 'Mage Hand' },
      });
    });
  });

  describe('bonus_action and passive parsing', () => {
    it('bonus_action always carries isBonusAction:true, verbatim disk Durable Speedy Recovery', () => {
      const feat = pickFeat('Durable');
      const ben = diskBenefit(feat, 'Speedy Recovery');

      const result = computeFeatBuffs(feat, '2024');

      const speedy = result.features.find(f => f.name === 'Speedy Recovery');
      expect(speedy).toEqual({
        name: 'Speedy Recovery',
        description: ben.description,
        type: 'bonus_action',
        automation: ben.automation, // self_healing / hit_die_roll, passed through
        isBonusAction: true,
      });
    });

    it('bonus_action descriptions matching the proficiency pattern append a NAME-ONLY proficiency (SYNTHETIC — 0 of 11 disk bonus_action benefits carry proficiency text)', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'bonus_action', name: "Poisoner's Bonus", description: "You gain proficiency with Smith's tools. Use them faster." },
          ],
        },
        '2024'
      );

      // Note the shape asymmetry: no type:'proficiency' key on this path (vs parse2024Proficiency).
      expect(result.proficiencies).toEqual([{ name: "Smith's tools" }]);
      expect(result.features).toEqual([
        {
          name: "Poisoner's Bonus",
          description: "You gain proficiency with Smith's tools. Use them faster.",
          type: 'bonus_action',
          automation: undefined,
          isBonusAction: true,
        },
      ]);
    });

    it('passive automations pass through verbatim — disk Durable Defy Death and Poisoner Potent Poison', () => {
      const durable = computeFeatBuffs(pickFeat('Durable'), '2024');
      const defy = diskBenefit(pickFeat('Durable'), 'Defy Death');
      expect(durable.features.find(f => f.name === 'Defy Death')).toEqual({
        name: 'Defy Death',
        description: defy.description,
        type: 'passive',
        automation: defy.automation, // conditional_advantage / death_saving_throws
      });

      const poisonerFeat = pickFeat('Poisoner');
      const poisoner = computeFeatBuffs(poisonerFeat, '2024');
      const potent = diskBenefit(poisonerFeat, 'Potent Poison');
      expect(poisoner.features.find(f => f.name === 'Potent Poison')).toEqual({
        name: 'Potent Poison',
        description: potent.description,
        type: 'passive',
        automation: potent.automation, // ignore_resistance / ['Poison']
      });
    });
  });

  describe('parse2024OtherBenefit — default dispatch for non-table benefit.types', () => {
    it('passes unrecognized benefit.type (utility) through with its automation, verbatim disk Lucky', () => {
      const feat = pickFeat('Lucky');
      const luck = diskBenefit(feat, 'Luck Points');
      const adv = diskBenefit(feat, 'Advantage');
      const dis = diskBenefit(feat, 'Disadvantage');

      const result = computeFeatBuffs(feat, '2024');

      // 'utility' is NOT in BENEFIT_PARSERS_2024 and matches no name probe → default passthrough.
      expect(result.features).toEqual([
        { name: 'Luck Points', description: luck.description, type: 'passive', automation: luck.automation },
        { name: 'Advantage', description: adv.description, type: 'utility', automation: adv.automation },
        { name: 'Disadvantage', description: dis.description, type: 'utility', automation: dis.automation },
      ]);
    });

    it('rewrites Tavern Brawler name probes (Damage Rerolls→Tavern Brawler Damage Reroll, Push→Tavern Brawler Push) and never attaches the feat-level automation on the 2024 path', () => {
      const feat = pickFeat('Tavern Brawler');
      const reroll = diskBenefit(feat, 'Damage Rerolls');
      const push = diskBenefit(feat, 'Push');
      // Disk sanity: feat-level automation exists and must NOT surface on this path.
      expect(feat.automation.type).toBe('passive_rule');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.proficiencies).toEqual([
        { name: 'Improvised Weapons', type: 'proficiency' },
      ]);
      expect(result.features).toEqual([
        // Enhanced Unarmed Strike hits the damage-table name probe first (disk omits the automation key → parser pushes automation:undefined).
        { name: 'Enhanced Unarmed Strike', description: diskBenefit(feat, 'Enhanced Unarmed Strike').description, type: 'damage', automation: undefined },
        // 'Damage Rerolls' (disk name, plural) substring-matches 'Damage Reroll' → hardcoded rewrite.
        { name: 'Tavern Brawler Damage Reroll', description: reroll.description, type: 'passive', automation: { type: 'tavern_brawler_reroll_ones' } },
        // type 'action' + name includes 'Push' → hardcoded push automation.
        { name: 'Tavern Brawler Push', description: push.description, type: 'action', automation: { type: 'tavern_brawler_push', oncePerTurn: true } },
      ]);
    });

    it('falls back to FEAT-level automation when the benefit has none, verbatim disk Medium Armor Master', () => {
      const feat = pickFeat('Medium Armor Master');
      const wearer = diskBenefit(feat, 'Dexterous Wearer');
      expect(wearer.automation).toBeUndefined(); // disk sanity

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toEqual([
        { name: 'Dexterous Wearer', description: wearer.description, type: 'passive', automation: feat.automation }, // L502 `benefit.automation || feat.automation`
      ]);
    });

    it('fires the remaining name/automation probes on shapes disk cannot reach (SYNTHETIC)', () => {
      // A NON-damage-typed 'Savage Strike' (disk Savage Strike is type damage, covered above).
      const savage = computeFeatBuffs(
        { benefits: [{ type: 'action', name: 'Savage Strike', description: 'Extra damage on strike' }] },
        '2024'
      );
      expect(savage.features).toEqual([
        { name: 'Savage Attacker', description: 'Extra damage on strike', type: 'reroll_damage_once_per_turn', automation: { type: 'reroll_damage_once_per_turn' } },
      ]);

      // weapon_mastery_choice: absent from disk 2024 feats.json entirely.
      const mastery = computeFeatBuffs(
        { benefits: [{ type: 'action', name: 'Mastery Property', description: 'Weapon mastery', automation: { type: 'weapon_mastery_choice' } }] },
        '2024'
      );
      expect(mastery.features).toEqual([
        { name: 'Mastery Property', description: 'Weapon mastery', type: 'passive', automation: { type: 'weapon_mastery_choice' } },
      ]);
    });
  });

  describe('multi-benefit single feat (#2018 shed→HERE: kept-here ownership, exact envelopes, disk verbatim)', () => {
    it('parses the disk Durable row across all three categories with defaults arg omitting ruleset (L531 default is 2024)', () => {
      const feat = pickFeat('Durable');
      const asi = diskBenefit(feat, 'Ability Score Increase');
      const defy = diskBenefit(feat, 'Defy Death');
      const speedy = diskBenefit(feat, 'Speedy Recovery');

      const result = computeFeatBuffs(feat); // ruleset defaults to '2024'

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Constitution', amount: 1, isChoice: false, description: asi.description, max_value: 20 },
      ]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([
        { name: 'Defy Death', description: defy.description, type: 'passive', automation: defy.automation },
        { name: 'Speedy Recovery', description: speedy.description, type: 'bonus_action', automation: speedy.automation, isBonusAction: true },
      ]);
    });

    it('parses the disk Magic Initiate row: free_spell dispatch beats the Level 1 name probe, automation-less spell and utility use the default passthrough', () => {
      const feat = pickFeat('Magic Initiate');
      const cantrips = diskBenefit(feat, 'Two Cantrips');
      const levelOne = diskBenefit(feat, 'Level 1 Spell');
      const change = diskBenefit(feat, 'Spell Change');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([]); // ASI config is null on this origin feat
      expect(result.features).toEqual([
        { name: 'Two Cantrips', description: cantrips.description, type: 'spell', automation: cantrips.automation }, // automation:undefined passthrough
        { name: 'Level 1 Spell', description: levelOne.description, type: 'free_spell', automation: levelOne.automation }, // free_spell first branch
        { name: 'Spell Change', description: change.description, type: 'utility', automation: change.automation }, // default dispatch
      ]);
    });

    it('parses the disk Observant row: two-score ASI + expertise choice + bonus action, one feat three parsers', () => {
      const feat = pickFeat('Observant');
      const asi = diskBenefit(feat, 'Ability Score Increase');
      const search = diskBenefit(feat, 'Quick Search');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'any', amount: 1, isChoice: true, scores: ['Intelligence', 'Wisdom'], description: asi.description, max_value: 20 },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'Keen Observer', type: 'proficiency', isChoice: true, choose: 1, from: ['Insight, Investigation, Perception'], grantsExpertise: true },
      ]);
      expect(result.features).toEqual([
        { name: 'Quick Search', description: search.description, type: 'bonus_action', automation: search.automation, isBonusAction: true },
      ]);
    });

    it('parses the disk Skill Expert row: amount:[1] six-score ASI + two proficiency choices, no features', () => {
      const feat = pickFeat('Skill Expert');
      const asi = diskBenefit(feat, 'Ability Score Increase');
      const skillProf = diskBenefit(feat, 'Skill Proficiency');

      const result = computeFeatBuffs(feat, '2024');

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'any', amount: [1], isChoice: true, description: asi.description, max_value: 20 },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'Skill Proficiency', type: 'proficiency', isChoice: true, choose: 1, from: ['skill'] }, // from skillBenefit text
        {
          name: 'Expertise',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival'],
          grantsExpertise: true,
        },
      ]);
      expect(skillProf.description).toBe('You gain proficiency in one skill of your choice.');
      expect(result.features).toEqual([]);
      expect(result.resistances).toEqual([]);
    });
  });
});
