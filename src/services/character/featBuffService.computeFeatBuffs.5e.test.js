// @maintained-by-ai
// featBuffService.computeFeatBuffs.5e.test.js — LANE #8/9 of the featBuffService
// nine-lane cluster (queue #2016-2024). Subject seam: computeFeatBuffs (featBuffService.js:531-577),
// 5e TEXT path. Canonical seam map lives in the lane #1 header
// (featBuffService.applyFeatBuffsToFormData.test.js, #2016 law); twin #2022 header handoff
// and aggregate #2019 — READ FIRST.
//
// THIS LANE CONTRACT (#2023): the single-feat parser for benefits that are bare STRINGS
// (5e disk rows). Pinned here, rule-table canon:
//   - BENEFIT_TEXT_RULES_5E FIRST-MATCH-WINS ORDER (L95-109) is OURS: rules are scanned
//     top-to-bottom and the FIRST matching leg claims the whole text (L119-125 returns
//     immediately), so table order is behavior. Disk enumeration (verified 2026-10-16,
//     42 feats / 87 string benefits) found ZERO multi-leg collisions on disk — every
//     order-boundary pair below is a SYNTHETIC dual-match probe, labeled as such, run
//     against the real parser for its exact observed output.
//     Order canon pinned: OR-pattern (L96) before single-score (L97) before
//     choose/chosen (L98-99); proficiency-with (L100) before proficiency-choice (L101);
//     HP-per-level (L105) before HP-flat (L106); RESISTANCE_PATTERN LAST (L108).
//   - PASSIVE BENEFIT FALLBACK (L127-131) is OURS: 66 of 87 disk benefit strings fall
//     through the whole table to {name:'Passive Benefit', description:text, type:'passive'}.
//   - RESISTANCE REGEX SEMANTICS are OURS (coordinate with #2019, which owns the
//     envelope level through the aggregate): have|gain alternation, single (\w+) capture,
//     and the 'the' word-capture quirk (disk Dungeon Delver → resistances ['the'],
//     quoted in #2019) — the regex internals making it ['the'] pin HERE.
//   - 5e FEAT-LEVEL AUTOMATION ATTACH (L563-573) is OURS, ARRAY-TOLERANT: single object
//     (disk Actor) OR array (disk Alert, 3 passive_buffs) appends features
//     {name: feat.name, description: feat.description (verbatim ARRAY on disk 5e rows),
//     type: auto.type || 'passive', automation: auto} AFTER the text-derived features.
//     Its negation (2024 path NEVER attaches) is already pinned by twin #2022 via the
//     same disk Alert row — this is the complement, not a duplicate.
//   - L539 entry guard (no feat / no benefits) returns the empty envelope BEFORE the
//     attach, so an orphan automation on a benefits-less feat is unreachable there.
//
// FIXTURES: verbatim rows from public/data/feats.json (mandatory disk check done
// 2026-10-16), cloneDeep per pick (#2021 idiom) so no pin mutates the imported module.
// Former hand-typed fixtures corrected against disk: disk ASIs are amount 1 with
// ', to a maximum of 20.' suffix (no 'by 2' single-score row exists); the disk
// 'two skills of your choice' proficiency-choice text does not exist (L101 leg is
// disk-unreachable, SYNTHETIC); disk has NO HP-increase text and NO digit-language row
// (Linguist's 'You learn three languages of your choice.' WORD-numeral MISSES the
// \d+ LANGUAGE leg → Passive Benefit fallback — disk-proven quirk pinned below).
// Synthetic probes are labeled SYNTHETIC in-test; all their envelopes are actual
// observed outputs of the real parser.
//
// SHED: aggregate envelope + featName/featDescription stamping + attach threading through
// the aggregate → #2019; formData writer → #2016; reset → #2017; 2024 structured parser +
// L543 skip guard + default-ruleset pin + row-purity → #2022; edge-case tolerance → #2020;
// saveType resolver / SPA-cache mutation → #2021; ritual_spells threading + rules.js
// ritualSpells bucket → #2024 (disk 2024/feats.json DOES contain Ritual Master — flag for
// that lane to re-anchor its fabricated fixture).
//
// LIVENESS (verified by grep 2026-10-16): LIVE — FeatItemDetails.jsx:18 calls
// computeFeatBuffs(feat, ruleset) directly for the wizard feat detail pane, and every
// computeAllFeatBuffs call (rules.js:255 PlayerStats build, useWizardFeatBuffs.js:83,
// useWizardFeatAbilityChoices.js:117/182, WizardStepAbilities.jsx:300) routes through it
// per feat (featBuffService.js:597).
// No timers, no spies (parser is pure — nothing to restore), exact envelopes only.

