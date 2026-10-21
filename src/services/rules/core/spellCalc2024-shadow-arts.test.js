// @maintained-by-ai
// CLA-308 regression: Shadow Arts (2024 Warrior of Shadow Monk) — sheet grants/stamps
// lane (cited by automationShadowArts.route.test.js as the grants-stamp owner).
// The Monk disk ladder gates every spellcasting row behind required_major
// 'Warrior of the Elements' (2024/classes.json), so a Warrior of Shadow resolves to
// null there. getSpellAbilities must therefore build a SLOTLESS container from the
// shadow_arts passive (no spell_slots_level_* keys — the persisted-spells half-caster
// fallback would wrongly grant the lv17 Monk 4×L1/3×L2/3×L3) and stamp the passive's
// disk freeCastSpells rows prepared 'Always' + _shadowArtsFreeCast + the passive's
// disk saveAbility casting ability. saveDc comes from Wisdom (8 + WIS 4 + PB), never
// the DC 10 fallback (CLA-277 family).
// Cast authorization/consumption → spellPreparationService.shadowArts.test.js;
// long-rest re-arm → restRules-longRest.shadowArts.test.js; envelope forwarding →
// automationInfoBuilder/core-handlers.test.js. Not re-pinned here.
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import { getSpellAbilities } from './spellCalc2024.js';
import classes2024 from '../../../../public/data/2024/classes.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// Fixture discipline: the class ladder, major block, passive automation payload and
// spells-DB rows are ALL read from disk and deep-cloned before stamping — nothing
// hand-transcribed, so a classes.json/spells.json edit re-drives these rows.
const monk = classes2024.find(c => c.name === 'Monk');
const warriorOfShadow = monk.majors.find(m => m.name === 'Warrior of Shadow');
const shadowArtsAutomation = warriorOfShadow.features.find(f => f.automation?.type === 'shadow_arts').automation;
const SHADOW_NAMES = shadowArtsAutomation.freeCastSpells;
const LADDER = cloneDeep(monk.class_levels);

const diskLevel = name => spells2024.find(s => s.name === name).level;
// All granted rows resolve at their spells-DB level (a Shadow-Arts-distinct fact:
// four lv2 spells on a zero-slot sheet).
const ALL_SPELLS = cloneDeep(spells2024.filter(s => [...SHADOW_NAMES, 'Haste'].includes(s.name)));

function makeShadowArtsPassive() {
  return { ...cloneDeep(shadowArtsAutomation), name: 'Shadow Arts', effect: 'shadow_arts' };
}

function makeMonkStats({ level = 17, major = cloneDeep(warriorOfShadow), automation = null, spells = [] } = {}) {
  return {
    name: 'Disciplined_Monk',
    level,
    rules: '2024',
    proficiency: LADDER[level - 1].proficiency_bonus,
    class: {
      name: 'Monk',
      spell_casting_ability: monk.spell_casting_ability,
      class_levels: LADDER,
      major,
    },
    spells,
    abilities: [
      { name: 'Strength', bonus: 1 },
      { name: 'Dexterity', bonus: 3 },
      { name: 'Wisdom', bonus: 4 },
    ],
    automation: automation || { actions: [], bonusActions: [], specialActions: [], passives: [] },
  };
}

function makeShadowArtsAutomation(passive = makeShadowArtsPassive()) {
  return { actions: [], bonusActions: [], specialActions: [], passives: [passive] };
}

const rowNames = abilities => abilities.spells.map(s => s.name).sort();

