// @maintained-by-ai
// SAVE-ENGINE lane of conditionSaveService (base canonical owner): getCreatureSaveBonus
// resolution (:13-30, incl. Wild Shape CON shortcut :15-16) and rollConditionSave
// orchestration (:70-99) — bonus/aura composition, advantage-channel routing
// (purity :75-77, passive saveModifiers :34-52, Protection from Poison :54-58,
// Circle of Power via real isCircleOfPowerActive :88), Starry Form floor ordering
// (:66-68, :90-98), DC>= boundary, collaborator call-bytes (:71-72 exact once).
//
// Family map (behaviors owned elsewhere, not duplicated here):
// - conditionSaveService.aura-immunity.test.js (#1002) — CLA-019/020 aura suppression gate,
//   armed/unarmed channel, gate-order proofs, immunity log envelopes.
// - conditionSaveService.conditionManagement.test.js (#1003) — removeCondition full lane,
//   addCondition auto-immunity gate, append/dedup/meta-merge/guards, { suppressed } contract,
//   activeConditionMeta strip.
// - conditionSaveService.popup.test.js (#1004) — buildConditionPopup envelope bytes,
//   CLA-209 multi-roll, conditional-spread key-absence falsifiers.
// - Engine lanes CLOSED #995-#1001 (compute #1000 folded() registry census) — fold math
//   cite-only, never re-driven here.
// addCondition/removeCondition/buildConditionPopup are exported here but owned by the
// sibling lanes above — this file pins the export contract only (R9 census), no payloads.
// Pure in-memory orchestration: zero-network (useRuntimeState/combatData mocked stores,
// setRuntimeValue never POSTs), no timers, no wall-clock — adjudication waits
// indefinitely (turn-based CANON).
//
// old -> new: p(computedStats)+p(char-obj)+p(not-found→undefined)→G1 | p(getName)+
// p(no-bestiary)+p(no-bestiary+npcs)→G3 | sT(throws)+sT(fallback)+sT(prefer)+
// sT(null)+sT(empty)+sT(reject)→G4 | sT(name/npcs bytes)→G5 | NEW G2 wild-shape CON
// shortcut (:15-16, builder file pins production only) | t(plain)+t(computeAuraBonus
// bytes)→R1 (strengthened: allCreatures + getCombatSummary pins) | t(aura-detail×3)+
// t(zero-detail-omit)→R2 | t(dc-boundary)→R3 | t(purity-adv)+t(purity-nomatch×2)→R4
// (+label-fallback :74) | t(CLA-102)+t(CLA-102-nomatch)→R5 (+abilities-guard) |
// t(starry-floor)+t(starry-no-floor×2)+t(starry-con-only)→R6 | t(adv-then-floor)→R7 |
// NEW R8 Circle of Power/Protection from Poison/Powerful Build advantage channels |
// NEW R9 export census (#969 lesson).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

const runtimeStore = vi.hoisted(() => new Map());

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('./conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(),
}));

vi.mock('../auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(),
}));

vi.mock('../automation/automationService.js', () => ({
  // auto-immunity lane kept inert (owned by #1003 conditionManagement lane)
  playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  handle: vi.fn(),
  isAuraOfPurityActive: vi.fn(),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(),
}));

vi.mock('../starryFormConstellation.js', () => ({
  hasStarryDragonConstellation: vi.fn(),
}));

// In-memory runtime store faithful to the real getRuntimeValue (null when unset);
// setRuntimeValue kept inert — real one POSTs (zero-network).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((characterKey, propertyName) => runtimeStore.get(`${characterKey}:${propertyName}`) ?? null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

// ── Imports ──────────────────────────────────────────────────────

import * as conditionSaveService from './conditionSaveService.js';
import {
  getCreatureSaveBonus,
  rollConditionSave,
} from './conditionSaveService.js';

import { rollD20 } from '../../dice/diceRoller.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { getAbilitySaveBonus } from './conditionUtils.js';
import { computeAuraBonus } from '../auras/auraOfProtection.js';
import { isAuraOfPurityActive, getAuraOfPuritySaveAdvantageConditions } from '../../../services/automation/handlers/buffs/auraOfPurityHandler.js';
import { hasStarryDragonConstellation } from '../starryFormConstellation.js';
import { getCombatSummary } from '../../encounters/combatData.js';