import { describe, it, expect } from 'vitest';
import { cloneDeep } from 'lodash';

import feats5e from '../../../public/data/feats.json' with { type: 'json' };

import { computeFeatBuffs } from './featBuffService.js';

const EMPTY = {
  abilityScoreIncreases: [],
  proficiencies: [],
  resistances: [],
  features: [],
};

const pickFeat = name => {
  const row = feats5e.find(f => f.name === name);
  if (!row) throw new Error(`public/data/feats.json no longer contains '${name}' — re-anchor this lane`);
  return cloneDeep(row);
};

describe('computeFeatBuffs — 5e text path (single-feat parser, first-match-wins)', () => {
  describe('entry guards (L539)', () => {
    it('returns the empty four-category envelope for null, undefined, and benefit-less feats', () => {
      expect(computeFeatBuffs(null, '5e')).toEqual(EMPTY);
      expect(computeFeatBuffs(undefined, '5e')).toEqual(EMPTY);
      expect(computeFeatBuffs({}, '5e')).toEqual(EMPTY);
    });

    it('never reaches the L563-573 attach for an orphan automation on a benefits-less feat', () => {
      expect(computeFeatBuffs({ name: 'Orphan', automation: { type: 'orphan' } }, '5e')).toEqual(EMPTY);
    });
  });

  describe('ASI legs and table order (L96-99 before everything else)', () => {
    it('parses disk Athlete: ABILITY_OR leg (L96) claims the or-text before ABILITY, remaining strings fall to Passive Benefit, single automation object attaches last', () => {
      const feat = pickFeat('Athlete');

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [
          { name: 'Strength', amount: 1, isChoice: true, max_value: 20 },
          { name: 'Dexterity', amount: 1, isChoice: true, max_value: 20 },
        ],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Passive Benefit', description: 'When you are prone, standing up uses only 5 feet of your movement.', type: 'passive' },
          { name: 'Passive Benefit', description: "Climbing doesn't cost you extra movement.", type: 'passive' },
          { name: 'Passive Benefit', description: 'You can make a running long jump or a running high jump after moving only 5 feet on foot, rather than 10 feet.', type: 'passive' },
          {
            name: 'Athlete',
            description: ['You have undergone extensive physical training to gain the following benefits:'],
            type: 'passive_buff',
            automation: {
              type: 'passive_buff',
              target: 'self',
              effect: 'climbing_speed',
              bonusExpression: 'speed',
              casting_time: '1 action',
            },
          },
        ],
      });
    });

    it('parses disk Actor through ABILITY leg (L97): single non-choice ASI, fallback passives, single-object automation attached last (L563-573)', () => {
      const feat = pickFeat('Actor');

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [
          { name: 'Charisma', amount: 1, isChoice: false, max_value: 20 },
        ],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Passive Benefit', description: 'You have advantage on Charisma (Deception) and Charisma (Performance) checks when trying to pass yourself off as a different person.', type: 'passive' },
          { name: 'Passive Benefit', description: 'You can mimic the speech of another person or the sounds made by other creatures. You must have heard the person speaking, or heard the creature make the sound, for at least 1 minute. A successful Wisdom (Insight) check contested by your Charisma (Deception) check allows a listener to determine that the effect is faked.', type: 'passive' },
          {
            name: 'Actor',
            description: ['Skilled at mimicry and dramatics, you gain the following benefits:'],
            type: 'conditional_advantage',
            automation: {
              type: 'conditional_advantage',
              target: 'skill_check',
              condition: 'disguised',
              effect: 'advantage',
              abilities: ['Charisma'],
              casting_time: '1 action',
            },
          },
        ],
      });
    });

    it('parses disk Heavily Armored: ABILITY leg tolerates the disk "by 1 ," spacing quirk; PROFICIENCY leg (L100) title-cases the with-capture', () => {
      const feat = pickFeat('Heavily Armored');
      // Disk sanity: the ASI string really carries the stray space before the comma.
      expect(feat.benefits[0]).toBe('Increase your Strength score by 1 , to a maximum of 20.');

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [
          { name: 'Strength', amount: 1, isChoice: false, max_value: 20 },
        ],
        proficiencies: [
          { name: 'Heavy Armor', type: 'proficiency' },
        ],
        resistances: [],
        features: [],
      });
    });

    it('SYNTHETIC order probe (no disk row collides): OR leg (L96) unanchored-scans past a leading single-score clause and claims the or-text — the ABILITY leg never fires, max_value 30 captured', () => {
      // Disk enumeration: zero multi-leg texts exist, so this dual-match boundary is
      // fabricated and labeled. Envelope is the real parser's observed output.
      const result = computeFeatBuffs(
        { benefits: ['Increase your Constitution score by 1. Increase your Strength or Dexterity score by 2, to a maximum of 30.'] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [
          { name: 'Strength', amount: 2, isChoice: true, max_value: 30 },
          { name: 'Dexterity', amount: 2, isChoice: true, max_value: 30 },
        ],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('SYNTHETIC pushAbilityIncrease quirk (L56): isChoice comes from the " or " substring, not from the OR leg — non-contiguous or-text misses ABILITY_OR and yields ONE Strength entry flagged choice', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Strength score by 1 or Dexterity score by 1'] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [
          { name: 'Strength', amount: 1, isChoice: true, max_value: 20 },
        ],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('SYNTHETIC ABILITY_CHOOSE leg (L98, 0 disk rows): "Increase it by" variant parses as any-choice with verbatim description', () => {
      const result = computeFeatBuffs(
        { benefits: ['Choose one ability score. Increase it by 1, to a maximum of 20.'] },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Choose one ability score. Increase it by 1, to a maximum of 20.',
          max_value: 20,
        },
      ]);
    });
  });

  describe('chosen ability + saving throw proficiency (disk Resilient spans L99/L102)', () => {
    it('parses disk Resilient end-to-end: CHOSEN leg (L99) ASI, "proficiency IN saving throws" misses L100, SAVE_PROFICIENCY leg builds the fallbackTypes feature, feat automation attaches after', () => {
      const feat = pickFeat('Resilient');

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [
          {
            name: 'any',
            amount: 1,
            isChoice: true,
            description: 'Increase the chosen ability score by 1, to a maximum of 20.',
            max_value: 20,
          },
        ],
        proficiencies: [],
        resistances: [],
        features: [
          {
            name: 'Resilient',
            description: 'You gain proficiency in saving throws using the chosen ability.',
            type: 'saving_throw',
            automation: {
              type: 'save_proficiency',
              saveType: 'Strength',
              fallbackTypes: ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
            },
          },
          {
            name: 'Resilient',
            description: ['Choose one ability score. You gain the following benefits:'],
            type: 'save_proficiency',
            automation: {
              type: 'save_proficiency',
              saveType: 'Strength',
              fallbackTypes: ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
            },
          },
        ],
      });
      // fallbackTypes stay INTACT at this seam — the resolver that consumes them is #2021.
    });

    it('SYNTHETIC order probe: CHOSEN leg (L99) wins over RESISTANCE (L108) in a dual-match text — resistances stays empty', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase the chosen ability score by 2 and you have resistance to fire'] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [
          {
            name: 'any',
            amount: 2,
            isChoice: true,
            description: 'Increase the chosen ability score by 2 and you have resistance to fire',
            max_value: 20,
          },
        ],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('SYNTHETIC boundary probe: "proficiency WITH saving throws" reroutes to the PROFICIENCY leg (L100) — the save leg (L102) requires the disk "in" wording', () => {
      const result = computeFeatBuffs(
        { benefits: ['You gain proficiency with saving throws using the chosen ability.'] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [
          { name: 'Saving Throws Using The Chosen Ability', type: 'proficiency' },
        ],
        resistances: [],
        features: [],
      });
    });

    it('SYNTHETIC order probe: PROFICIENCY leg (L100) wins over PROFICIENCY_CHOICE (L101) — a with-phrase is non-choice even when it contains choice wording (L101 is disk-unreachable)', () => {
      const result = computeFeatBuffs(
        { benefits: ['You gain proficiency with any combination of two tools of your choice.'] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [
          { name: 'Any Combination Of Two Tools Of Your Choice', type: 'proficiency' },
        ],
        resistances: [],
        features: [],
      });
    });
  });

  describe('value legs (speed/initiative disk text; HP+language legs disk-unreachable)', () => {
    it('parses disk Mobile verbatim speed text through SPEED_PATTERN (L103)', () => {
      const result = computeFeatBuffs({ benefits: ['Your speed increases by 10 feet.'] }, '5e');

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Speed Bonus', description: 'Your speed increases by 10 feet.', type: 'speed', value: 10 },
        ],
      });
    });

    it('parses disk Alert verbatim initiative text through INITIATIVE_PATTERN (L105)', () => {
      const result = computeFeatBuffs({ benefits: ['You gain a +5 bonus to initiative.'] }, '5e');

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Initiative Bonus', description: 'You gain a +5 bonus to initiative.', type: 'initiative', value: 5 },
        ],
      });
    });

    it('SYNTHETIC order probe (no HP text on disk at all): HP_PER_LEVEL (L105) wins over HP_FLAT (L106) and first-match-return kills the flat leg', () => {
      const result = computeFeatBuffs(
        { benefits: ['your hit point maximum increases by an additional 2 hit points; your hit point maximum increases by 10'] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [
          {
            name: 'Hit Point Bonus',
            description: 'your hit point maximum increases by an additional 2 hit points; your hit point maximum increases by 10',
            type: 'hp_per_level',
            value: 2,
          },
        ],
      });
    });

    it('SYNTHETIC language leg (disk has no digit-language row): LANGUAGE_PATTERN (L107) captures the numeral', () => {
      const result = computeFeatBuffs({ benefits: ['You learn 2 languages of your choice'] }, '5e');

      expect(result.features).toEqual([
        { name: 'Language Bonus', description: 'You learn 2 languages of your choice', type: 'language', value: 2 },
      ]);
    });

    it('disk Linguist: the WORD numeral "three languages" MISSES the \\d+ LANGUAGE leg — both non-ASI strings fall through to Passive Benefit', () => {
      const feat = pickFeat('Linguist');
      expect(feat.benefits[1]).toBe('You learn three languages of your choice.');

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [
          { name: 'Intelligence', amount: 1, isChoice: false, max_value: 20 },
        ],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Passive Benefit', description: 'You learn three languages of your choice.', type: 'passive' },
          { name: 'Passive Benefit', description: "You can ably create written ciphers. Others can't deci­pher a code you create unless you teach them, they succeed on an Intelligence check (DC equal to your Intelligence score + your proficiency bonus), or they use magic to decipher it.", type: 'passive' },
        ],
      });
    });
  });

  describe('resistance regex internals (RESISTANCE_PATTERN last, L108)', () => {
    it('disk Dungeon Delver: the (\\w+) word-capture quirk makes resistances ["the"] (envelope level through the aggregate is #2019; the regex semantics are ours)', () => {
      const feat = pickFeat('Dungeon Delver');
      expect(feat.benefits[2]).toBe('You have resistance to the damage dealt by traps.');

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: ['the'],
        features: [
          { name: 'Passive Benefit', description: 'You have advantage on Wisdom (Perception) and Intelligence (Investigation) checks made to detect the presence of secret doors.', type: 'passive' },
          { name: 'Passive Benefit', description: 'You have advantage on saving throws made to avoid or resist traps.', type: 'passive' },
          { name: 'Passive Benefit', description: "Traveling at a fast pace doesn't impose the normal -5 penalty on your passive Wisdom (Perception) score.", type: 'passive' },
          {
            name: 'Dungeon Delver',
            description: ['Alert to the hidden traps and secret doors found in many dungeons, you gain the following benefits:'],
            type: 'conditional_advantage',
            automation: {
              type: 'conditional_advantage',
              target: 'saving_throw',
              condition: 'traps',
              effect: 'advantage',
              casting_time: '1 action',
            },
          },
        ],
      });
    });

    it('SYNTHETIC order probe: RESISTANCE is LAST (L108) — any earlier-leg text containing resistance wording never reaches it', () => {
      const asiFirst = computeFeatBuffs(
        { benefits: ['Increase your Strength score by 1 and you have resistance to fire'] },
        '5e'
      );
      expect(asiFirst.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: false, max_value: 20 },
      ]);
      expect(asiFirst.resistances).toEqual([]);

      const speedFirst = computeFeatBuffs(
        { benefits: ['Your speed increases by 10 feet and you have resistance to fire'] },
        '5e'
      );
      expect(speedFirst.features).toEqual([
        { name: 'Speed Bonus', description: 'Your speed increases by 10 feet and you have resistance to fire', type: 'speed', value: 10 },
      ]);
      expect(speedFirst.resistances).toEqual([]);
    });

    it('SYNTHETIC regex alternation + single capture (disk carries only the Dungeon Delver have-row): gain-form parses, capture stops at the first word', () => {
      const gain = computeFeatBuffs({ benefits: ['You gain resistance to cold'] }, '5e');
      expect(gain.resistances).toEqual(['cold']);

      const firstWord = computeFeatBuffs({ benefits: ['You have resistance to fire and poison'] }, '5e');
      expect(firstWord.resistances).toEqual(['fire']);
    });
  });

  describe('Passive Benefit fallback and input tolerance', () => {
    it('disk verbatim fallback text (66 of 87 disk strings hit L127-131): unrecognized text becomes exactly one Passive Benefit', () => {
      const result = computeFeatBuffs({ benefits: ["You can't be surprised while you are conscious."] }, '5e');

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Passive Benefit', description: "You can't be surprised while you are conscious.", type: 'passive' },
        ],
      });
    });

    it('skips non-string benefit entries (L553 guard) — only the disk Actor ASI string parses', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Charisma score by 1, to a maximum of 20.', null, 42, {}] },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [
          { name: 'Charisma', amount: 1, isChoice: false, max_value: 20 },
        ],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });
  });

  describe('feat-level automation attach (L563-573) — array-tolerant', () => {
    it('attaches the disk Alert automation ARRAY as three threaded features after the text-derived ones (complement of the #2022 negation pinned via this same row)', () => {
      const feat = pickFeat('Alert');
      // Disk sanity: Alert really carries an automation ARRAY on the 5e side.
      expect(Array.isArray(feat.automation)).toBe(true);

      expect(computeFeatBuffs(feat, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Initiative Bonus', description: 'You gain a +5 bonus to initiative.', type: 'initiative', value: 5 },
          { name: 'Passive Benefit', description: "You can't be surprised while you are conscious.", type: 'passive' },
          { name: 'Passive Benefit', description: 'Other creatures don\'t gain advantage on attack rolls against you as a result of being unseen by you.', type: 'passive' },
          {
            name: 'Alert',
            description: ['Always on the lookout for danger, you gain the following benefits:'],
            type: 'passive_buff',
            automation: { type: 'passive_buff', target: 'self', effect: 'initiative_bonus', bonusExpression: '5', casting_time: '1 action' },
          },
          {
            name: 'Alert',
            description: ['Always on the lookout for danger, you gain the following benefits:'],
            type: 'passive_buff',
            automation: { type: 'passive_buff', target: 'self', effect: 'no_surprise', casting_time: 'passive' },
          },
          {
            name: 'Alert',
            description: ['Always on the lookout for danger, you gain the following benefits:'],
            type: 'passive_buff',
            automation: { type: 'passive_buff', target: 'self', effect: 'unseen_attacker_advantage_negate', casting_time: 'passive' },
          },
        ],
      });
    });

    it('SYNTHETIC structural probe: benefits:[] passes the L539 guard, so attachment still runs with an empty text loop; type falls back to "passive" when the automation object has none (every disk automation carries a type)', () => {
      const result = computeFeatBuffs(
        { name: 'Synth', description: 'Synthetic shell', benefits: [], automation: {} },
        '5e'
      );

      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [
          { name: 'Synth', description: 'Synthetic shell', type: 'passive', automation: {} },
        ],
      });
    });
  });
});