describe('spellCalc2024 — CLA-308 Shadow Arts (Warrior of Shadow)', () => {
  // At the first WoS level (3, where major.spells start flowing) and at lv17 (where
  // the half-caster fallback trap lives): the sheet is a slotless Wisdom caster holding
  // exactly the disk free-cast set, always prepared, free-cast stamped, post-filter.
  it.each([3, 17])('lv%i: slotless container, saveDc from Wisdom, exactly the disk free-cast rows stamped', level => {
    const abilities = getSpellAbilities(ALL_SPELLS, makeMonkStats({ level, automation: makeShadowArtsAutomation() }), {});

    expect(abilities).toBeTruthy();
    // Slotless — "without expending spell slots": no slot table keys at all, even
    // though the disk ladder carries Warrior-of-the-Elements spellcasting rows.
    for (let lv = 1; lv <= 9; lv++) {
      expect(abilities[`spell_slots_level_${lv}`], `spell_slots_level_${lv}`).toBeUndefined();
    }
    expect(abilities.cantrips_known).toBe(0);

    const pb = LADDER[level - 1].proficiency_bonus;
    expect(abilities.spellCastingAbility).toBe('Wisdom');
    expect(abilities.modifier).toBe(4);
    expect(abilities.toHit).toBe(4 + pb);
    expect(abilities.saveDc, 'never the DC 10 fallback (CLA-277)').toBe(8 + 4 + pb);

    expect(rowNames(abilities)).toEqual([...SHADOW_NAMES].sort());
    for (const spell of abilities.spells) {
      expect(spell.prepared, spell.name).toBe('Always');
      expect(spell.level, spell.name).toBe(diskLevel(spell.name));
      expect(spell._shadowArtsFreeCast, spell.name).toBe(true);
      expect(spell.spellCastingAbility, spell.name).toBe(shadowArtsAutomation.saveAbility);
    }
  });

  it('never grants the half-caster slot fallback even if spells were persisted', () => {
    const abilities = getSpellAbilities(
      ALL_SPELLS,
      makeMonkStats({ automation: makeShadowArtsAutomation(), spells: ['Darkness', 'Silence', 'Haste'] }),
      {},
    );
    // The shadow_arts container check runs BEFORE the persisted-spells fallback
    // (:616) — flipping that order re-grants lv17 4×L1/3×L2/3×L3 here.
    for (let lv = 1; lv <= 9; lv++) {
      expect(abilities[`spell_slots_level_${lv}`], `spell_slots_level_${lv}`).toBeUndefined();
    }
    // Persisted rows join the granted set (major.spells still adds Darkvision +
    // Pass Without Trace) and all survive the slot-level filter with no slots
    // (a lv3 Haste row on a zero-slot sheet).
    expect(rowNames(abilities)).toEqual(['Darkness', 'Darkvision', 'Haste', 'Pass Without Trace', 'Silence']);
    for (const spell of abilities.spells) {
      expect(spell.prepared, spell.name).toBe('Always');
    }
  });

  it('drives the _shadowArtsFreeCast stamp from passive.freeCastSpells, not major.spells', () => {
    const narrowed = makeShadowArtsPassive();
    narrowed.freeCastSpells = SHADOW_NAMES.filter(n => n !== 'Silence');
    const abilities = getSpellAbilities(ALL_SPELLS, makeMonkStats({ automation: makeShadowArtsAutomation(narrowed) }), {});

    // major.spells still grant all four rows (always prepared)...
    expect(rowNames(abilities)).toEqual([...SHADOW_NAMES].sort());
    const silence = abilities.spells.find(s => s.name === 'Silence');
    expect(silence.prepared).toBe('Always');
    // ...but the free-cast exemption (what spellPreparationService authorizes)
    // follows the passive list ONLY — a row it omits must stay slot-gated.
    expect(silence._shadowArtsFreeCast).toBeUndefined();
    for (const spell of abilities.spells.filter(s => s.name !== 'Silence')) {
      expect(spell._shadowArtsFreeCast, spell.name).toBe(true);
    }
  });

  it('returns null for a Warrior of Shadow WITHOUT the shadow_arts passive (control)', () => {
    // major.spells and the disk ladder alone must not conjure a container — the
    // shadow_arts passive is the grant bearer.
    expect(getSpellAbilities(ALL_SPELLS, makeMonkStats(), {})).toBeNull();
  });
});
