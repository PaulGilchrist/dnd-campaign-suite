// @maintained-by-ai
// FT-068 spellCalc2024 Ritual Master feat lane: chosen lv1 ritual spells injected
// always-prepared, stamped _ritualMasterRitual with the feat ASI ability (CLA-212/234
// carry pattern), and the slotless-container grant for zero-caster holders
// (spellCalc2024.js ensureSpellAbilitiesContainer). Falsifying pairs: feat absent ->
// no grant; non-ritual spells never stamped or injected.
//
// NOT covered here (owned elsewhere): full ritual-list injection for non-chosen
// ritual_spells features and Ritual Caster dedup — spellCalc2024-rituals.test.js;
// casting_time-'Ritual' + _ritualOnly stamps — spellCalc2024-wildheart-rituals.test.js
// (CLA-234); Quick Ritual payloads — #1266; tier gating — #1269 (CLA-272).
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import feats2024 from '../../../../public/data/2024/feats.json' with { type: 'json' };
import spells2024 from '../../../../public/data/2024/spells.json' with { type: 'json' };
import classes2024 from '../../../../public/data/2024/classes.json' with { type: 'json' };

import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: () => undefined,
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: () => null,
}));

// ── Disk-derived fixtures (read, never transcribed) ──

const DISK_FEAT = feats2024.find(f => f.index === 'ritual-master');
// Disk automation row: the feat declares NO spellCastingAbility — passive.js:136
// defaults it to '' and featBuffService.js:614 resolves it from featAbilityChoices,
// so the ability value below is the resolved input, not a disk claim.
const DISK_AUTO = DISK_FEAT.benefits.find(b => b.automation?.effect === 'ritual_spells').automation;
const CHA_INCREASE = { name: 'Charisma', baseScore: 16, featIncrease: 1, miscIncrease: 0, backgroundIncrease: 0, bonus: 4 };

const diskSpell = name => cloneDeep(spells2024.find(s => s.name === name));
const stampRow = (name, extra = {}) => ({
  ...diskSpell(name),
  prepared: 'Always',
  _ritualMasterRitual: true,
  spellCastingAbility: 'Charisma',
  ...extra,
});

// Ritual Caster-style bucket row, field-for-field per automationInfoBuilder/passive.js:136.
const RITUAL_CASTER_PASSIVE = {
  type: 'passive_rule',
  name: 'Ritual Caster',
  effect: 'ritual_spells',
  casting_time: 'passive',
  chosenSpells: false,
  quickRitual: false,
  spellCastingAbility: '',
  hasAutomation: true,
};

// Chosen pool = every lv1 Ritual-tagged spell on disk, plus a non-ritual lv1
// spell as the falsifier (spellCalc2024.js:414 filters on .ritual). Fresh
// clones per call: getSpellAbilities stamps rows in place, and the JSON
// module instance is cached across tests in this worker.
const ritualPool = () => [
  diskSpell('Eldritch Blast'),
  ...spells2024.filter(s => s.level === 1 && s.ritual).map(s => diskSpell(s.name)),
  diskSpell('Armor of Agathys'),
];

// Contiguous lv1..N ladder of the disk Warlock spellcasting rows
// (public/data/2024/classes.json) — resolveCharacterSpellcasting indexes
// class_levels[level-1], so the fixture must be ladder-shaped, not truncated.
function warlockClassLevels(upTo) {
  const diskLevels = classes2024.find(c => c.name === 'Warlock').class_levels;
  return diskLevels.slice(0, upTo);
}

function makeWarlockStats(overrides = {}) {
  const { class: classOverrides, ...rest } = overrides;
  return {
    name: 'HexHolder',
    level: 14,
    proficiency: 5,
    class: {
      name: 'Warlock',
      class_levels: warlockClassLevels(14),
      spell_casting_ability: 'Charisma',
      ...classOverrides,
    },
    abilities: [CHA_INCREASE],
    spells: [],
    automation: {},
    ...rest,
  };
}

function ritualMasterPassive(extra = {}) {
  return {
    type: 'passive_rule',
    name: 'Ritual Spells',
    effect: 'ritual_spells',
    casting_time: DISK_AUTO.casting_time,
    chosenSpells: DISK_AUTO.chosenSpells,
    quickRitual: DISK_AUTO.quickRitual,
    spellCastingAbility: 'Charisma',
    hasAutomation: true,
    ...extra,
  };
}

