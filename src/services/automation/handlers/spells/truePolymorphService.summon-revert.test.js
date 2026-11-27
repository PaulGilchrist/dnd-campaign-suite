// @maintained-by-ai 2026-11-27
// truePolymorph HEXAD lane #1985 — .summon-revert (SIXTH lane). Subject: truePolymorphService.js.
// Seam map: truePolymorphHandleModes.test.js header (#1980–#1986).
// Siblings: #1983 apply owns the concentration-DC flag + recast-clobber CAUSE at the
// apply side; #1986 transforms owns applyObjectTransform/confirm writes; callers
// (concentrationService, clearExpirationEffects families) mock revertTruePolymorph —
// the revert state machine itself is pinned ONLY here.
//
// LIVENESS (re-verified 2026-11-27):
//   · revertTruePolymorph — LIVE: clearExpirationEffects.js ('true_polymorph' expiry
//     dispatch) + concentrationService.js (revertObjectTransforms caller).
//   · summonCreatureFromObject (:274) — internal-live via confirmTruePolymorphTransform's
//     object_into_creature branch (:140-150), LIVE via CharSheet.jsx. Exported with zero
//     external importers; BOTH entry points pinned below so the contract survives an
//     eventual `export` keyword drop (direct describe retargets through confirm).
//
// ARITY: summonCreatureFromObject destructures NO slotLevel — the in-module caller
// (:146) passes slotLevel: spell.level || 9 and it is SILENTLY DROPPED; summon stats
// are slot-immutable (43g canonical AC + base HP). The routing test keeps the caller's
// slotLevel to pin the drop. getRuntimeValue is really 2-arg; mocks depend on
// (key, subKey) ONLY.
//
// FLAGS (production NOT touched):
// 1. abilities-ARRAY (:88) — cross-ref #1983 flag 1: `playerStats.abilities?.CON?.bonus`
//    reads an OBJECT property off the PROD ABILITIES ARRAY → CON never counts.
//    Pinned honestly: array shape → DC 8+4+0 = 12; object-shape contrast → 14.
// 2. recast-snapshot-clobber — cross-ref #1983 flag 2: apply lanes clobber
//    polymorphOriginal UNCONDITIONALLY. revertObjectTruePolymorph (:386-389) restores
//    whatever the LAST snapshot held — after a recast that is the intermediate form's
//    stats, never the true original. Same branch as the plain object revert, so the
//    consequence is pinned in that test (restore-follows-snapshot), not a twin test.
// 3. NAME COLLISION: this summon lane never uniquifies — name: monster.name verbatim
//    (:295). Siblings suffix via getNextUniqueMonsterName. Shipped duplicate-name
//    behavior pinned honestly; final-report action.
// 4. SAVE PROBE: getMonsterSaveBonuses (:345-359) reads monster.special_abilities — no
//    disk row has that key (rows expose `traits`), so real summons NEVER gain save
//    proficiency; the substring probe ('Sprint'.includes('int') class) only fires on
//    synthetic fixtures — pinned as a synthetic-shape quirk. Post no-legacy sweep
//    (2026-11-16) the resistances/immunities read (:301-302) is damage_*-only with NO
//    legacy fallback — disk rows were renamed to damage_*, so authored lists survive.
// 5. revertSummoned/revertObject NEVER release caster concentration — the persisted cs
//    keeps caster.concentration byte-intact (:362/:410 spread). Release lives upstream in
//    concentrationService. No-side-effect censuses pin the absence of tempHp/
//    activeConditions/concentration writes on both revert lanes.
//
// Turn-based only: no timers in either subject function; te duration 'concentration' +
// expiry is seam-cleared (no-timers policy). resolveSummonInitiative's Math.random
// fallback (:84) is pinned BOTH ways: UNREACHED with a concrete caster initiative, and
// deterministically rolled (spy 0.5) when the caster lacks one — absorbing the
// random-initiative tests #1986's SHED LEDGER delegates to this lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import monstersData from '../../../../../public/data/monsters.json' with { type: 'json' };

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

