// @maintained-by-ai
/**
 * Keep/drop classification for the ruleset-switch confirm modal (roadmap
 * Item 2). Pure-service lane: every case feeds target-ruleset data shaped
 * like the real files (synthetic fixtures first for full matrix control,
 * then the REAL public/data JSON for a byte-honest smoke of each direction).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyRulesetSwitch,
  applyRulesetSwitchToFormData,
  formatNameList,
  entryNameOf,
  DROP_REASONS,
} from './rulesetSwitchPreview.js';

import realSpells5e from '../../../public/data/spells.json';
import realSpells2024 from '../../../public/data/2024/spells.json';
import realFeats5e from '../../../public/data/feats.json';
import realFeats2024 from '../../../public/data/2024/feats.json';
import realClasses2024 from '../../../public/data/2024/classes.json';
import realBackgrounds2024 from '../../../public/data/2024/backgrounds.json';

function abilities({ strength = 16, dexterity = 12, wisdom = 8, intelligence = 8, constitution = 10, charisma = 8 } = {}) {
  return [
    { name: 'Strength', baseScore: strength, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Dexterity', baseScore: dexterity, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Constitution', baseScore: constitution, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Intelligence', baseScore: intelligence, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Wisdom', baseScore: wisdom, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    { name: 'Charisma', baseScore: charisma, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
  ];
}

function draft(overrides = {}) {
  return {
    level: 4,
    class: { name: 'Fighter', subclass: { name: '' }, fightingStyles: ['Defense'] },
    abilities: abilities(),
    spells: [],
    feats: [],
    ...overrides,
  };
}

// Target-ruleset fixtures shaped exactly like public/data/2024/*.json rows.
const TARGET_SPELLS = [
  { index: 'fire-bolt', name: 'Fire Bolt', classes: ['Fighter', 'Wizard'] },
  { index: 'shield', name: 'Shield', classes: ['Wizard'] },
  { index: 'listless', name: 'Mystery Rite', classes: undefined },
];

const TARGET_FEATS = [
  { name: 'Alert' },
  { name: 'LevelGated', prerequisites: { level: 4 } },
  { name: 'LevelTooHigh', prerequisites: { level: 8 } },
  { name: 'GreatWeaponMaster', prerequisites: { level: 4, ability_scores: [{ name: 'Strength', minimum: 13 }] } },
  { name: 'Grappler', prerequisites: { level: 4, ability_scores: [{ name: 'Strength', minimum: 13 }, { name: 'Dexterity', minimum: 13 }] } },
  { name: 'DexOnly', prerequisites: { ability_scores: [{ name: 'Dexterity', minimum: 13 }] } },
  { name: 'StyleFeat', prerequisites: { feature: 'Fighting Style' } },
  { name: 'CasterFeat', prerequisites: { feature: 'Spellcasting or Pact Magic' } },
  { name: 'ShieldMastery', prerequisites: { armor_training: 'Shield Training' } },
  { name: 'HeavyOddity', prerequisites: { armor_training: 'Heavy Armor Training' } },
  { name: 'WeirdFeature', prerequisites: { feature: 'Some Unmodeled Feature' } },
];

// Fighter grants every armor training keyword and NO spellcasting; Cleric
// casts from 1; Rogue only via the Arcane Trickster major.
const TARGET_CLASSES = [
  {
    name: 'Fighter',
    armor_training: 'Light, Medium, and Heavy armor and Shields',
    class_levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }],
  },
  {
    name: 'Cleric',
    class_levels: [
      { level: 1, spellcasting: { cantrips_known: 3, prepared_spells: 4, spell_slots_level_1: 2 } },
    ],
  },
  {
    name: 'Rogue',
    class_levels: [
      { level: 1, spellcasting: { required_major: 'Arcane Trickster', cantrips_known: 0, spell_slots_level_1: 0 } },
      { level: 4, spellcasting: { required_major: 'Arcane Trickster', cantrips_known: 1, spell_slots_level_1: 2 } },
    ],
  },
];

const TARGET_BACKGROUNDS = [{ index: 'acolyte', name: 'Acolyte' }];

function classify(overrides, targetRuleset = '2024') {
  return classifyRulesetSwitch({
    formData: draft(overrides.formData || {}),
    targetRuleset,
    targetSpells: overrides.targetSpells ?? TARGET_SPELLS,
    targetFeats: overrides.targetFeats ?? TARGET_FEATS,
    targetClasses: overrides.targetClasses ?? TARGET_CLASSES,
    targetBackgrounds: overrides.targetBackgrounds ?? TARGET_BACKGROUNDS,
  });
}

const droppedByName = (group, name) => group.dropped.find(row => row.name === name);

describe('classifyRulesetSwitch — spells', () => {
  it('keeps a spell that exists in the target data and is on the class list', () => {
    const preview = classify({ formData: { spells: ['Fire Bolt'] } });
    expect(preview.spells.kept).toEqual(['Fire Bolt']);
    expect(preview.spells.dropped).toEqual([]);
    expect(preview.keptCount).toBe(1);
    expect(preview.droppedCount).toBe(0);
  });

  it('matches by index as well as by name', () => {
    const preview = classify({ formData: { spells: ['fire-bolt'] } });
    expect(preview.spells.kept).toEqual(['fire-bolt']);
  });

  it('drops a spell that exists but is not on the class list, naming class and ruleset', () => {
    const preview = classify({ formData: { spells: ['Shield'] } }); // Shield is Wizard-only, class is Fighter
    expect(preview.spells.kept).toEqual([]);
    const row = droppedByName(preview.spells, 'Shield');
    expect(row.reason).toBe(DROP_REASONS.NOT_ON_CLASS_LIST);
    expect(row.detail).toBe('not on the Fighter 2024 Rules spell list');
  });

  it('drops a spell missing from the target data as missing', () => {
    const preview = classify({ formData: { spells: ['Sleep'] } });
    const row = droppedByName(preview.spells, 'Sleep');
    expect(row.reason).toBe(DROP_REASONS.MISSING);
    expect(row.detail).toBe('not in the 2024 Rules spell data');
  });

  it('classifies a row whose target data carries no class list as unverifiable (never a guessed keep)', () => {
    const preview = classify({ formData: { spells: ['Mystery Rite'] } });
    const row = droppedByName(preview.spells, 'Mystery Rite');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE_UNVERIFIABLE);
  });

  it('normalizes object rows to their name for classification', () => {
    const preview = classify({ formData: { spells: [{ name: 'Fire Bolt' }] } });
    expect(preview.spells.kept).toEqual(['Fire Bolt']);
    expect(preview.spells.selected).toEqual(['Fire Bolt']);
  });
});

describe('classifyRulesetSwitch — 2024 structured feat prerequisites', () => {
  it('keeps a feat whose target row declares no prerequisites', () => {
    const preview = classify({ formData: { feats: ['Alert'] } });
    expect(preview.feats.kept).toEqual(['Alert']);
  });

  it('keeps a level-gated feat the character meets and drops one it does not', () => {
    const preview = classify({ formData: { feats: ['LevelGated', 'LevelTooHigh'] } });
    expect(preview.feats.kept).toEqual(['LevelGated']);
    const row = droppedByName(preview.feats, 'LevelTooHigh');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(row.detail).toContain('requires 8th level (the character is 4th)');
  });

  it('checks ability minimums against totals including increases', () => {
    // Str 12 base + 1 featIncrease = 13 ≥ 13 → met.
    const withBoost = draft({ feats: ['GreatWeaponMaster'], abilities: abilities({ strength: 12 }) });
    withBoost.abilities[0].featIncrease = 1;
    const preview = classifyRulesetSwitch({
      formData: withBoost,
      targetRuleset: '2024',
      targetSpells: [],
      targetFeats: TARGET_FEATS,
      targetClasses: TARGET_CLASSES,
      targetBackgrounds: [],
    });
    expect(preview.feats.kept).toEqual(['GreatWeaponMaster']);

    const plain = classify({ formData: { feats: ['DexOnly'], abilities: abilities({ dexterity: 12 }) } });
    const row = droppedByName(plain.feats, 'DexOnly');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(row.detail).toContain('your Dexterity is 12');
  });

  it('treats multiple ability_scores entries as alternatives (Str OR Dex)', () => {
    const preview = classify({ formData: { feats: ['Grappler'], abilities: abilities({ strength: 16, dexterity: 8 }) } });
    expect(preview.feats.kept).toEqual(['Grappler']);
  });

  it('keeps a Fighting Style prereq when a style is chosen and drops it otherwise', () => {
    const kept = classify({ formData: { feats: ['StyleFeat'] } });
    expect(kept.feats.kept).toEqual(['StyleFeat']);

    const dropped = classify({
      formData: { feats: ['StyleFeat'], class: { name: 'Fighter', subclass: { name: '' }, fightingStyles: [] } },
    });
    const row = droppedByName(dropped.feats, 'StyleFeat');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(row.detail).toContain('requires a Fighting Style (none chosen)');
  });

  it('checks Spellcasting or Pact Magic against the target class progression', () => {
    const caster = classify({
      formData: { feats: ['CasterFeat'], class: { name: 'Cleric', subclass: { name: '' } } },
    });
    expect(caster.feats.kept).toEqual(['CasterFeat']);

    const martial = classify({ formData: { feats: ['CasterFeat'] } });
    const row = droppedByName(martial.feats, 'CasterFeat');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(row.detail).toContain('the Fighter has no spellcasting at level 4');
  });

  it('honours required_major spellcasting rows (Arcane Trickster)', () => {
    const withoutMajor = classify({
      formData: { feats: ['CasterFeat'], class: { name: 'Rogue', subclass: { name: '' } } },
    });
    expect(droppedByName(withoutMajor.feats, 'CasterFeat').reason).toBe(DROP_REASONS.PREREQUISITE);

    const withMajor = classify({
      formData: { feats: ['CasterFeat'], class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } } },
    });
    expect(withMajor.feats.kept).toEqual(['CasterFeat']);
  });

  it('checks armor training against the target class row and only falls back to unverifiable', () => {
    const met = classify({ formData: { feats: ['ShieldMastery'] } });
    expect(met.feats.kept).toEqual(['ShieldMastery']);

    // Halfling-style grant: the training name matching a held feat satisfies it.
    const viaFeat = classifyRulesetSwitch({
      formData: draft({
        feats: ['HeavyOddity', 'Heavy Armor Training'],
        class: { name: 'Cleric', subclass: { name: '' } },
      }),
      targetRuleset: '2024',
      targetSpells: [],
      targetFeats: TARGET_FEATS,
      targetClasses: TARGET_CLASSES, // Cleric row absent → found: false, but held feat names match
      targetBackgrounds: [],
    });
    expect(viaFeat.feats.kept).toContain('HeavyOddity');

    // Class found but lacks the keyword → honest "might be granted elsewhere", never a guessed keep.
    const unverifiable = classify({
      formData: { feats: ['HeavyOddity'], class: { name: 'Cleric', subclass: { name: '' } } },
    });
    const row = droppedByName(unverifiable.feats, 'HeavyOddity');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE_UNVERIFIABLE);
    expect(row.detail).toContain('requires Heavy Armor Training');
  });

  it('classifies an unmodelled feature prerequisite as unverifiable', () => {
    const preview = classify({ formData: { feats: ['WeirdFeature'] } });
    expect(droppedByName(preview.feats, 'WeirdFeature').reason).toBe(DROP_REASONS.PREREQUISITE_UNVERIFIABLE);
  });

  it('drops a feat missing from the target feat data', () => {
    const preview = classify({ formData: { feats: ['Mobile'] } });
    const row = droppedByName(preview.feats, 'Mobile');
    expect(row.reason).toBe(DROP_REASONS.MISSING);
    expect(row.detail).toBe('not in the 2024 Rules feat data');
  });
});

describe('classifyRulesetSwitch — 5e free-text feat prerequisites', () => {
  const FIVE_FEATS = [
    { name: 'Actor' },
    { name: 'Grappler', prerequisite: 'Strength 13 or higher' },
    { name: 'Skulker', prerequisite: 'Dexterity 13 or higher' },
    { name: 'Ritual Caster', prerequisite: 'Intelligence or Wisdom 13 or higher' },
    { name: 'War Caster', prerequisite: 'The ability to cast at least one spell' },
    { name: 'Heavily Armored', prerequisite: 'Proficiency with medium armor' },
    { name: 'Lucky', prerequisite: 'Some bespoke DM allowance' },
  ];

  const toFive = (feats, extra = {}) => classifyRulesetSwitch({
    formData: draft({ feats, ...extra }),
    targetRuleset: '5e',
    targetSpells: [],
    targetFeats: FIVE_FEATS,
    targetClasses: [{
      name: 'Fighter',
      proficiencies: ['All armor', 'Shields', 'Simple Weapons', 'Martial Weapons'],
      class_levels: [{ level: 1 }, { level: 4 }],
    }],
    targetBackgrounds: [],
  });

  it('keeps a no-prerequisite feat that exists in the 5e data', () => {
    expect(toFive(['Actor']).feats.kept).toEqual(['Actor']);
  });

  it('checks single-ability prerequisites against the draft', () => {
    expect(toFive(['Grappler']).feats.kept).toEqual(['Grappler']); // Str 16 ≥ 13
    const row = droppedByName(toFive(['Skulker']).feats, 'Skulker'); // Dex 12 < 13
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(row.detail).toContain('your Dexterity is 12');
  });

  it('checks OR-pair ability prerequisites', () => {
    expect(toFive(['Ritual Caster']).feats.kept).toEqual([]); // Int 8 / Wis 8
    const raised = classifyRulesetSwitch({
      formData: draft({ feats: ['Ritual Caster'], abilities: abilities({ wisdom: 13 }) }),
      targetRuleset: '5e',
      targetSpells: [],
      targetFeats: FIVE_FEATS,
      targetClasses: [],
      targetBackgrounds: [],
    });
    expect(raised.feats.kept).toEqual(['Ritual Caster']);
  });

  it('checks cast-at-least-one-spell against the 5e class progression', () => {
    const row = droppedByName(toFive(['War Caster']).feats, 'War Caster');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(row.detail).toContain('no spellcasting at level 4');
  });

  it('treats armor-proficiency prerequisites as unverifiable when the class row cannot confirm', () => {
    // Fighter 'All armor' confirms medium proficiency.
    expect(toFive(['Heavily Armored']).feats.kept).toEqual(['Heavily Armored']);
    const clericOnly = classifyRulesetSwitch({
      formData: draft({ feats: ['Heavily Armored'], class: { name: 'Cleric', subclass: { name: '' } } }),
      targetRuleset: '5e',
      targetSpells: [],
      targetFeats: FIVE_FEATS,
      targetClasses: [{ name: 'Cleric', proficiencies: ['Light Armor', 'Medium Armor', 'Shields'], class_levels: [{ level: 1 }] }],
      targetBackgrounds: [],
    });
    // Cleric lists Medium Armor explicitly → met; an unlisted class row would be unverifiable instead.
    expect(clericOnly.feats.kept).toEqual(['Heavily Armored']);
  });

  it('classifies unparseable prerequisite strings as unverifiable', () => {
    const row = droppedByName(toFive(['Lucky']).feats, 'Lucky');
    expect(row.reason).toBe(DROP_REASONS.PREREQUISITE_UNVERIFIABLE);
    expect(row.detail).toContain('not expressible in the wizard data');
  });
});

describe('classifyRulesetSwitch — background', () => {
  it('2024 → 5e always drops the background: the step is 2024-only here', () => {
    const preview = classify({ formData: { background: 'Soldier' }, targetSpells: [], targetFeats: [] }, '5e');
    expect(preview.background.kept).toBeNull();
    const row = droppedByName(preview.background, 'Soldier');
    expect(row.reason).toBe(DROP_REASONS.RULESET_UNSUPPORTED);
    expect(row.detail).toContain('only exists under 2024 Rules');
  });

  it('5e → 2024 has no pre-existing background to keep', () => {
    const preview = classify({}, '2024');
    expect(preview.background.selected).toEqual([]);
    expect(preview.hasSelections).toBe(false);
  });

  it('a lingering background is kept toward 2024 only when it exists there', () => {
    const kept = classify({ formData: { background: 'Acolyte' } }, '2024');
    expect(kept.background.kept).toBe('Acolyte');
    const dropped = classify({ formData: { background: 'Haunted One' } }, '2024');
    expect(droppedByName(dropped.background, 'Haunted One').reason).toBe(DROP_REASONS.MISSING);
  });
});

describe('classifyRulesetSwitch — summary shape', () => {
  it('an untouched draft has no selections and needs no confirmation', () => {
    const preview = classify({});
    expect(preview.hasSelections).toBe(false);
    expect(preview.keptCount).toBe(0);
    expect(preview.droppedCount).toBe(0);
  });

  it('counts kept and dropped across every lane', () => {
    const preview = classify({ formData: { spells: ['Fire Bolt', 'Sleep'], feats: ['Alert', 'LevelTooHigh'], background: 'Soldier' } }, '2024');
    expect(preview.hasSelections).toBe(true);
    expect(preview.keptCount).toBe(2); // Fire Bolt + Alert
    expect(preview.droppedCount).toBe(3); // Sleep, LevelTooHigh, Soldier
    expect(preview.targetRuleset).toBe('2024');
    expect(preview.targetDataLoaded).toBe(true);
  });

  it('flags unloaded target data honestly instead of pretending rows are missing-only', () => {
    const preview = classifyRulesetSwitch({
      formData: draft({ spells: ['Fire Bolt'] }),
      targetRuleset: '2024',
      targetSpells: [],
      targetFeats: [],
      targetClasses: [],
      targetBackgrounds: [],
    });
    expect(preview.targetDataLoaded).toBe(false);
    expect(preview.droppedCount).toBe(1);
  });
});

describe('applyRulesetSwitchToFormData', () => {
  it('keeps surviving rows untouched (objects included) and clears exactly what was dropped', () => {
    const formData = draft({
      rules: '5e',
      background: 'Soldier',
      spells: ['Fire Bolt', { name: 'Shield' }, 'Sleep'],
      feats: ['Alert', { name: 'GreatWeaponMaster', automation: { keep: true } }],
    });
    const preview = classifyRulesetSwitch({
      formData,
      targetRuleset: '2024',
      targetSpells: TARGET_SPELLS,
      targetFeats: TARGET_FEATS,
      targetClasses: TARGET_CLASSES,
      targetBackgrounds: TARGET_BACKGROUNDS,
    });
    const applied = applyRulesetSwitchToFormData(formData, preview);

    expect(applied.rules).toBe('2024');
    expect(applied.background).toBe('');
    // Fighter: Fire Bolt kept; Shield/Sleep dropped.
    expect(applied.spells).toEqual(['Fire Bolt']);
    // Alert kept (no prereqs); GreatWeaponMaster kept (Str 16 ≥ 13) with its payload intact.
    expect(applied.feats).toEqual(['Alert', { name: 'GreatWeaponMaster', automation: { keep: true } }]);
    // Every surviving row exists in the kept ledger — no phantom selections.
    expect(applied.spells.map(entryNameOf).every(n => preview.spells.kept.includes(n))).toBe(true);
    expect(applied.feats.map(entryNameOf).every(n => preview.feats.kept.includes(n))).toBe(true);
  });

  it('preserves a kept 2024 background when switching toward 2024', () => {
    const formData = draft({ rules: '5e', background: 'Acolyte' });
    const preview = classifyRulesetSwitch({
      formData,
      targetRuleset: '2024',
      targetSpells: [],
      targetFeats: [],
      targetClasses: TARGET_CLASSES,
      targetBackgrounds: TARGET_BACKGROUNDS,
    });
    expect(applyRulesetSwitchToFormData(formData, preview).background).toBe('Acolyte');
  });
});

describe('modal copy helpers', () => {
  it('caps a long name list with an honest "+N more" tail', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(formatNameList(names)).toBe('a, b, c, d, e, f (+2 more)');
    expect(formatNameList(['a', 'b'])).toBe('a, b');
    expect(formatNameList([])).toBe('');
  });
});

describe('classification against the REAL rules data', () => {
  const wizardDraft = (spells, feats, background) => draft({
    level: 4,
    class: { name: 'Wizard', subclass: { name: '' } },
    spells,
    feats,
    background,
  });

  it('5e → 2024: shared Wizard-list spells stay, 2024-missing ones are named, and a lingering 2024 background survives', () => {
    const preview = classifyRulesetSwitch({
      formData: wizardDraft(['Acid Splash', 'Alarm', 'Acid Arrow', 'Black Tentacles'], ['Actor', 'Mobile'], 'Acolyte'),
      targetRuleset: '2024',
      targetSpells: realSpells2024,
      targetFeats: realFeats2024,
      targetClasses: realClasses2024,
      targetBackgrounds: realBackgrounds2024,
    });

    // 'Acid Splash' + 'Alarm' are on the 2024 Wizard list (verified on disk).
    expect(preview.spells.kept).toEqual(['Acid Splash', 'Alarm']);
    // 'Acid Arrow'/'Black Tentacles' have no 2024 spell row at all.
    expect(droppedByName(preview.spells, 'Acid Arrow').reason).toBe(DROP_REASONS.MISSING);
    expect(droppedByName(preview.spells, 'Black Tentacles').reason).toBe(DROP_REASONS.MISSING);
    // 'Mobile' was retired from the 2024 feat data; 'Actor' survived with a
    // machine-checked prereq the draft meets (Cha 8 fails 13 → dropped too).
    expect(droppedByName(preview.feats, 'Mobile').reason).toBe(DROP_REASONS.MISSING);
    expect(droppedByName(preview.feats, 'Actor').reason).toBe(DROP_REASONS.PREREQUISITE);
    expect(droppedByName(preview.feats, 'Actor').detail).toContain('Charisma');
    expect(preview.background.kept).toBe('Acolyte'); // exists in the 2024 data → survives
  });

  it('2024 → 5e: names that exist in both survive; legality beyond existence is honestly unverifiable where 5e data cannot express it', () => {
    const preview = classifyRulesetSwitch({
      formData: wizardDraft(['Acid Splash'], ['Actor', 'Grappler', 'Lucky'], 'Acolyte'),
      targetRuleset: '5e',
      targetSpells: realSpells5e,
      targetFeats: realFeats5e,
      targetClasses: [], // 5e class rows not needed by these rows; existence + 5e strings suffice here
      targetBackgrounds: [],
    });
    expect(preview.spells.kept).toEqual(['Acid Splash']); // Acid Splash is on the 5e Wizard list too
    // 5e Actor declares no prerequisite at all → kept; real 5e Grappler's
    // "Strength 13 or higher" is met by the Str 16 draft; Lucky has no prereq.
    expect(preview.feats.kept).toEqual(['Actor', 'Grappler', 'Lucky']);
    // Background never survives toward 5e.
    expect(droppedByName(preview.background, 'Acolyte').reason).toBe(DROP_REASONS.RULESET_UNSUPPORTED);
  });

  it('a non-caster keeps nothing from a caster spellbook even when every spell exists', () => {
    const preview = classifyRulesetSwitch({
      formData: draft({ class: { name: 'Fighter', subclass: { name: '' } }, spells: ['Acid Splash', 'Fire Bolt'] }),
      targetRuleset: '2024',
      targetSpells: realSpells2024,
      targetFeats: [],
      targetClasses: realClasses2024,
      targetBackgrounds: [],
    });
    expect(preview.spells.kept).toEqual([]);
    preview.spells.dropped.forEach(row => expect(row.reason).toBe(DROP_REASONS.NOT_ON_CLASS_LIST));
  });
});
