// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

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
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import {
  getCreatureSaveBonus,
  removeCondition,
  addCondition,
  buildConditionPopup,
  rollConditionSave,
} from './conditionSaveService.js';

import { rollD20 } from '../../dice/diceRoller.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { getAbilitySaveBonus } from './conditionUtils.js';
import { computeAuraBonus } from '../auras/auraOfProtection.js';
import { playerIsImmuneToCondition } from '../automation/automationService.js';
import { isAuraOfPurityActive, getAuraOfPuritySaveAdvantageConditions } from '../../../services/automation/handlers/buffs/auraOfPurityHandler.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeGetRuntimeValue(initial = {}) {
  const store = new Map();
  for (const [key, value] of Object.entries(initial)) {
    store.set(key, value);
  }
  return vi.fn((name, runtimeKey) => store.get(`${name}:${runtimeKey}`));
}

function makeSetRuntimeValue() {
  const calls = [];
  const fn = vi.fn((name, runtimeKey, value) => {
    calls.push({ name, runtimeKey, value });
  });
  fn.calls = calls;
  return fn;
}

const defaultGetName = (name) => name;

// ── Tests ────────────────────────────────────────────────────────

describe('getCreatureSaveBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player creatures', () => {
    it('returns ability save bonus from computedStats when available', async () => {
      getAbilitySaveBonus.mockReturnValue(5);
      const characters = [{ name: 'Hero', computedStats: {} }];

      const bonus = await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'wis',
        characters,
        [],
        defaultGetName,
      );

      expect(bonus).toBe(5);
      expect(getAbilitySaveBonus).toHaveBeenCalledWith({}, 'wis');
    });

    it('returns ability save bonus from character object when computedStats is absent', async () => {
      getAbilitySaveBonus.mockReturnValue(3);
      const characters = [{ name: 'Hero' }];

      const bonus = await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'con',
        characters,
        [],
        defaultGetName,
      );

      expect(bonus).toBe(3);
      expect(getAbilitySaveBonus).toHaveBeenCalledWith({ name: 'Hero' }, 'con');
    });

    it('passes undefined to getAbilitySaveBonus when character is not found', async () => {
      getAbilitySaveBonus.mockReturnValue(0);

      await getCreatureSaveBonus(
        { type: 'player', name: 'NoOne' },
        'str',
        [],
        [],
        defaultGetName,
      );

      expect(getAbilitySaveBonus).toHaveBeenCalledWith(undefined, 'str');
    });

    it('uses getName to transform character property before matching', async () => {
      getAbilitySaveBonus.mockReturnValue(4);
      const characters = [{ name: 'hero_lower' }];

      await getCreatureSaveBonus(
        { type: 'player', name: 'HERO_LOWER' },
        'dex',
        characters,
        [],
        (cName) => cName.toUpperCase(),
      );

      expect(getAbilitySaveBonus).toHaveBeenCalledWith({ name: 'hero_lower' }, 'dex');
    });

    it('does not call getMonsterData for player creatures', async () => {
      getAbilitySaveBonus.mockReturnValue(2);
      const characters = [{ name: 'Hero' }];

      await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'con',
        characters,
        [],
        defaultGetName,
      );

      expect(getMonsterData).not.toHaveBeenCalled();
    });
  });

  describe('monster creatures', () => {
    it('returns saving_throw modifier when available', async () => {
      getMonsterData.mockResolvedValue({
        saving_throws: { wis: { modifier: 6 } },
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'wis',
        [],
        [],
        defaultGetName,
      );

      expect(bonus).toBe(6);
    });

    it('falls back to ability_score_modifiers when saving_throws entry is missing', async () => {
      getMonsterData.mockResolvedValue({
        ability_score_modifiers: { con: 2 },
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'con',
        [],
        [],
        defaultGetName,
      );

      expect(bonus).toBe(2);
    });

    it('prefers saving_throws over ability_score_modifiers when both exist', async () => {
      getMonsterData.mockResolvedValue({
        saving_throws: { dex: { modifier: 5 } },
        ability_score_modifiers: { dex: 3 },
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'dex',
        [],
        [],
        defaultGetName,
      );

      expect(bonus).toBe(5);
    });

    it('returns 0 when monster lookup returns null', async () => {
      getMonsterData.mockResolvedValue(null);

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'NonExistent' },
        'str',
        [],
        [],
        defaultGetName,
      );

      expect(bonus).toBe(0);
    });

    it('returns 0 when monster lacks the ability in both saving_throws and ability_score_modifiers', async () => {
      getMonsterData.mockResolvedValue({
        saving_throws: {},
        ability_score_modifiers: {},
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'int',
        [],
        [],
        defaultGetName,
      );

      expect(bonus).toBe(0);
    });

    it('returns 0 and suppresses errors from getMonsterData', async () => {
      getMonsterData.mockRejectedValue(new Error('not found'));

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'wis',
        [],
        [],
        defaultGetName,
      );

      expect(bonus).toBe(0);
    });

    it('passes monster name and campaignNpcs to getMonsterData', async () => {
      getMonsterData.mockResolvedValue(null);

      await getCreatureSaveBonus(
        { type: 'monster', name: 'Ogre' },
        'str',
        [],
        [{ name: 'Custom Ogre' }],
        defaultGetName,
      );

      expect(getMonsterData).toHaveBeenCalledWith('Ogre', [{ name: 'Custom Ogre' }]);
    });

    it('does not call getMonsterData for player creatures even when campaignNpcs are provided', async () => {
      getAbilitySaveBonus.mockReturnValue(0);
      const characters = [{ name: 'Hero' }];

      await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'wis',
        characters,
        [{ armorClass: 15, name: 'Goblin' }],
        defaultGetName,
      );

      expect(getMonsterData).not.toHaveBeenCalled();
    });
  });
});

  describe('rollConditionSave', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns success result with correct fields on a successful save', async () => {
      const condition = { ability: 'wis', dc: 15 };
      getAbilitySaveBonus.mockReturnValue(3);
      computeAuraBonus.mockResolvedValue({ bonus: 0 });
      rollD20.mockReturnValue(12);
      isAuraOfPurityActive.mockReturnValue(false);

      const result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        condition,
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );

      expect(result.roll).toBe(12);
      expect(result.bonus).toBe(3);
      expect(result.total).toBe(15);
      expect(result.success).toBe(true);
      expect(result.bonusDetail).toBeUndefined();
      expect(result.advantage).toBeUndefined();
    });

    it('includes aura bonus in total and success calculation with bonusDetail', async () => {
      getAbilitySaveBonus.mockReturnValue(3);
      computeAuraBonus.mockResolvedValue({ bonus: 2 });
      rollD20.mockReturnValue(14);
      isAuraOfPurityActive.mockReturnValue(false);

      let result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'con', dc: 18 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );

      expect(result.total).toBe(19);
      expect(result.success).toBe(true);
      expect(result.bonus).toBe(5);

      getAbilitySaveBonus.mockReturnValue(0);
      computeAuraBonus.mockResolvedValue({ bonus: 1 });
      rollD20.mockReturnValue(10);

      result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'wis', dc: 11 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );

      expect(result.bonusDetail).toBe('(+1 aura)');

      getAbilitySaveBonus.mockReturnValue(2);
      computeAuraBonus.mockResolvedValue({ bonus: 3, sourceName: 'Paladin' });
      rollD20.mockReturnValue(8);

      result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'wis', dc: 13 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );

      expect(result.bonusDetail).toBe('(+3 aura from Paladin)');
    });

    it('omits bonusDetail when auraBonus is zero even with sourceName', async () => {
      getMonsterData.mockResolvedValue({ saving_throws: { con: { modifier: 5 } } });
      computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: 'None' });
      rollD20.mockReturnValue(1);
      isAuraOfPurityActive.mockReturnValue(false);

      const result = await rollConditionSave(
        { type: 'monster', name: 'Goblin' },
        { ability: 'con', dc: 6 },
        [],
        [],
        'Campaign',
        '',
        defaultGetName,
      );

      expect(result.bonusDetail).toBeUndefined();
    });

    it('calls computeAuraBonus with correct parameters', async () => {
      getAbilitySaveBonus.mockReturnValue(0);
      computeAuraBonus.mockResolvedValue({ bonus: 0 });
      rollD20.mockReturnValue(10);
      isAuraOfPurityActive.mockReturnValue(false);

      await rollConditionSave(
        { type: 'player', name: 'Ally' },
        { ability: 'con', dc: 10 },
        [{ name: 'Group' }],
        [],
        'TheCampaign',
        'DungeonMap',
        defaultGetName,
      );

      expect(computeAuraBonus).toHaveBeenCalledWith({
        targetName: 'Ally',
        characters: [{ name: 'Group' }],
        campaignName: 'TheCampaign',
        activeMapName: 'DungeonMap',
      });
    });

    it('succeeds when total equals dc, fails when one below, and handles negative bonus', async () => {
      getAbilitySaveBonus.mockReturnValue(5);
      computeAuraBonus.mockResolvedValue({ bonus: 0 });
      rollD20.mockReturnValue(10);
      isAuraOfPurityActive.mockReturnValue(false);

      let result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'str', dc: 15 },
        [{ name: 'Hero' }],
        [],
        '',
        '',
        defaultGetName,
      );
      expect(result.success).toBe(true);

      getAbilitySaveBonus.mockReturnValue(4);
      result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'str', dc: 15 },
        [{ name: 'Hero' }],
        [],
        '',
        '',
        defaultGetName,
      );
      expect(result.success).toBe(false);

      getAbilitySaveBonus.mockReturnValue(-1);
      computeAuraBonus.mockResolvedValue({ bonus: 1 });
      rollD20.mockReturnValue(10);

      result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'con', dc: 10 },
        [{ name: 'Hero' }],
        [],
        '',
        '',
        defaultGetName,
      );
      expect(result.total).toBe(10);
      expect(result.success).toBe(true);
      expect(result.bonus).toBe(0);
    });

    it('rolls two d20s and uses the higher when aura of purity advantage applies', async () => {
      getAbilitySaveBonus.mockReturnValue(2);
      computeAuraBonus.mockResolvedValue({ bonus: 0 });
      rollD20.mockReturnValueOnce(3).mockReturnValueOnce(17);
      isAuraOfPurityActive.mockReturnValue(true);
      getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['charmed']);

      const result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'wis', key: 'charmed', dc: 15 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );

      expect(result.roll).toBe(17);
      expect(result.total).toBe(19);
      expect(result.success).toBe(true);
      expect(result.advantage).toBe(true);
    });

    it('uses lower roll when disadvantageous roll is higher, and does not apply advantage when inactive or condition not in list', async () => {
      rollD20.mockReset();
      getAbilitySaveBonus.mockReturnValue(0);
      computeAuraBonus.mockResolvedValue({ bonus: 0 });
      rollD20.mockReturnValueOnce(18).mockReturnValueOnce(5);
      isAuraOfPurityActive.mockReturnValue(true);
      getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['blinded']);

      const result = await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'con', key: 'blinded', dc: 10 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );
      expect(result.roll).toBe(18);
      expect(result.total).toBe(18);

      getAbilitySaveBonus.mockReturnValue(3);
      computeAuraBonus.mockResolvedValue({ bonus: 0 });
      rollD20.mockReset();
      rollD20.mockReturnValue(10);
      isAuraOfPurityActive.mockReturnValue(false);

      await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'wis', key: 'charmed', dc: 12 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );
      expect(rollD20).toHaveBeenCalledTimes(1);

      isAuraOfPurityActive.mockReturnValue(true);
      getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['charmed']);
      rollD20.mockReset();
      rollD20.mockReturnValue(10);

      await rollConditionSave(
        { type: 'player', name: 'Hero' },
        { ability: 'con', key: 'poisoned', dc: 12 },
        [{ name: 'Hero' }],
        [],
        'Campaign',
        '',
        defaultGetName,
      );
      expect(rollD20).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeCondition', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('removes condition by key or string, case-insensitive, from activeConditions', () => {
      const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded', 'Charmed'] });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'CHARMED' },
        getRV,
        setRV,
        'Campaign',
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded'], 'Campaign');

      vi.clearAllMocks();
      const getRV2 = makeGetRuntimeValue({ 'Hero:activeConditions': ['frightened', 'grappled'] });
      const setRV2 = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        'Frightened',
        getRV2,
        setRV2,
        'Campaign',
      );

      expect(setRV2).toHaveBeenCalledWith('Hero', 'activeConditions', ['grappled'], 'Campaign');
    });

    it('treats null/undefined activeConditions as empty array', () => {
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'poisoned' },
        vi.fn(() => null),
        setRV,
        'Campaign',
      );
      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], 'Campaign');

      vi.clearAllMocks();
      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'poisoned' },
        vi.fn(() => undefined),
        setRV,
        'Campaign',
      );
      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], 'Campaign');
    });

    it('leaves array unchanged when condition is not present', () => {
      const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded'] });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed' },
        getRV,
        setRV,
        '',
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded'], '');
    });

    it('works for monster creatures', () => {
      const getRV = makeGetRuntimeValue({ 'Orc:activeConditions': ['blinded', 'charmed'] });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'monster', name: 'Orc' }] },
        'Orc',
        { key: 'blinded' },
        getRV,
        setRV,
        '',
      );

      expect(setRV).toHaveBeenCalledWith('Orc', 'activeConditions', ['charmed'], '');
    });

    it('does not call setRuntimeValue when creature is not found', () => {
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Other' }] },
        'NonExistent',
        { key: 'blinded' },
        vi.fn(),
        setRV,
        '',
      );

      expect(setRV).not.toHaveBeenCalled();
    });
  });

  describe('addCondition', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('skips adding when playerStats is immune', () => {
      playerIsImmuneToCondition.mockReturnValue(true);
      const setRV = makeSetRuntimeValue();

      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        vi.fn(),
        setRV,
        'Campaign',
        { name: 'Hero', allFeatures: [] },
      );

      expect(playerIsImmuneToCondition).toHaveBeenCalled();
      expect(setRV).not.toHaveBeenCalled();
    });

    it('skips immunity check when playerStats is null or campaignName is falsy', () => {
      const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': [] });
      const setRV = makeSetRuntimeValue();

      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV,
        setRV,
        '',
        null,
      );
      expect(playerIsImmuneToCondition).not.toHaveBeenCalled();

      vi.clearAllMocks();
      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV,
        setRV,
        '',
        { name: 'Hero' },
      );
      expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
    });

    it('calls playerIsImmuneToCondition with correct arguments when not immune', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': [] });
      const setRV = makeSetRuntimeValue();
      const playerStats = { name: 'Hero' };

      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV,
        setRV,
        'Campaign',
        playerStats,
      );

      expect(playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'charmed',
        playerStats,
        getRuntimeValue: getRV,
        campaignName: 'Campaign',
      });
    });

    it('appends new condition, deduplicates by key, and handles null activeConditions', () => {
      playerIsImmuneToCondition.mockReturnValue(false);

      const getRV1 = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded'] });
      const setRV1 = makeSetRuntimeValue();
      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV1,
        setRV1,
        'Campaign',
        {},
      );
      expect(setRV1).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded', 'charmed'], 'Campaign');

      vi.clearAllMocks();
      const getRV2 = makeGetRuntimeValue({ 'Hero:activeConditions': ['Charmed'] });
      const setRV2 = makeSetRuntimeValue();
      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV2,
        setRV2,
        'Campaign',
        {},
      );
      expect(setRV2).toHaveBeenCalledWith('Hero', 'activeConditions', ['charmed'], 'Campaign');

      vi.clearAllMocks();
      const getRV3 = vi.fn(() => null);
      const setRV3 = makeSetRuntimeValue();
      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'poisoned', label: 'Poisoned' },
        12,
        'con',
        getRV3,
        setRV3,
        '',
        {},
      );
      expect(setRV3).toHaveBeenCalledWith('Hero', 'activeConditions', ['poisoned'], '');
    });

    it('works for monster/npc creatures and does nothing when creature is not found', () => {
      playerIsImmuneToCondition.mockReturnValue(false);

      const getRV = makeGetRuntimeValue({ 'Goblin:activeConditions': ['blinded'] });
      const setRV = makeSetRuntimeValue();
      addCondition(
        { creatures: [{ type: 'npc', name: 'Goblin' }] },
        'Goblin',
        { key: 'frightened', label: 'Frightened' },
        13,
        'wis',
        getRV,
        setRV,
        '',
        null,
      );
      expect(setRV).toHaveBeenCalledWith('Goblin', 'activeConditions', ['blinded', 'frightened'], '');

      vi.clearAllMocks();
      const setRV2 = makeSetRuntimeValue();
      addCondition(
        { creatures: [{ type: 'player', name: 'Other' }] },
        'NonExistent',
        { key: 'blinded', label: 'Blinded' },
        10,
        'null',
        vi.fn(),
        setRV2,
        '',
        null,
      );
      expect(setRV2).not.toHaveBeenCalled();
    });
  });

  describe('buildConditionPopup', () => {
    it('returns a popup object with all expected fields', () => {
      const popup = buildConditionPopup(15, 5, '+3 aura from Paladin', 'Wisdom', 'Charmed', 18, true);

      expect(popup).toEqual({
        type: 'd20',
        rollType: 'condition-save',
        name: 'Wisdom',
        rolls: [15],
        bonus: 5,
        bonusDetail: '+3 aura from Paladin',
        targetName: null,
        targetAc: null,
        hit: undefined,
        condition: 'Charmed',
        dc: 18,
        success: true,
      });
    });

    it('handles failure, null/undefined bonusDetail, and negative bonus', () => {
      let popup = buildConditionPopup(5, 2, undefined, 'Strength', 'Grappled', 14, false);
      expect(popup.success).toBe(false);
      expect(popup.rollType).toBe('condition-save');
      expect(popup.hit).toBeUndefined();

      popup = buildConditionPopup(10, 0, null, 'Constitution', 'Paralyzed', 12, true);
      expect(popup.bonusDetail).toBeNull();

      popup = buildConditionPopup(8, 3, undefined, 'Dexterity', 'Blinded', 11, false);
      expect(popup.bonusDetail).toBeUndefined();

      popup = buildConditionPopup(1, -3, 'detail', 'Charisma', 'Frightened', 5, false);
      expect(popup.targetName).toBeNull();
      expect(popup.targetAc).toBeNull();
    });

    it('wraps the roll value in a rolls array', () => {
      const popup = buildConditionPopup(7, 0, undefined, 'Wisdom', 'Cursed', 10, false);
      expect(Array.isArray(popup.rolls)).toBe(true);
      expect(popup.rolls).toEqual([7]);
    });
  });