// Bare vi.fn — resolving behavior re-seeded every beforeEach (a rejecting-mock test
// below would otherwise leak past clearAllMocks, which keeps return values).
vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('./truePolymorphHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('./polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

import {
  summonCreatureFromObject,
  revertTruePolymorph,
  confirmTruePolymorphTransform,
} from './truePolymorphService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { revertPolymorph } from './polymorphService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

// PROD-SHAPE playerStats (flag 1): abilities is an ARRAY of named entries — the
// shape verified in test-campaign/*.json. NEVER an object with .CON here.
function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Constitution', baseScore: 14 }],
    ...overrides,
  };
}

// Direct-call signature :274 destructures NO slotLevel — arity-clean payload.
function summonArgs(overrides = {}) {
  return {
    monsterIndex: 'wolf',
    casterName,
    initiativeValue: 15,
    playerStats: makePlayerStats(),
    campaignName,
    ...overrides,
  };
}

describe('truePolymorphService.summonCreatureFromObject', () => {
  let cs;
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    cs = { creatures: [{ name: casterName, type: 'player' }] };
    getCombatSummary.mockReturnValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      return undefined;
    });
  });

  it('spawns the DISK wolf row byte-clean into combat (canonical stats, no slot scaling, 43g) and logs the full summon sentence', async () => {
    const wolfRow = monstersData.find(m => m.index === 'wolf');
    // Data lock: disk bytes the summon lane reads (:282-310). Shape truth after the
    // no-legacy sweep (2026-11-16): the wolf's empty legacy `immunities`/
    // `resistances` keys became canonical empty damage_* keys; the row still
    // has NO special_abilities, so te-save prof reads as empty here.
    expect({
      index: wolfRow.index, armor_class: wolfRow.armor_class, hit_points: wolfRow.hit_points,
      type: wolfRow.type, size: wolfRow.size, speed: wolfRow.speed, proficiency_bonus: wolfRow.proficiency_bonus,
      special_abilities: wolfRow.special_abilities, damage_immunities: wolfRow.damage_immunities,
      damage_resistances: wolfRow.damage_resistances, immunities: wolfRow.immunities, resistances: wolfRow.resistances,
    }).toEqual({
      index: 'wolf', armor_class: 12, hit_points: 11, type: 'Beast', size: 'Medium',
      speed: { walk: '40 ft.' }, proficiency_bonus: 2,
      special_abilities: undefined, damage_immunities: [], damage_resistances: [],
      immunities: undefined, resistances: undefined,
    });
    loadMonsters.mockResolvedValue([wolfRow]);

    const result = await summonCreatureFromObject(summonArgs());

    expect(result).toEqual({ ok: true, creatureName: 'Wolf' });
    const wolf = cs.creatures.find(c => c.name === 'Wolf');
    const { actions, ...rest } = wolf;
    expect(rest).toEqual({
      name: 'Wolf',
      type: 'npc',
      monsterType: 'Beast',
      initiative: '14.9',
      targetName: null,
      ac: 12, // canonical monsters.json armor_class — no slot scaling (43g, :282/:286)
      resistances: [],
      immunities: [],
      concentration: null,
      maxHp: 11, // base HP — summon is slot-immutable (:283/:287)
      currentHp: 11,
      saveBonuses: { str: 2, dex: 2, con: 1, int: -4, wis: 1, cha: -2 },
      monsterIndex: 'wolf',
      size: 'Medium',
      speed: { walk: '40 ft.' },
      summonedBy: casterName,
      summonSource: 'true_polymorph',
    });
    expect(actions).toBe(wolfRow.actions); // byte passthrough, no reshaping (:310)
    expect(cs.creatures.filter(c => c.name === 'Wolf')).toHaveLength(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: casterName,
      abilityName: 'True Polymorph',
      description: `${casterName} transforms an object into Wolf. The creature is friendly to you and your companions.`,
    });
  });

  it('short-circuits no_monster BEFORE any combat read', async () => {
    loadMonsters.mockResolvedValue([{ index: 'other', name: 'Other' }]);

    const result = await summonCreatureFromObject(summonArgs({ monsterIndex: 'nonexistent' }));

    expect(result).toEqual({ ok: false, reason: 'no_monster' });
    expect(getCombatSummary).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('returns no_combat after the monster lookup when there is no combat summary', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);
    getCombatSummary.mockReturnValue(null);

    const result = await summonCreatureFromObject(summonArgs());

    expect(result).toEqual({ ok: false, reason: 'no_combat' });
    expect(loadMonsters).toHaveBeenCalledWith(); // load-first order (:275 before :289)
    expect(storage.set).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('applies defaults for a minimal monster (hp 0 → 10, retired legacy immunities ignored, speed/type)', async () => {
    // honest: :283 `hit_points || 10` turns an authored 0-HP into 10;
    // the retired legacy `immunities` key is dead bytes — damage_immunities
    // is the only channel (no-legacy sweep 2026-11-16).
    loadMonsters.mockResolvedValue([{
      index: 'empty',
      name: 'Empty',
      armor_class: 10,
      hit_points: 0,
      immunities: ['poison'],
      ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiency_bonus: 2,
    }]);

    const result = await summonCreatureFromObject(summonArgs({ monsterIndex: 'empty' }));

    expect(result).toEqual({ ok: true, creatureName: 'Empty' });
    const creature = cs.creatures.find(c => c.name === 'Empty');
    expect(creature.maxHp).toBe(10);
    expect(creature.currentHp).toBe(10);
    expect(creature.immunities).toEqual([]);
    expect(creature.resistances).toEqual([]);
    expect(creature.type).toBe('npc');
    expect(creature.monsterType).toBeUndefined();
    expect(creature.size).toBe('Medium');
    expect(creature.speed).toEqual({ walk: '30 ft.' });
    expect(creature.actions).toEqual([]);
  });

  it('spawns the DISK fire-elemental row: immunities AND resistances ride the canonical damage_* keys (post-sweep: lists survive, flag 4)', async () => {
    const row = monstersData.find(m => m.index === 'fire-elemental');
    // Data lock: the sweep renamed this row's legacy immunities/resistances
    // lists to damage_immunities/damage_resistances — the exact bytes the
    // summon lane reads (:301-302, no legacy fallback remains).
    expect({ armor_class: row.armor_class, hit_points: row.hit_points, damage_immunities: row.damage_immunities, damage_resistances: row.damage_resistances, immunities: row.immunities, resistances: row.resistances })
      .toEqual({ armor_class: 13, hit_points: 93, damage_immunities: ['Fire', 'Poison'], damage_resistances: ['Bludgeoning', 'Piercing', 'Slashing'], immunities: undefined, resistances: undefined });
    loadMonsters.mockResolvedValue([row]);

    await summonCreatureFromObject(summonArgs({ monsterIndex: 'fire-elemental' }));

    const creature = cs.creatures.find(c => c.name === 'Fire Elemental');
    expect({ ac: creature.ac, maxHp: creature.maxHp, currentHp: creature.currentHp, size: creature.size, speed: creature.speed, monsterType: creature.monsterType })
      .toEqual({ ac: 13, maxHp: 93, currentHp: 93, size: 'Large', speed: { walk: '50 ft.' }, monsterType: 'Elemental' });
    expect(creature.immunities).toEqual(['Fire', 'Poison']); // damage_immunities (:302)
    expect(creature.resistances).toEqual(['Bludgeoning', 'Piercing', 'Slashing']); // damage_resistances (:301)
    // saveBonuses pure ability math — saving_throws ignored, no special_abilities on disk:
    expect(creature.saveBonuses).toEqual({ str: 0, dex: 3, con: 3, int: -2, wis: 0, cha: -2 });
    expect(creature.actions).toBe(row.actions);
  });

  it('SYNTHETIC-shape quirk (flag 4): substring probe gives phantom INT proficiency from "Sprint"', async () => {
    // :351-356 grants proficiency when a special_abilities NAME merely CONTAINS the
    // ability substring — 'Sprint'.includes('int'). Disk rows carry traits, never
    // special_abilities, so this only fires on synthetic callers/fixtures; pinned honest.
    loadMonsters.mockResolvedValue([{
      index: 'seer',
      name: 'Seer',
      armor_class: 11,
      hit_points: 9,
      ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiency_bonus: 2,
      special_abilities: [{ name: 'Sprint' }],
    }]);

    await summonCreatureFromObject(summonArgs({ monsterIndex: 'seer' }));

    const creature = cs.creatures.find(c => c.name === 'Seer');
    expect(creature.saveBonuses).toEqual({ str: 0, dex: 0, con: 0, int: 2, wis: 0, cha: 0 });
  });

  it('POSTs the exact summoned targetEffect AFTER the combat-summary persist (§6-#18 order)', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    await summonCreatureFromObject(summonArgs());

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ target: 'Wolf', source: casterName, effect: 'summoned', duration: 'concentration' }],
      campaignName,
      true,
    );
    // Sequential await (:319-328): cs persist must land BEFORE the te POST.
    expect(storage.set.mock.invocationCallOrder[0])
      .toBeLessThan(setRuntimeValue.mock.invocationCallOrder[0]);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(cs, campaignName);
  });

  it('does not duplicate an existing summoned targetEffect and writes nothing to te', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [{ target: 'Wolf', source: casterName, effect: 'summoned', duration: 'concentration' }];
      }
      return undefined;
    });

    const result = await summonCreatureFromObject(summonArgs());

    expect(result.ok).toBe(true);
    const effectsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
    expect(effectsCalls).toHaveLength(0);
    expect(addEntry).toHaveBeenCalledTimes(1); // summon still lands, only te write skipped
  });

  it.each([
    ['prod ARRAY abilities shape — CON never counts (flag 1)', [{ name: 'Constitution', baseScore: 14 }], 12],
    ['object-shape contrast — documents the array divergence', { CON: { bonus: 2 } }, 14],
  ])('registers concentration DC %i from %s', async (_label, abilities, expectedDc) => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    await summonCreatureFromObject(summonArgs({ playerStats: makePlayerStats({ abilities }) }));

    // :88 8 + proficiency(4) + abilities?.CON?.bonus — ARRAY has no .CON → +0.
    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'True Polymorph', expectedDc);
  });

  it('SHIPS DUPLICATE NAMES — no getNextUniqueMonsterName seam (flag 3)', async () => {
    // Siblings uniquify (animateDead, summonSpirit, createUndead); this lane spawns
    // monster.name verbatim (:295). Honest pin, action in final report.
    cs.creatures.push({ name: 'Wolf', type: 'npc' });
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    const result = await summonCreatureFromObject(summonArgs());

    expect(result).toEqual({ ok: true, creatureName: 'Wolf' });
    expect(cs.creatures.filter(c => c.name === 'Wolf')).toHaveLength(2);
  });

  it('object_into_creature with NO target routes through confirmTruePolymorphTransform to the summon seam (:140-150)', async () => {
    // LIVE entry (CharSheet.jsx). Caster init '15' → parseInt 15 → init '14.9';
    // Math.random fallback (:84) pinned UNREACHED; caller's slotLevel (:146) DROPPED
    // (arity: :274 does not destructure it) — wolf still gets canonical disk stats.
    const wolfRow = monstersData.find(m => m.index === 'wolf');
    cs.creatures[0].initiative = '15';
    loadMonsters.mockResolvedValue([wolfRow]);
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('initiative must resolve deterministically from caster init 15');
    });
    try {
      const result = await confirmTruePolymorphTransform({
        targetName: null,
        creature: wolfRow,
        casterName,
        spell: { name: 'True Polymorph', level: 9 },
        playerStats: makePlayerStats(),
        campaignName,
        mode: 'object_into_creature',
      });

      expect(result).toEqual({ ok: true, creatureName: 'Wolf' });
      expect(getCombatContext).not.toHaveBeenCalled(); // summon branch skips the cs-context lane
      const wolf = cs.creatures.find(c => c.name === 'Wolf');
      expect({ ac: wolf.ac, maxHp: wolf.maxHp, initiative: wolf.initiative })
        .toEqual({ ac: 12, maxHp: 11, initiative: '14.9' });
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('caster with NO concrete initiative takes the random fallback (:80-84): roll + initiativeBonus, same −0.1 offset', async () => {
    // Absorbs the random-initiative tests #1986's SHED LEDGER delegates here.
    // Spy 0.5 → floor(0.5*20)+1+bonus(3) = 14 → wolf lands at '13.9'.
    cs.creatures[0].initiative = '';
    cs.creatures[0].initiativeBonus = 3;
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const result = await confirmTruePolymorphTransform({
        targetName: null,
        creature: { index: 'wolf' },
        casterName,
        spell: { name: 'True Polymorph', level: 9 },
        playerStats: makePlayerStats(),
        campaignName,
        mode: 'object_into_creature',
      });

      expect(result).toEqual({ ok: true, creatureName: 'Wolf' });
      expect(randomSpy).toHaveBeenCalledTimes(1);
      expect(cs.creatures.find(c => c.name === 'Wolf').initiative).toBe('13.9');
    } finally {
      randomSpy.mockRestore();
    }
  });
});

