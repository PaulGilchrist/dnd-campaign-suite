// @maintained-by-ai
// truePolymorph HEXAD lane #1985 — .summon-revert (SIXTH lane). Subject: truePolymorphService.js.
// Seam map: truePolymorphHandleModes.test.js header (#1980–#1986).
// Siblings closed: #1980 handleModes 5, #1981 handler 29, #1982 resolveMaxCR 33
// (canonical), #1983 apply 17 (merge/clobber flags carried there), #1984 queries
// (four dead predicates retired per #1916 precedent). #1986 .transforms queues after —
// transform-APPLICATION content (first-transform stat swap, te stamp, tempHp byte-twins)
// belongs there; this lane owns ONLY summon-spawn + revert mechanics.
//
// LIVENESS (verified by fresh repo-wide grep 2026-10-16):
//   · revertTruePolymorph — LIVE: clearExpirationEffects.js:8 (import) + :450
//     ('true_polymorph' expiry dispatch) and concentrationService.js:15 (import) +
//     :192 (revertObjectTransforms: te.target normalized via te.target[0], then calls).
//   · summonCreatureFromObject (:274) — INTERNAL-LIVE: sole consumer is
//     confirmTruePolymorphTransform's object_into_creature branch (:140-150), which is
//     LIVE via CharSheet.jsx:25. Export keyword has ZERO external importers (no barrel;
//     automation/index.js dispatches handle from truePolymorphHandler.js only — #1984).
//     Per #1916 dead-export precedent the final report may drop `export`; if it does,
//     this lane's confirm-routing test is the surviving entry point, the direct describe
//     retargets through it. Contract pinned both ways below.
//
// ARITY (verified): summonCreatureFromObject destructures
// {monsterIndex, casterName, initiativeValue, playerStats, campaignName} — NO slotLevel.
// The in-module caller (:146) passes slotLevel: spell.level || 9 and it is SILENTLY
// DROPPED; summon stats are slot-immutable (43g canonical AC + base HP). Direct calls
// here therefore pass no slotLevel; the routing test keeps the caller's slotLevel to pin
// the drop. getRuntimeValue is really 2-arg (useRuntimeState.js:63) — the prod 3rd
// campaignName arg is ignored; all mocks below depend on (key, subKey) ONLY.
// addConcentration is (combatSummary, creatureName, spellName, dc, target=null)
// (concentrationService.js:111) — prod addCasterConcentration (:87-92) passes 4 args;
// it silently no-ops when the caster is absent from combatSummary.creatures (:112).
//
// CARRIED / RAISED FLAGS (production NOT touched):
// 1. abilities-ARRAY (:88) — cross-ref #1983 flag 1: `playerStats.abilities?.CON?.bonus`
//    reads an OBJECT property off the PROD ABILITIES ARRAY → CON never counts.
//    Pinned honestly: array shape → DC 8+4+0 = 12; object-shape contrast → 14.
// 2. recast-snapshot-clobber — cross-ref #1983 flag 2: applyCreatureForm (:98) AND
//    applyObjectTransform (:221) clobber polymorphOriginal UNCONDITIONALLY. This lane's
//    revertObjectTruePolymorph (:386-389) restores whatever the LAST snapshot held —
//    after a recast that is the intermediate form's stats, never the true original.
//    Pinned honestly below.
// 3. NAME COLLISION (raised here): this summon lane never uniquifies — name: monster.name
//    verbatim (:295). Every sibling summon path suffixes via getNextUniqueMonsterName
//    (encounterToInitiative.js:151; animateDeadHandler.js:92, summonSpiritHandler.js:430,
//    createUndeadHandler.js:41). A second Wolf yields duplicate combat names AND an
//    ambiguous name-keyed 'summoned' te. Pinned as shipped; final-report action.
// 4. SHAPE MISMATCH vs disk (raised here; cf. cla138 fixture-truth class):
//    · getMonsterSaveBonuses (:345-359) reads monster.special_abilities — NO disk row in
//      public/data/monsters.json has that key (rows expose `traits`; saving_throws exist
//      but are ignored). Real summons therefore NEVER gain save proficiency, and the
//      substring probe ('darkvision'.includes('int') class) only fires on synthetic
//      special_abilities fixtures — pinned as a synthetic-shape quirk below.
//    · :301-302 resistances reads damage_resistances (absent on disk → []), DISK
//      `resistances` is ignored → summoned Fire Elemental loses its authored
//      Bludgeoning/Piercing/Slashing resistances; immunities survive only via the
//      :302 `|| monster.immunities` fallback, capitalised byte-preserved.
//      Pinned honestly on the disk fire-elemental row; final-report action.
// 5. revertSummoned/revertObject NEVER release caster concentration — the persisted cs
//    keeps caster.concentration byte-intact (:362/:410 spread). Release lives upstream in
//    concentrationService (:187-192 is the caller). No-side-effect guards pin the absence
//    of tempHp/activeConditions/concentration writes on both revert lanes.
//
// Turn-based only: no timers in either subject function; duration 'concentration' +
// expiry is seam-cleared (no-timers policy). resolveSummonInitiative's Math.random
// fallback (:84) is pinned UNREACHED when the caster has a concrete initiative.
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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { get: vi.fn(), set: vi.fn(() => Promise.resolve()) },
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
    cs = { creatures: [{ name: casterName, type: 'player' }] };
    getCombatSummary.mockReturnValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      return undefined;
    });
  });

  it('spawns the DISK wolf row byte-clean into combat (canonical stats, no slot scaling, 43g)', async () => {
    const wolfRow = monstersData.find(m => m.index === 'wolf');
    // Data lock: disk bytes summon reads (:282-310). Shape truth (flag 4): the row has
    // NO special_abilities/damage_immunities/damage_resistances keys — only traits/
    // immunities/resistances, so te-save prof and resistances read as empty here.
    expect({
      index: wolfRow.index, armor_class: wolfRow.armor_class, hit_points: wolfRow.hit_points,
      type: wolfRow.type, size: wolfRow.size, speed: wolfRow.speed, proficiency_bonus: wolfRow.proficiency_bonus,
      special_abilities: wolfRow.special_abilities, damage_immunities: wolfRow.damage_immunities,
      damage_resistances: wolfRow.damage_resistances, immunities: wolfRow.immunities, resistances: wolfRow.resistances,
    }).toEqual({
      index: 'wolf', armor_class: 12, hit_points: 11, type: 'Beast', size: 'Medium',
      speed: { walk: '40 ft.' }, proficiency_bonus: 2,
      special_abilities: undefined, damage_immunities: undefined, damage_resistances: undefined,
      immunities: [], resistances: [],
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

  it('applies defaults and || fallbacks for a minimal monster (hp 0 → 10, immunities chain, speed/type)', async () => {
    // honest: :283 `hit_points || 10` turns an authored 0-HP into 10;
    // :302 damage_immunities wins, monster.immunities is the fallback.
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
    expect(creature.immunities).toEqual(['poison']);
    expect(creature.resistances).toEqual([]);
    expect(creature.type).toBe('npc');
    expect(creature.monsterType).toBeUndefined();
    expect(creature.size).toBe('Medium');
    expect(creature.speed).toEqual({ walk: '30 ft.' });
    expect(creature.actions).toEqual([]);
  });

  it('spawns the DISK fire-elemental row: immunities via :302 fallback (capitalised bytes), resistances DROPPED (flag 4)', async () => {
    const row = monstersData.find(m => m.index === 'fire-elemental');
    // Data lock: disk exposes immunities/resistances; summon only reads damage_*.
    expect({ armor_class: row.armor_class, hit_points: row.hit_points, immunities: row.immunities, resistances: row.resistances })
      .toEqual({ armor_class: 13, hit_points: 93, immunities: ['Fire', 'Poison'], resistances: ['Bludgeoning', 'Piercing', 'Slashing'] });
    loadMonsters.mockResolvedValue([row]);

    await summonCreatureFromObject(summonArgs({ monsterIndex: 'fire-elemental' }));

    const creature = cs.creatures.find(c => c.name === 'Fire Elemental');
    expect({ ac: creature.ac, maxHp: creature.maxHp, currentHp: creature.currentHp, size: creature.size, speed: creature.speed, monsterType: creature.monsterType })
      .toEqual({ ac: 13, maxHp: 93, currentHp: 93, size: 'Large', speed: { walk: '50 ft.' }, monsterType: 'Elemental' });
    expect(creature.immunities).toEqual(['Fire', 'Poison']); // || monster.immunities (:302)
    expect(creature.resistances).toEqual([]); // damage_resistances absent → authored resistances lost
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

  it('registers concentration DC 12 from the PROD ARRAY abilities shape — CON never counts (flag 1)', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    await summonCreatureFromObject(summonArgs());

    // :88 8 + proficiency(4) + abilities?.CON?.bonus — ARRAY has no .CON → +0.
    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'True Polymorph', 12);
  });

  it('object-shape contrast: object abilities would yield DC 14 (documents the array divergence)', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    await summonCreatureFromObject(summonArgs({
      playerStats: makePlayerStats({ abilities: { CON: { bonus: 2 } } }),
    }));

    expect(addConcentration).toHaveBeenCalledWith(cs, casterName, 'True Polymorph', 14);
  });

  it('logs the summon with the full composed sentence and exact entry shape', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    await summonCreatureFromObject(summonArgs());

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: casterName,
      abilityName: 'True Polymorph',
      description: `${casterName} transforms an object into Wolf. The creature is friendly to you and your companions.`,
    });
  });

  it('SHIPS DUPLICATE NAMES — no getNextUniqueMonsterName seam (flag 3)', async () => {
    // Siblings uniquify (animateDead :92, summonSpirit :430, createUndead :41);
    // this lane spawns monster.name verbatim (:295). Honest pin, action in final report.
    cs.creatures.push({ name: 'Wolf', type: 'npc' });
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    const result = await summonCreatureFromObject(summonArgs());

    expect(result).toEqual({ ok: true, creatureName: 'Wolf' });
    expect(cs.creatures.filter(c => c.name === 'Wolf')).toHaveLength(2);
  });

  it('object_into_creature with NO target routes through confirmTruePolymorphTransform to the summon seam (:140-150)', async () => {
    // LIVE entry (CharSheet.jsx:25). Caster init '15' → parseInt 15 → init '14.9';
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
});