// ── Helpers ───────────────────────────────────────────────────────

const defaultGetName = (name) => name;

function saveArgs(overrides = {}) {
  return {
    creature: { type: 'player', name: 'Hero' },
    condition: { ability: 'wis', dc: 15 },
    characters: [{ name: 'Hero' }],
    campaignNpcs: [],
    campaignName: 'Campaign',
    mapName: '',
    getName: defaultGetName,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks(); // clears calls only — impls set below are (re)applied each test
  // consumers-exact explicit defaults (#872); rollD20 mockReset clears once-queues
  rollD20.mockReset().mockReturnValue(10);
  getAbilitySaveBonus.mockReturnValue(0);
  getMonsterData.mockResolvedValue(null);
  computeAuraBonus.mockResolvedValue({ bonus: 0 });
  isAuraOfPurityActive.mockReturnValue(false);
  getAuraOfPuritySaveAdvantageConditions.mockReturnValue([]);
  hasStarryDragonConstellation.mockReturnValue(false);
  getCombatSummary.mockReturnValue(null);
  runtimeStore.clear();
});

// ── getCreatureSaveBonus ─────────────────────────────────────────

describe('getCreatureSaveBonus', () => {
  it('G1: player bonus resolves via computedStats, then character object, then undefined for not-found', async () => {
    getAbilitySaveBonus.mockReturnValue(5);
    expect(await getCreatureSaveBonus({ type: 'player', name: 'Hero' }, 'wis', [{ name: 'Hero', computedStats: { x: 1 } }], [], defaultGetName)).toBe(5);
    expect(getAbilitySaveBonus).toHaveBeenLastCalledWith({ x: 1 }, 'wis');

    getAbilitySaveBonus.mockReturnValue(3);
    expect(await getCreatureSaveBonus({ type: 'player', name: 'Hero' }, 'con', [{ name: 'Hero' }], [], defaultGetName)).toBe(3);
    expect(getAbilitySaveBonus).toHaveBeenLastCalledWith({ name: 'Hero' }, 'con');

    expect(await getCreatureSaveBonus({ type: 'player', name: 'NoOne' }, 'str', [], [], defaultGetName)).toBe(3);
    expect(getAbilitySaveBonus).toHaveBeenLastCalledWith(undefined, 'str');
  });

  it('G2: Wild Shape creature takes its CON save from wildShapeConSaveBonus, ?? 0, other abilities fall through', async () => {
    const creature = { type: 'player', name: 'Hero', wildShapeSource: 'Hero' };
    expect(await getCreatureSaveBonus({ ...creature, wildShapeConSaveBonus: 7 }, 'con', [{ name: 'Hero' }], [], defaultGetName)).toBe(7);
    expect(getAbilitySaveBonus).not.toHaveBeenCalled();

    expect(await getCreatureSaveBonus(creature, 'con', [{ name: 'Hero' }], [], defaultGetName)).toBe(0);

    getAbilitySaveBonus.mockReturnValue(2);
    expect(await getCreatureSaveBonus({ ...creature, wildShapeConSaveBonus: 7 }, 'wis', [{ name: 'Hero' }], [], defaultGetName)).toBe(2);
    expect(getAbilitySaveBonus).toHaveBeenCalledWith({ name: 'Hero' }, 'wis');
  });

  it('G3: getName transforms the lookup key before matching; player lane never consults the bestiary even with campaignNpcs', async () => {
    getAbilitySaveBonus.mockReturnValue(4);
    expect(await getCreatureSaveBonus({ type: 'player', name: 'HERO_LOWER' }, 'dex', [{ name: 'hero_lower' }], [], (cName) => cName.toUpperCase())).toBe(4);
    expect(getAbilitySaveBonus).toHaveBeenCalledWith({ name: 'hero_lower' }, 'dex');

    expect(await getCreatureSaveBonus({ type: 'player', name: 'Hero' }, 'wis', [{ name: 'Hero' }], [{ armorClass: 15, name: 'Goblin' }], defaultGetName)).toBe(4);
    expect(getMonsterData).not.toHaveBeenCalled();
  });

  it('G4: monster ladder — saving_throws beats ability_score_modifiers, falls back, 0 for absent/null/rejected lookups', async () => {
    getMonsterData.mockResolvedValue({ saving_throws: { dex: { modifier: 5 } }, ability_score_modifiers: { dex: 3 } });
    expect(await getCreatureSaveBonus({ type: 'monster', name: 'Goblin' }, 'dex', [], [], defaultGetName)).toBe(5);

    getMonsterData.mockResolvedValue({ ability_score_modifiers: { con: 2 } });
    expect(await getCreatureSaveBonus({ type: 'monster', name: 'Goblin' }, 'con', [], [], defaultGetName)).toBe(2);

    getMonsterData.mockResolvedValue({ saving_throws: {}, ability_score_modifiers: {} });
    expect(await getCreatureSaveBonus({ type: 'monster', name: 'Goblin' }, 'int', [], [], defaultGetName)).toBe(0);

    getMonsterData.mockResolvedValue(null);
    expect(await getCreatureSaveBonus({ type: 'monster', name: 'NonExistent' }, 'str', [], [], defaultGetName)).toBe(0);

    getMonsterData.mockRejectedValue(new Error('not found'));
    expect(await getCreatureSaveBonus({ type: 'monster', name: 'Goblin' }, 'wis', [], [], defaultGetName)).toBe(0);
  });

  it('G5: monster lookup forwards exact name and campaignNpcs bytes, once', async () => {
    getMonsterData.mockResolvedValue({ saving_throws: { str: { modifier: 4 } } });
    expect(await getCreatureSaveBonus({ type: 'monster', name: 'Ogre' }, 'str', [], [{ name: 'Custom Ogre' }], defaultGetName)).toBe(4);
    expect(getMonsterData).toHaveBeenCalledTimes(1);
    expect(getMonsterData).toHaveBeenCalledWith('Ogre', [{ name: 'Custom Ogre' }]);
  });
});