describe('FT-068 spellCalc2024 Ritual Master feat', () => {
  it('pins the disk feat row: lv4 prereq, chosenSpells + quickRitual automation, no hardcoded casting ability', () => {
    expect(DISK_FEAT.name).toBe('Ritual Master');
    expect(DISK_FEAT.type).toBe('General Feat');
    expect(DISK_FEAT.prerequisites.level).toBe(4);
    expect(DISK_FEAT.repeatable).toBe(false);
    expect(DISK_AUTO).toEqual({
      type: 'ritual_spells',
      effect: 'ritual_spells',
      chosenSpells: true,
      quickRitual: true,
      casting_time: 'passive',
    });
    expect(DISK_FEAT.ability_score_increase.scores).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
  });

  it('injects ONLY the chosen lv1 rituals as full-detail always-prepared rows stamped with the feat ASI ability, surviving the slot filter even with no lv1 slots', () => {
    const stats = makeWarlockStats({
      spells: ['Eldritch Blast'],
      ritualMasterSpells: ['Alarm', 'Identify'],
      automation: { ritualSpells: [ritualMasterPassive()] },
    });

    const result = getSpellAbilities(ritualPool(), stats);

    // The disk lv14 Pact table has NO lv1 slots (lv5 x3): the unchosen lv1 rituals
    // and the non-ritual lv1 falsifier are dropped by the slot-level filter, while
    // the chosen rows stay and carry the full disk spell detail plus the FT-068 stamps.
    expect(result.spell_slots_level_1 || 0).toBe(0);
    expect(result.spell_slots_level_5).toBe(3);
    expect(result.spells).toEqual([
      { ...diskSpell('Eldritch Blast'), prepared: 'Always' },
      stampRow('Alarm'),
      stampRow('Identify'),
    ]);
    expect(result.spellCastingAbility).toBe('Charisma');
    expect(result.modifier).toBe(4);
    expect(result.toHit).toBe(9);
    expect(result.saveDc).toBe(17);
  });

  it('stamps a chosen ritual already in the known-spells list exactly once', () => {
    const stats = makeWarlockStats({
      spells: ['Alarm'],
      ritualMasterSpells: ['Alarm'],
      automation: { ritualSpells: [ritualMasterPassive()] },
    });

    const result = getSpellAbilities(ritualPool(), stats);

    expect(result.spells).toEqual([stampRow('Alarm')]);
  });

  it('a non-holder (no ritual_spells automation) keeps exactly their known spells, unstamped', () => {
    const stats = makeWarlockStats({ spells: ['Eldritch Blast', 'Alarm'] });

    const result = getSpellAbilities(ritualPool(), stats);

    expect(result.spells).toEqual([
      { ...diskSpell('Eldritch Blast'), prepared: 'Always' },
      { ...diskSpell('Alarm'), prepared: 'Always' },
    ]);
    expect(result.spells.every(s => s._ritualMasterRitual === undefined)).toBe(true);
  });

  it('logs the canonical error when the feat ASI ability is unresolved, leaving the row stamped without a casting ability and the class ability intact', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stats = makeWarlockStats({
      spells: [],
      ritualMasterSpells: ['Alarm'],
      automation: { ritualSpells: [ritualMasterPassive({ spellCastingAbility: '' })] },
    });

    const result = getSpellAbilities(ritualPool(), stats);

    expect(errorSpy).toHaveBeenCalledWith('[spellCalc2024] Ritual Master is missing a spellcasting ability (featAbilityChoices unresolved)');
    expect(result.spells).toEqual([
      { ...stampRow('Alarm'), spellCastingAbility: undefined },
    ]);
    expect(result.spellCastingAbility).toBe('Charisma');
    errorSpy.mockRestore();
  });

  it('an empty chosen list logs the canonical error and injects no always-prepared rows', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stats = makeWarlockStats({
      spells: [],
      automation: { ritualSpells: [ritualMasterPassive()] },
    });

    const result = getSpellAbilities(ritualPool(), stats);

    expect(errorSpy).toHaveBeenCalledWith('[spellCalc2024] Ritual Master has no chosen ritual spells (ritualMasterSpells missing)');
    expect(result.spells).toEqual([]);
    errorSpy.mockRestore();
  });

  it('gives a zero-caster holder (no class spellcasting table) a slotless container with the chosen rows instead of fabricated half-caster slots', () => {
    const stats = {
      name: 'SneakWithFeats',
      level: 10,
      proficiency: 4,
      class: { name: 'Rogue' }, // lv10 Rogue table is Arcane Trickster-only (required_major gate)
      abilities: [CHA_INCREASE],
      spells: [],
      ritualMasterSpells: ['Alarm'],
      automation: { ritualSpells: [ritualMasterPassive()] },
    };

    const result = getSpellAbilities(ritualPool(), stats);

    expect(result.spells).toEqual([stampRow('Alarm')]);
    // Slotless: no spell_slots_level_* keys at all — Quick Ritual casting is slot-free
    // and the half-caster fallback (4x lv1 at lv10) was NOT fabricated.
    expect(Object.keys(result).filter(k => k.startsWith('spell_slots_level_'))).toEqual([]);

    // Falsifier: same zero-caster without the feat gets no container at all.
    const noFeat = { ...stats, automation: {}, ritualMasterSpells: undefined };
    expect(getSpellAbilities(ritualPool(), noFeat)).toBeNull();
  });

  it('leaves the full-list lane untouched: a non-chosen ritual_spells passive stamps no _ritualMasterRitual rows', () => {
    const stats = makeWarlockStats({
      spells: ['Eldritch Blast'],
      automation: { ritualSpells: [RITUAL_CASTER_PASSIVE] },
    });

    const result = getSpellAbilities(ritualPool(), stats);

    // Chosen-gate falsifier: with no ritualMasterSpells the chosen lane injects nothing;
    // every row is the full-list lane's un-stamped detail copy (that lane's injection
    // breadth is owned by spellCalc2024-rituals.test.js — here we only pin that none of
    // it wears the _ritualMasterRitual stamp and non-rituals never join).
    const lv1RitualNames = spells2024.filter(s => s.level === 1 && s.ritual).map(s => s.name).sort();
    expect(result.spells.map(s => s.name)).toEqual(['Eldritch Blast', ...lv1RitualNames]);
    expect(result.spells.every(s => s.prepared === 'Always' && s._ritualMasterRitual === undefined)).toBe(true);
  });
});
