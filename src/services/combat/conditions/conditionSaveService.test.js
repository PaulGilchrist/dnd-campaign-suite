// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
  handle: vi.fn(),
  isAuraOfPurityActive: vi.fn(),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(),
}));

vi.mock('../starryFormConstellation.js', () => ({
  hasStarryDragonConstellation: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────

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

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition,
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

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

    let result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', dc: 18 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.total).toBe(19);
    expect(result.success).toBe(true);
    expect(result.bonus).toBe(5);

    getAbilitySaveBonus.mockReturnValue(0);
    computeAuraBonus.mockResolvedValue({ bonus: 1 });
    rollD20.mockReturnValue(10);

    result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'wis', dc: 11 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.bonusDetail).toBe('(+1 aura)');

    getAbilitySaveBonus.mockReturnValue(2);
    computeAuraBonus.mockResolvedValue({ bonus: 3, sourceName: 'Paladin' });
    rollD20.mockReturnValue(8);

    result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'wis', dc: 13 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.bonusDetail).toBe('(+3 aura from Paladin)');
  });

  it('omits bonusDetail when auraBonus is zero even with sourceName', async () => {
    getMonsterData.mockResolvedValue({ saving_throws: { con: { modifier: 5 } } });
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: 'None' });
    rollD20.mockReturnValue(1);
    isAuraOfPurityActive.mockReturnValue(false);

    const result = await rollConditionSave({
      creature: { type: 'monster', name: 'Goblin' },
      condition: { ability: 'con', dc: 6 },
      characters: [],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.bonusDetail).toBeUndefined();
  });

  it('calls computeAuraBonus with correct parameters', async () => {
    getAbilitySaveBonus.mockReturnValue(0);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(10);
    isAuraOfPurityActive.mockReturnValue(false);

    await rollConditionSave({
      creature: { type: 'player', name: 'Ally' },
      condition: { ability: 'con', dc: 10 },
      characters: [{ name: 'Group' }],
      campaignNpcs: [],
      campaignName: 'TheCampaign',
      mapName: 'DungeonMap',
      getName: defaultGetName,
    });

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

    let result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'str', dc: 15 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: '',
      mapName: '',
      getName: defaultGetName,
    });
    expect(result.success).toBe(true);

    getAbilitySaveBonus.mockReturnValue(4);
    result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'str', dc: 15 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: '',
      mapName: '',
      getName: defaultGetName,
    });
    expect(result.success).toBe(false);

    getAbilitySaveBonus.mockReturnValue(-1);
    computeAuraBonus.mockResolvedValue({ bonus: 1 });
    rollD20.mockReturnValue(10);

    result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', dc: 10 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: '',
      mapName: '',
      getName: defaultGetName,
    });
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

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'wis', key: 'charmed', dc: 15 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

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

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'blinded', dc: 10 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });
    expect(result.roll).toBe(18);
    expect(result.total).toBe(18);

    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReset();
    rollD20.mockReturnValue(10);
    isAuraOfPurityActive.mockReturnValue(false);

    await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'charmed', dc: 12 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });
    expect(rollD20).toHaveBeenCalledTimes(1);

    isAuraOfPurityActive.mockReturnValue(true);
    getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['charmed']);
    rollD20.mockReset();
    rollD20.mockReturnValue(10);

    await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'poisoned', dc: 12 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });
    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  it('floors a low CON condition save roll to 10 when Starry Form Dragon is active', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(5);
    isAuraOfPurityActive.mockReturnValue(false);
    hasStarryDragonConstellation.mockReturnValue(true);

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'deafened', dc: 15 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.roll).toBe(10);
    expect(result.total).toBe(13);
    expect(result.success).toBe(false);
    expect(result.rolls).toEqual([5]);
    expect(result.starryDragonFloor).toBe(true);
  });

  it('does not floor when Starry Form Dragon is inactive or roll is above 9', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    isAuraOfPurityActive.mockReturnValue(false);
    hasStarryDragonConstellation.mockReturnValue(true);
    rollD20.mockReturnValue(12);

    let result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'deafened', dc: 15 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.roll).toBe(12);
    expect(result.total).toBe(15);
    expect(result.starryDragonFloor).toBe(true);

    hasStarryDragonConstellation.mockReturnValue(false);
    rollD20.mockReturnValue(5);

    result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'deafened', dc: 10 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.roll).toBe(5);
    expect(result.total).toBe(8);
    expect(result.starryDragonFloor).toBe(false);
  });

  it('only applies the Starry Form Dragon floor to Constitution saves', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    isAuraOfPurityActive.mockReturnValue(false);
    hasStarryDragonConstellation.mockReturnValue(true);
    rollD20.mockReturnValue(5);

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'wis', key: 'charmed', dc: 10 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.roll).toBe(5);
    expect(result.total).toBe(8);
    expect(result.starryDragonFloor).toBe(false);
  });

  it('floors the effective roll on an advantage CON save when Starry Form Dragon is active', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    isAuraOfPurityActive.mockReturnValue(true);
    getAuraOfPuritySaveAdvantageConditions.mockReturnValue(['deafened']);
    hasStarryDragonConstellation.mockReturnValue(true);
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(2);

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Hero' },
      condition: { ability: 'con', key: 'deafened', dc: 15 },
      characters: [{ name: 'Hero' }],
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(result.roll).toBe(10);
    expect(result.total).toBe(13);
    expect(result.success).toBe(false);
    expect(result.advantage).toBe(true);
    expect(result.starryDragonFloor).toBe(true);
  });

  it('grants advantage from Dwarven Resilience conditional_advantage on poisoned saves (CLA-102)', async () => {
    getAbilitySaveBonus.mockReturnValue(2);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    isAuraOfPurityActive.mockReturnValue(false);
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(15);

    const characters = [{
      name: 'Ironhold',
      computedStats: {
        saveModifiers: [{
          source: 'Dwarven Resilience',
          target: 'saving_throw',
          condition: 'poison',
          effect: 'advantage',
          abilities: [],
          skills: [],
        }],
      },
    }];

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Ironhold' },
      condition: { ability: 'con', key: 'poisoned', dc: 12 },
      characters,
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(result.advantage).toBe(true);
    expect(result.roll).toBe(15);
    expect(result.total).toBe(17);
    expect(result.success).toBe(true);
  });

  it('does not grant advantage from conditional_advantage when condition does not match', async () => {
    getAbilitySaveBonus.mockReturnValue(2);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    isAuraOfPurityActive.mockReturnValue(false);
    rollD20.mockReturnValue(10);

    const characters = [{
      name: 'Ironhold',
      computedStats: {
        saveModifiers: [{
          source: 'Dwarven Resilience',
          target: 'saving_throw',
          condition: 'poison',
          effect: 'advantage',
          abilities: [],
          skills: [],
        }],
      },
    }];

    const result = await rollConditionSave({
      creature: { type: 'player', name: 'Ironhold' },
      condition: { ability: 'wis', key: 'frightened', dc: 12 },
      characters,
      campaignNpcs: [],
      campaignName: 'Campaign',
      mapName: '',
      getName: defaultGetName,
    });

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(result.advantage).toBeUndefined();
    expect(result.roll).toBe(10);
  });
});
