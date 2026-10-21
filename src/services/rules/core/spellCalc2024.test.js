// @maintained-by-ai
// spellCalc2024 BASE lane: getSpellAbilities dispatch orchestration + the container/
// slot-math faces siblings cite. PRESERVED-CITED faces (verbatim names): null-chain :60
// (-advanced), header/first-table :86 (-advanced/-automation), getHighestMajorLevel
// fallback :120 (-advanced), Arcane Trickster grant-count :194 (-automation CLA-218),
// non-Wizard Always :235 (-advanced), level-then-name sort :251 (-runtime). Containers
// cited by -automation; slot tables cited by -psionic-tiers.
// Fixture discipline: class ladders, required_major gates, PBs and spell rows are read
// from public/data/2024 disk (deep-cloned, full ladder, disk-accurate
// spell_slots_level_* keys — truncated/hand-shaped tables silently take the slotless
// path, #1270). Wild Heart ritual stamps, lineage, psionic tiers, arcanum, rituals and
// runtime-store picks are owned by their sibling lanes and NOT re-pinned here.
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import classRules from '../../character/classRules2024.js';
import { getSpellAbilities } from './spellCalc2024.js';
import classes2024 from '../../../../public/data/2024/classes.json';
import spells2024 from '../../../../public/data/2024/spells.json';