// ── rollConditionSave ────────────────────────────────────────────

describe('rollConditionSave', () => {
  it('R1: plain save returns exact result envelope and computes bonus/aura with exact collaborator bytes', async () => {
    const combatCreatures = [{ name: 'Hero' }, { name: 'Goblin' }];
    getCombatSummary.mockReturnValue({ creatures: combatCreatures });
    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(12);

    const result = await rollConditionSave(saveArgs({
      condition: { ability: 'wis', dc: 15 },
      campaignName: 'TheCampaign',
      mapName: 'DungeonMap',
    }));

    expect(result).toEqual({
      roll: 12,
      total: 15,
      success: true,
      bonus: 3,
      bonusDetail: undefined,
      rolls: [12],
      starryDragonFloor: false,
    });
    expect(result).not.toHaveProperty('advantage');
    expect(getCombatSummary).toHaveBeenCalledWith('TheCampaign');
    expect(computeAuraBonus).toHaveBeenCalledTimes(1);
    expect(computeAuraBonus).toHaveBeenCalledWith({
      targetName: 'Hero',
      characters: [{ name: 'Hero' }],
      campaignName: 'TheCampaign',
      activeMapName: 'DungeonMap',
      allCreatures: combatCreatures,
    });
  });

  it('R2: aura bonus joins total/bonus and formats bonusDetail; zero aura omits detail even with sourceName', async () => {
    computeAuraBonus.mockResolvedValue({ bonus: 2 });
    rollD20.mockReturnValue(14);
    let result = await rollConditionSave(saveArgs({ condition: { ability: 'con', dc: 18 } }));
    expect(result.bonus).toBe(2);
    expect(result.total).toBe(16);
    expect(result.success).toBe(false);

    computeAuraBonus.mockResolvedValue({ bonus: 1 });
    rollD20.mockReturnValue(11);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', dc: 12 } }));
    expect(result.total).toBe(12);
    expect(result.success).toBe(true);
    expect(result.bonusDetail).toBe('(+1 aura)');

    computeAuraBonus.mockResolvedValue({ bonus: 3, sourceName: 'Paladin' });
    result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', dc: 13 } }));
    expect(result.bonusDetail).toBe('(+3 aura from Paladin)');

    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: 'None' });
    rollD20.mockReturnValue(10);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'con', dc: 10 } }));
    expect(result.bonusDetail).toBeUndefined();
    expect(result.total).toBe(10);
  });

  it('R3: DC boundary — total equal succeeds, one below fails, negative save bonus folds with aura', async () => {
    getAbilitySaveBonus.mockReturnValue(5);
    rollD20.mockReturnValue(10);
    expect((await rollConditionSave(saveArgs({ condition: { ability: 'str', dc: 15 } }))).success).toBe(true);

    getAbilitySaveBonus.mockReturnValue(4);
    expect((await rollConditionSave(saveArgs({ condition: { ability: 'str', dc: 15 } }))).success).toBe(false);

    getAbilitySaveBonus.mockReturnValue(-1);
    computeAuraBonus.mockResolvedValue({ bonus: 1 });
    const result = await rollConditionSave(saveArgs({ condition: { ability: 'con', dc: 10 } }));
    expect(result).toMatchObject({ total: 10, success: true, bonus: 0 });
  });

  it('R4: Aura of Purity advantage — two d20s keep the max with raw rolls array; single roll when inactive, off-list, or key absent; label supplies the condition key', async () => {
    // armed + covered condition: rolls 3,17 -> 17
    isAuraOfPurityActive.mockReturnValue(true);
    getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['charmed']);
    rollD20.mockReturnValueOnce(3).mockReturnValueOnce(17);
    let result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', key: 'charmed', dc: 15 } }));
    expect(result).toMatchObject({ roll: 17, rolls: [3, 17], total: 17, success: true, advantage: true });

    // inactive: one roll, no advantage key
    rollD20.mockReset().mockReturnValue(10);
    isAuraOfPurityActive.mockReturnValue(false);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'con', key: 'charmed', dc: 12 } }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('advantage');

    // armed but condition not on the list: one roll
    isAuraOfPurityActive.mockReturnValue(true);
    getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['charmed']);
    rollD20.mockReset().mockReturnValue(10);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'con', key: 'poisoned', dc: 12 } }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result.advantage).toBeUndefined();

    // key absent: label lowercased drives the match (:74)
    rollD20.mockReset().mockReturnValueOnce(4).mockReturnValueOnce(9);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', label: 'Charmed', dc: 12 } }));
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(result.advantage).toBe(true);
    expect(result.roll).toBe(9);
  });

  it('R5: passive saveModifiers advantage (CLA-102 Dwarven Resilience poison→poisoned); off-condition or ability-scoped mods stay single-roll', async () => {
    const chars = (mod) => [{ name: 'Ironhold', computedStats: { saveModifiers: [mod] } }];
    const dwarven = { source: 'Dwarven Resilience', target: 'saving_throw', condition: 'poison', effect: 'advantage', abilities: [], skills: [] };

    getAbilitySaveBonus.mockReturnValue(2);
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(15);
    let result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Ironhold' }, condition: { ability: 'con', key: 'poisoned', dc: 12 }, characters: chars(dwarven) }));
    expect(result).toMatchObject({ advantage: true, roll: 15, total: 17, success: true });

    // condition mismatch: single roll
    rollD20.mockReset().mockReturnValue(10);
    result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Ironhold' }, condition: { ability: 'wis', key: 'frightened', dc: 12 }, characters: chars(dwarven) }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('advantage');

    // ability-scoped saving_throw mod does not grant unconditional save advantage (:35 guard)
    rollD20.mockReset().mockReturnValue(10);
    result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Ironhold' }, condition: { ability: 'con', key: 'poisoned', dc: 12 }, characters: chars({ ...dwarven, abilities: ['con'] }) }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result.advantage).toBeUndefined();
  });

  it('R6: Starry Form Dragon floor — CON saves ≤9 floor to 10 with raw roll preserved; above-9, inactive, and non-CON saves never floor', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    hasStarryDragonConstellation.mockReturnValue(true);
    rollD20.mockReturnValue(5);
    let result = await rollConditionSave(saveArgs({ condition: { ability: 'con', key: 'deafened', dc: 15 } }));
    expect(result).toMatchObject({ roll: 10, total: 13, success: false, starryDragonFloor: true });
    expect(result.rolls).toEqual([5]);

    rollD20.mockReturnValue(12);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'con', key: 'deafened', dc: 15 } }));
    expect(result).toMatchObject({ roll: 12, total: 15, starryDragonFloor: true });

    rollD20.mockReturnValue(5);
    hasStarryDragonConstellation.mockReturnValue(false);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'con', key: 'deafened', dc: 10 } }));
    expect(result).toMatchObject({ roll: 5, total: 8, starryDragonFloor: false });

    hasStarryDragonConstellation.mockReturnValue(true);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', key: 'charmed', dc: 10 } }));
    expect(result).toMatchObject({ roll: 5, total: 8, starryDragonFloor: false });
  });

  it('R7: advantage then floor order — max of the pair is floored, raw pair preserved in rolls', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    isAuraOfPurityActive.mockReturnValue(true);
    getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['deafened']);
    hasStarryDragonConstellation.mockReturnValue(true);
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(2);

    const result = await rollConditionSave(saveArgs({ condition: { ability: 'con', key: 'deafened', dc: 15 } }));
    expect(result).toMatchObject({ roll: 10, total: 13, success: false, advantage: true, starryDragonFloor: true });
    expect(result.rolls).toEqual([8, 2]);
  });

  it('R8: other advantage channels — Circle of Power campaign targetEffect, Protection from Poison buff, Powerful Build grapple escape; each falsifies single-roll', async () => {
    // Circle of Power: campaign-level targetEffect routed through real isCircleOfPowerActive
    runtimeStore.set('campaign:targetEffects', [{ effect: 'circle_of_power', target: 'Hero' }]);
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(16);
    let result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', dc: 15 } }));
    expect(result).toMatchObject({ advantage: true, roll: 16, total: 16 });

    runtimeStore.clear();
    rollD20.mockReset().mockReturnValue(6);
    result = await rollConditionSave(saveArgs({ condition: { ability: 'wis', dc: 15 } }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('advantage');

    // Protection from Poison buff with saveAdvantageTypes:poisoned
    runtimeStore.set('Ironhold:activeBuffs', [{ name: 'Protection from Poison', saveAdvantageTypes: ['poisoned'] }]);
    rollD20.mockReset().mockReturnValueOnce(1).mockReturnValueOnce(13);
    result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Ironhold' }, condition: { ability: 'con', key: 'poisoned', dc: 12 } }));
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ advantage: true, roll: 13 });

    // buff present but no poisoned saveAdvantageTypes: single roll
    runtimeStore.set('Ironhold:activeBuffs', [{ name: 'Protection from Poison' }]);
    rollD20.mockReset().mockReturnValue(6);
    result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Ironhold' }, condition: { ability: 'con', key: 'poisoned', dc: 12 } }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result.advantage).toBeUndefined();

    // Powerful Build: ability_check adv mod grants advantage only on grappled saves (:38-40, :50-51)
    const pbChars = [{ name: 'Bruenor', computedStats: { saveModifiers: [{ target: 'ability_check', effect: 'advantage', abilities: ['STR'], condition: 'powerful_build_grapple_escape' }] } }];
    rollD20.mockReset().mockReturnValueOnce(2).mockReturnValueOnce(14);
    result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Bruenor' }, condition: { ability: 'str', key: 'grappled', dc: 12 }, characters: pbChars }));
    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ advantage: true, roll: 14 });

    rollD20.mockReset().mockReturnValue(4);
    result = await rollConditionSave(saveArgs({ creature: { type: 'player', name: 'Bruenor' }, condition: { ability: 'str', key: 'restrained', dc: 12 }, characters: pbChars }));
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result.advantage).toBeUndefined();
  });

  it('R9: export census (#969) — module surface matches the family ownership split exactly', () => {
    expect(Object.keys(conditionSaveService).sort()).toEqual([
      'addCondition', // owned by #1003 conditionManagement + #1002 aura-immunity lanes
      'buildConditionPopup', // owned by #1004 popup lane
      'getCreatureSaveBonus', // owned here
      'removeCondition', // owned by #1003
      'rollConditionSave', // owned here
    ]);
  });
});