describe('truePolymorphService.revertTruePolymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
  });

  it('returns false with zero writes when combat summary has no creatures', () => {
    getCombatSummary.mockReturnValue({ creatures: null });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('returns false with zero writes when target creature is not found', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: casterName, type: 'player' }] });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
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
      creatures: [
        {
          name: targetName,
          type: 'npc',
          summonedBy: casterName,
          summonSource: 'true_polymorph',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(true);
    const storedCs = storage.set.mock.calls[0][1];
    expect(storedCs.creatures).toEqual([]); // removed, not reverted-in-place
    expect(addEntry.mock.calls[0][1].description).toBe(`${targetName} fades away as the True Polymorph spell ends.`);
    expect(revertPolymorph).not.toHaveBeenCalled();
  });

  it('object revert restores snapshot ac/maxHp/speed, deletes polymorph bookkeeping, leaves currentHp untouched', () => {
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

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(true);
    const creature = getCombatSummary(campaignName).creatures[0];
    expect(creature.maxHp).toBe(15);
    expect(creature.ac).toBe(13);
    expect(creature.speed).toBe('30 ft.');
    expect(creature.currentHp).toBe(8); // honest: revert restores maxima only (:386-389)
    expect(creature.polymorphObject).toBeUndefined();
    expect(creature.objectType).toBeUndefined();
    expect(creature.polymorphSource).toBeUndefined();
    expect(creature.polymorphOriginal).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
    expect(revertPolymorph).not.toHaveBeenCalled();
  });

  it('recast-clobber consequence (flag 2): revert restores the LAST snapshot, never the true original', () => {
    // Goblin(7) → bear recast clobbered polymorphOriginal to bear-form bytes at :98;
    // object snapshot :221 same unguarded clobber. Revert lands on the snapshot it
    // finds — the intermediate form — cross-ref #1983 flag 2.
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        maxHp: 20, // damaged current form
        currentHp: 12,
        ac: 12,
        speed: '40 ft.',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { maxHp: 34, ac: 12, speed: '40 ft.' }, // BEAR snapshot
      }],
    });

    revertTruePolymorph(targetName, campaignName);

    const creature = getCombatSummary(campaignName).creatures[0];
    expect({ maxHp: creature.maxHp, ac: creature.ac, speed: creature.speed })
      .toEqual({ maxHp: 34, ac: 12, speed: '40 ft.' }); // bear, not Goblin's 7
  });

  it('partial snapshot: undefined keys leave maxHp/speed untouched (:387-389 guards)', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        maxHp: 34,
        ac: 11,
        speed: '40 ft.',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { ac: 13 }, // ac ONLY
      }],
    });

    revertTruePolymorph(targetName, campaignName);

    const creature = getCombatSummary(campaignName).creatures[0];
    expect(creature.ac).toBe(13);
    expect(creature.maxHp).toBe(34); // untouched — snapshot had no maxHp
    expect(creature.speed).toBe('40 ft.'); // untouched
  });

  it('removes incapacitated case-insensitively with one exact write; other conditions survive', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { maxHp: 15 },
      }],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['Incapacitated', 'blinded'];
      return [];
    });

    revertTruePolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'activeConditions', ['blinded'], campaignName);
  });

  it('no incapacitated present → zero condition writes; revert never touches tempHp keys (guard 5)', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { maxHp: 15 },
      }],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['blinded'];
      return [];
    });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);
    const condCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');
    expect(condCalls).toHaveLength(0);
    // tempHp/te hygiene: object revert composes no tempHp (applyObjectTransform never
    // sets it; creature_to_creature THP subtraction lives in revertPolymorph :156-165).
    const tempHpCalls = setRuntimeValue.mock.calls.filter(call =>
      call[1] === 'tempHp' || call[1] === 'polymorphTempHp');
    expect(tempHpCalls).toHaveLength(0);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
  });

  it('removes the object_transform te with an unconditional exact write and skipSync', () => {
    // replaces the old `if (effectsCall)` soft-guard: the write MUST happen here.
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { maxHp: 15 },
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

    revertTruePolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ target: 'Other', source: 'Other', effect: 'hold_monster' }],
      campaignName,
      true,
    );
  });

  it('logs the object revert with the full composed sentence and exact entry shape', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{
        name: targetName,
        type: 'npc',
        polymorphSource: casterName,
        polymorphObject: { type: 'stone_block' },
        polymorphOriginal: { maxHp: 15 },
      }],
    });

    revertTruePolymorph(targetName, campaignName);

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: targetName,
      abilityName: 'True Polymorph',
      description: `${targetName} reverts to their normal form.`,
    });
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
    revertPolymorph.mockReturnValueOnce(false);

    const result = revertTruePolymorph(targetName, campaignName);

    expect(revertPolymorph).toHaveBeenCalledWith(targetName, campaignName);
    expect(result).toBe(false); // honest pass-through, not a swallowed true

    revertPolymorph.mockReturnValueOnce(true);
    expect(revertTruePolymorph(targetName, campaignName)).toBe(true);
    expect(revertPolymorph).toHaveBeenCalledTimes(2);
    expect(storage.set).not.toHaveBeenCalled(); // delegation lane composes no local persist
  });

  it('returns false with zero writes when the creature has no polymorph fields', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{ name: targetName, type: 'npc', maxHp: 15, ac: 13, speed: '30 ft.' }],
    });

    expect(revertTruePolymorph(targetName, campaignName)).toBe(false);
    expect(revertPolymorph).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