describe('truePolymorphService.revertTruePolymorph', () => {
  // Revert-lane object fixture factory: object-form shape unless overridden.
  function objectCreature(overrides = {}) {
    return {
      name: targetName,
      type: 'npc',
      polymorphSource: casterName,
      polymorphObject: { type: 'stone_block' },
      polymorphOriginal: { maxHp: 15 },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue(undefined);
    getRuntimeValue.mockReturnValue([]);
  });

  it.each([
    ['no combat summary at all', null],
    ['combat summary without creatures', { creatures: null }],
    ['no creature matching the target', { creatures: [{ name: casterName, type: 'player' }] }],
    ['target with no polymorph fields', { creatures: [{ name: targetName, type: 'npc', maxHp: 15, ac: 13, speed: '30 ft.' }] }],
  ])('refusal gate (%s): returns false with a zero-write census', (_label, summary) => {
    getCombatSummary.mockReturnValue(summary);

    expect(revertTruePolymorph(targetName, campaignName)).toBe(false);
    expect(revertPolymorph).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(setCombatSummaryCache).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('summoned revert: exact persist, byte-intact caster concentration, exact te write, full-string log', () => {
    const conc = { id: 'conc-1', spell: 'True Polymorph', dc: 12, target: null };
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: targetName, type: 'npc', summonedBy: casterName, summonSource: 'true_polymorph' },
        { name: casterName, type: 'player', concentration: conc },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: targetName, source: casterName, effect: 'summoned', duration: 'concentration' },
          { target: 'Other', source: 'Other', effect: 'hold_monster' },
        ];
      }
      return [];
    });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(true);
    const storedCs = storage.set.mock.calls[0][1];
    expect(storage.set.mock.calls[0][0]).toBe('combatSummary');
    expect(storage.set.mock.calls[0][2]).toBe(campaignName);
    expect(storedCs.creatures).toEqual([
      // flag 5: revert does NOT release concentration — caster entry persisted byte-intact.
      { name: casterName, type: 'player', concentration: { id: 'conc-1', spell: 'True Polymorph', dc: 12, target: null } },
    ]);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(storedCs, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ target: 'Other', source: 'Other', effect: 'hold_monster' }],
      campaignName,
      true,
    );
    // honest attribution: the fades-away log is keyed to the TARGET, not the caster (:377).
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: targetName,
      abilityName: 'True Polymorph',
      description: `${targetName} fades away as the True Polymorph spell ends.`,
    });
    expect(revertPolymorph).not.toHaveBeenCalled();
    expect(addConcentration).not.toHaveBeenCalled();
  });

  it('summoned revert with no matching targetEffects writes nothing to te but still persists and logs', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: targetName, type: 'npc', summonedBy: casterName, summonSource: 'true_polymorph' },
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockReturnValue([]);

    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);
    expect(setRuntimeValue).not.toHaveBeenCalled(); // length guard :371
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it('summoned lane takes precedence over object fields when both are present (:435 checked first)', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        summonedBy: casterName,
        summonSource: 'true_polymorph',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
      }],
    });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(true);
    const storedCs = storage.set.mock.calls[0][1];
    expect(storedCs.creatures).toEqual([]); // removed, not reverted-in-place
    expect(addEntry.mock.calls[0][1].description).toBe(`${targetName} fades away as the True Polymorph spell ends.`);
    expect(revertPolymorph).not.toHaveBeenCalled();
  });

  it('object revert: restores whatever polymorphOriginal holds (flag 2 consequence — after a recast that is the LAST snapshot, never the true original), strips all four bookkeeping keys, currentHp untouched, filters the object_transform te past unrelated effects, persists and logs', () => {
    // :386-389 copies the snapshot verbatim — the CAUSE (unguarded clobber at
    // applyCreatureForm/polymorphObject) is #1983 flag 2; the revert-lane consequence
    // is that restoration strictly follows snapshot bytes, pinned by this single
    // full-shape toEqual on the whole reverted creature.
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        maxHp: 34,
        currentHp: 8,
        ac: 11,
        speed: '40 ft.',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block', icon: 'fa-cube' },
        objectType: 'stone_block',
        polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
      }],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: targetName, source: casterName, effect: 'object_transform', duration: 'concentration', objectType: 'stone_block' },
          { target: 'Other', source: 'Other', effect: 'hold_monster' },
        ];
      }
      return [];
    });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);

    // Full-shape: maxima restored from snapshot, currentHp untouched (:386-389 restores
    // maxima only), ALL polymorph bookkeeping keys gone in one assertion.
    expect(getCombatSummary(campaignName).creatures[0]).toEqual({
      name: targetName,
      type: 'npc',
      maxHp: 15,
      currentHp: 8,
      ac: 13,
      speed: '30 ft.',
    });
    expect(setRuntimeValue).toHaveBeenCalledTimes(1); // te filter wrote once; no condition key was present
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ target: 'Other', source: 'Other', effect: 'hold_monster' }],
      campaignName,
      true,
    );
    const storedCs = storage.set.mock.calls[0][1];
    expect(storage.set).toHaveBeenCalledWith('combatSummary', storedCs, campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalledWith(storedCs, campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: targetName,
      abilityName: 'True Polymorph',
      description: `${targetName} reverts to their normal form.`,
    });
    expect(revertPolymorph).not.toHaveBeenCalled();
  });

  it('partial snapshot: undefined keys leave maxHp/speed untouched (:387-389 guards)', () => {
    getCombatSummary.mockReturnValue({
      creatures: [objectCreature({
        maxHp: 34,
        ac: 11,
        speed: '40 ft.',
        polymorphOriginal: { ac: 13 }, // ac ONLY
      })],
    });

    revertTruePolymorph(targetName, campaignName);

    const creature = getCombatSummary(campaignName).creatures[0];
    expect(creature.ac).toBe(13);
    expect(creature.maxHp).toBe(34); // untouched — snapshot had no maxHp
    expect(creature.speed).toBe('40 ft.'); // untouched
  });

  it.each([
    ['case-insensitive removal: "Incapacitated" dropped, "blinded" survives', ['Incapacitated', 'blinded'], ['blinded']],
    ['nothing to remove → zero condition writes', ['blinded'], null],
  ])('object revert conditions (%s)', (_label, conditions, expectedWrite) => {
    getCombatSummary.mockReturnValue({ creatures: [objectCreature()] });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return conditions;
      return [];
    });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);

    const condWrites = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
    if (expectedWrite) {
      expect(condWrites).toEqual([[targetName, 'activeConditions', expectedWrite, campaignName]]); // 4-arg, no skipSync (:398)
    } else {
      expect(condWrites).toHaveLength(0); // length guard :397
    }
    // tempHp hygiene (guard 5): object revert composes no tempHp (creature_to_creature
    // THP subtraction lives in revertPolymorph :156-165, delegated lane).
    expect(setRuntimeValue.mock.calls.filter(call =>
      call[1] === 'tempHp' || call[1] === 'polymorphTempHp')).toHaveLength(0);
  });

  it('creature_to_creature lane delegates to revertPolymorph with exact args and passes its result through', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        polymorphSource: casterName,
        polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
      }],
    });
    // Delegation-only lane: the polymorphOriginal WITHOUT polymorphObject (:443), so
    // the object lane (:439) is skipped. Return values set plainly (no *Once ordering).
    revertPolymorph.mockReturnValue(false);
    expect(revertTruePolymorph(targetName, campaignName)).toBe(false); // honest pass-through, not a swallowed true

    revertPolymorph.mockReturnValue(true);
    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);

    expect(revertPolymorph).toHaveBeenCalledWith(targetName, campaignName);
    expect(revertPolymorph).toHaveBeenCalledTimes(2);
    expect(storage.set).not.toHaveBeenCalled(); // delegation lane composes no local persist
  });

  it.each([
    ['summoned', { name: targetName, type: 'npc', summonedBy: casterName, summonSource: 'true_polymorph' }],
    ['object', objectCreature()],
  ])('%s revert survives a REJECTED addEntry log (.catch :380/:419)', (_label, creature) => {
    addEntry.mockReturnValue(Promise.reject(new Error('log down')));
    getCombatSummary.mockReturnValue({ creatures: [creature] });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledTimes(1); // the revert itself still commits
  });
});