// ── Module-level mocks for ESM collaborators ──
// getHighestMajorLevel defaults to undefined (no major table) and getRuntimeValue to
// null; consumers override per-test and restore the default. No resetAllMocks — it
// clears these factory implementations (#1270).
vi.mock('../../character/classRules2024.js', () => ({
  default: { getHighestMajorLevel: vi.fn(() => undefined) },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

const getHighestMajorLevel = classRules.getHighestMajorLevel;

// ── Disk fixtures ──

function diskClass(name) {
  const cls = classes2024.find(c => c.name === name);
  if (!cls) throw new Error(`class '${name}' missing from disk classes.json`);
  return cloneDeep(cls);
}

function diskSpells(...names) {
  return names.map(name => {
    const row = spells2024.find(s => s.name === name);
    if (!row) throw new Error(`spell '${name}' missing from disk spells.json`);
    return cloneDeep(row);
  });
}

// Full disk class_levels ladder + disk proficiency bonus + the disk casting ability as
// the default prepared ability. classOverrides shallow-merge onto the disk class.
function makePlayerStats(overrides = {}) {
  const { class: classOverrides = {}, level = 1, abilities, ...rest } = overrides;
  const cls = diskClass(classOverrides.name || 'Wizard');
  const castingAbility = cls.spell_casting_ability || 'Intelligence';
  return {
    name: 'TestCharacter',
    level,
    proficiency: cls.class_levels[level - 1].proficiency_bonus,
    class: { name: cls.name, spell_casting_ability: cls.spell_casting_ability, class_levels: cls.class_levels, ...classOverrides },
    abilities: abilities || [{ name: castingAbility, baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
    spells: [],
    automation: {},
    ...rest,
  };
}

describe('spellCalc2024', () => {
  // ── Null-container chain (resolveCharacterSpellcasting → null) ──

  it('returns null when class level has no spellcasting and getHighestMajorLevel returns nothing', () => {
    getHighestMajorLevel.mockReturnValue(undefined);
    const noTableAtLevel = makePlayerStats({ class: { class_levels: [{ level: 1 }] } });
    expect(getSpellAbilities([], noTableAtLevel)).toBeNull();
    // empty ladder: same null face via the missing class_levels index
    expect(getSpellAbilities([], makePlayerStats({ class: { class_levels: [] } }))).toBeNull();
  });

  // required_major gate on the disk Fighter table: a non-EK major resolves to null,
  // the matching major passes the gate and keeps its disk slots.
  it('returns null when required_major does not match major name or subclass name', () => {
    const mismatch = makePlayerStats({ level: 5, class: { name: 'Fighter', major: { name: 'Champion' } } });
    expect(getSpellAbilities([], mismatch)).toBeNull();

    const matched = getSpellAbilities([], makePlayerStats({ level: 5, class: { name: 'Fighter', major: { name: 'Eldritch Knight' } } }));
    expect(matched).not.toBeNull();
    expect(matched.spell_slots_level_1).toBe(3);
    expect(matched.cantrips_known).toBe(2);
  });

  // ── Successful spellcasting resolution: class_levels table + header math ──

  it('returns spell abilities from class level spellcasting', () => {
    const wizardLv1 = diskClass('Wizard').class_levels[0].spellcasting;
    const stats = makePlayerStats({ spells: ['Fire Bolt'] });

    const result = getSpellAbilities(diskSpells('Fire Bolt'), stats);

    expect(result).not.toBeNull();
    expect(result.cantrips_known).toBe(wizardLv1.cantrips_known);
    // the full disk spell_slots_level_* ladder is forwarded untouched — nothing
    // truncated, nothing fabricated
    const diskSlotKeys = Object.keys(wizardLv1).filter(k => k.startsWith('spell_slots_level_'));
    expect(Object.keys(result).filter(k => k.startsWith('spell_slots_level_'))).toEqual(diskSlotKeys);
    diskSlotKeys.forEach(k => expect(result[k]).toBe(wizardLv1[k]));
    expect(result.spellCastingAbility).toBe('Intelligence');
    expect(result.modifier).toBe(3);
    expect(result.toHit).toBe(5);
    expect(result.saveDc).toBe(13);
    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Fire Bolt');
  });

  // Chain level 2: nothing in class_levels for this level and the major-table helper
  // answers — the highest major's spellcasting becomes the container. Disk-free here
  // by design (the only disk classes exercising this lane pin it in -advanced).
  it('falls back to getHighestMajorLevel when class_levels lack spellcasting', () => {
    getHighestMajorLevel.mockReturnValue({
      spellcasting: { cantrips_known: 2, spell_slots_level_1: 1, spell_type: 'known' },
    });
    const stats = makePlayerStats({ class: { class_levels: [{ level: 1 }] } });

    const result = getSpellAbilities([], stats);

    expect(getHighestMajorLevel).toHaveBeenCalledWith(stats);
    expect(result).not.toBeNull();
    expect(result.cantrips_known).toBe(2);
    expect(result.spell_slots_level_1).toBe(1);
  });

  // Chain level 3: class.major.spellcasting directly. Restore the mock default
  // explicitly instead of resetAllMocks.
  it('falls back to class.major.spellcasting when class_levels and getHighestMajorLevel have none', () => {
    getHighestMajorLevel.mockReturnValue(undefined);
    const stats = makePlayerStats({
      class: {
        class_levels: [{ level: 1 }],
        major: { spell_casting_ability: 'Intelligence', spellcasting: { cantrips_known: 1, spell_slots_level_1: 1 } },
      },
    });

    const result = getSpellAbilities([], stats);

    expect(result).not.toBeNull();
    expect(result.cantrips_known).toBe(1);
    expect(result.spell_slots_level_1).toBe(1);
  });

  // ── Order bonuses: cantrips_known math (disk base + 1) ──

  // Divine Order: Thaumaturge is Cleric-only — the same field on a Wizard is inert.
  it('grants +1 cantrip for Divine Order Thaumaturge Cleric only', () => {
    const cleric = getSpellAbilities([], makePlayerStats({ class: { name: 'Cleric', divineOrder: 'Thaumaturge' } }));
    expect(cleric.cantrips_known).toBe(4); // disk cleric lv1 cantrips_known 3 + order cantrip

    const wizard = getSpellAbilities([], makePlayerStats({ class: { divineOrder: 'Thaumaturge' } }));
    expect(wizard.cantrips_known).toBe(3); // disk wizard lv1 unchanged — gate requires Cleric
  });

  // Primal Order: Magician is Druid-only — the same field on a Cleric is inert.
  it('grants +1 cantrip for Primal Order Magician Druid only', () => {
    const druid = getSpellAbilities([], makePlayerStats({ class: { name: 'Druid', primalOrder: 'Magician' } }));
    expect(druid.cantrips_known).toBe(3); // disk druid lv1 cantrips_known 2 + order cantrip

    const cleric = getSpellAbilities([], makePlayerStats({ class: { name: 'Cleric', primalOrder: 'Magician' } }));
    expect(cleric.cantrips_known).toBe(3); // disk cleric lv1 unchanged — gate requires Druid
  });

  // ── Arcane Trickster grant-count (CLA-218 lane in -automation owns the stamp) ──
  // Disk rogue lv3 table (required_major 'Arcane Trickster') knows 3 cantrips; the
  // trickster grant adds +3 and guarantees the Mage Hand row exactly once even when
  // the row already arrived from the persisted spell list.
  it('adds Mage Hand and +3 cantrips for Arcane Trickster', () => {
    const stats = makePlayerStats({
      level: 3,
      class: { name: 'Rogue', major: { name: 'Arcane Trickster' } },
      spells: ['Mage Hand'],
    });

    const result = getSpellAbilities(diskSpells('Mage Hand'), stats);

    expect(result.cantrips_known).toBe(6);
    const mageHands = result.spells.filter(s => s.name === 'Mage Hand');
    expect(mageHands).toHaveLength(1);
    expect(mageHands[0].prepared).toBe('Always');
  });

  // ── Spell mapping, prepared status and sort ──

  it('maps spell names to spell details: wizard cantrips Always, level 1+ Prepared, and sets maxPreparedSpells', () => {
    const stats = makePlayerStats({ spells: ['Fire Bolt', 'Magic Missile'] });

    const result = getSpellAbilities(diskSpells('Fire Bolt', 'Magic Missile'), stats);

    expect(result.spells).toHaveLength(2);
    const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
    expect(fireBolt.prepared).toBe('Always');
    expect(fireBolt.level).toBe(0);
    const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
    expect(magicMissile.prepared).toBe('Prepared');
    expect(magicMissile.level).toBe(1);
    expect(result.maxPreparedSpells).toBe(4); // disk wizard lv1 prepared_spells
  });

  it('marks all spells Always prepared for non-wizard 2024 classes', () => {
    const stats = makePlayerStats({ class: { name: 'Cleric' }, spells: ['Fire Bolt', 'Magic Missile'] });

    const result = getSpellAbilities(diskSpells('Fire Bolt', 'Magic Missile'), stats);

    expect(result.spells).toHaveLength(2);
    expect(result.spells.every(s => s.prepared === 'Always')).toBe(true);
    expect(result.maxPreparedSpells).toBeUndefined();
  });

  it('sorts spells by level ascending then name alphabetically', () => {
    const stats = makePlayerStats({ spells: ['Shield', 'Fire Bolt', 'Magic Missile', 'Acid Splash'] });

    const result = getSpellAbilities(diskSpells('Acid Splash', 'Fire Bolt', 'Magic Missile', 'Shield'), stats);

    expect(result.spells.map(s => s.name)).toEqual(['Acid Splash', 'Fire Bolt', 'Magic Missile', 'Shield']);
  });

  it('uses missing ability fallback values (modifier=0, toHit=proficiency, saveDc=8+proficiency)', () => {
    const stats = makePlayerStats({
      abilities: [{ name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 0 }],
    });

    const result = getSpellAbilities([], stats);

    expect(result.spellCastingAbility).toBe('Intelligence');
    expect(result.modifier).toBe(0);
    expect(result.toHit).toBe(2); // disk wizard lv1 proficiency_bonus
    expect(result.saveDc).toBe(10);
  });

  // ── Subclass (major) spells: the lv>2 outer gate (inner unlock-level gates are
    // pinned against disk in -advanced / -wildheart) ──

  it('adds major subclass spells from lv3 and never at lv2', () => {
    const makeMajor = () => ({
      name: 'School of Evocation',
      spells: [{ name: 'Shield', level: 1 }, { name: 'Magic Missile', level: 1 }],
    });
    const allSpells = diskSpells('Shield', 'Magic Missile');

    const lv3 = getSpellAbilities(allSpells, makePlayerStats({ level: 3, class: { major: makeMajor() } }));
    expect(lv3.spells.map(s => s.name)).toEqual(['Magic Missile', 'Shield']);
    expect(lv3.spells.every(s => s.prepared === 'Always')).toBe(true);

    const lv2 = getSpellAbilities(cloneDeep(allSpells), makePlayerStats({ level: 2, class: { major: makeMajor() } }));
    expect(lv2.spells).toHaveLength(0);
  });

  it('uses major.spell_casting_ability when class does not have one', () => {
    const stats = makePlayerStats({
      class: { spell_casting_ability: undefined, major: { spell_casting_ability: 'Charisma' } },
      abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
    });

    const result = getSpellAbilities([], stats);

    expect(result.spellCastingAbility).toBe('Charisma');
    expect(result.modifier).toBe(3);
    expect(result.saveDc).toBe(13);
  });

  // ── Zero-caster containers (cited by -automation) ──

  it('zero-caster hosts: cantrip-trait passive builds a slotless container, persisted spells build the half-caster fallback capped to the highest persisted level', () => {
    // disk rogue lv1 table is gated required_major 'Arcane Trickster' → nothing resolves;
    // the trait container must carry no spell_slots_level_* keys (no fabricated slots).
    const traitResult = getSpellAbilities(diskSpells('Light'), makePlayerStats({
      class: { name: 'Rogue', major: { name: 'Assassin' } },
      abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      automation: { passives: [{ type: 'cantrip_spellcasting_ability', cantripName: 'Light', spellcastingAbility: 'Charisma' }] },
    }));
    expect(traitResult).not.toBeNull();
    expect(traitResult._slotlessTraitContainer).toBe(true);
    expect(Object.keys(traitResult).some(k => k.startsWith('spell_slots_level_'))).toBe(false);
    expect(traitResult.spellCastingAbility).toBe('Charisma');
    expect(traitResult.spells.map(s => s.name)).toEqual(['Light']);

    // disk fighter lv9, major Champion: no class table resolves at all, but one
    // persisted lv1 spell takes the half-caster fallback — HALF_CASTER_SLOTS[9] is
    // {1:4, 2:2} but capped to the highest persisted level (lv1) → only lv1 slots.
    const fallbackResult = getSpellAbilities(diskSpells('Magic Missile'), makePlayerStats({
      level: 9,
      class: { name: 'Fighter', major: { name: 'Champion' } },
      spells: ['Magic Missile'],
    }));
    expect(fallbackResult).not.toBeNull();
    expect(Object.keys(fallbackResult).filter(k => k.startsWith('spell_slots_level_'))).toEqual(['spell_slots_level_1']);
    expect(fallbackResult.spell_slots_level_1).toBe(4);
    expect(fallbackResult.cantrips_known).toBe(0);
    expect(fallbackResult.spellCastingAbility).toBe('Intelligence');
    expect(fallbackResult.saveDc).toBe(15); // 8 + INT 3 + disk fighter lv9 PB 4
    expect(fallbackResult.spells.map(s => s.name)).toEqual(['Magic Missile']);
  });

  // ── Automation robustness (the always_prepared payload grant lane is owned by
    // -automation #1266; this pins only the malformed-container tolerance) ──

  it('tolerates automation that is missing, null, empty, or contains no matching feature types', () => {
    const allSpells = diskSpells('Fire Bolt');
    const variants = [
      undefined,
      null,
      { actions: [], bonusActions: [], passives: [{ type: 'some_other_type', effect: 'something' }] },
      { passives: [] }, // missing actions/bonusActions/specialActions arrays
    ];
    for (const automation of variants) {
      const result = getSpellAbilities(allSpells, makePlayerStats({ automation, spells: ['Fire Bolt'] }));
      expect(result, `automation=${JSON.stringify(automation)}`).not.toBeNull();
      expect(result.spells.map(s => s.name), `automation=${JSON.stringify(automation)}`).toEqual(['Fire Bolt']);
    }
  });

  // ── Unknown spell handling (remapSpellRow clone-spell passthrough) ──

  it('handles spell not found in allSpells gracefully (no detail to merge)', () => {
    const stats = makePlayerStats({ spells: ['Unknown Spell'] });

    const result = getSpellAbilities(diskSpells('Fire Bolt'), stats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Unknown Spell');
  });
});
