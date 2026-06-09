import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ────────────────────

vi.mock('../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

vi.mock('./conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(),
}));

vi.mock('./auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(),
}));

vi.mock('./automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

import {
  getCreatureSaveBonus,
  rollConditionSave,
  removeCondition,
  addCondition,
  buildConditionPopup,
} from './conditionSaveService.js';

import { rollD20 } from '../dice/diceRoller.js';
import { getMonsterData } from '../npcs/monsterUtils.js';
import { getAbilitySaveBonus } from './conditionUtils.js';
import { computeAuraBonus } from './auraOfProtection.js';
import { playerIsImmuneToCondition } from './automationService.js';

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

  describe('player creature', () => {
    it('returns ability save bonus when character is found with computedStats', async () => {
      getAbilitySaveBonus.mockReturnValue(5);

      const characters = [{ name: 'Hero', computedStats: {} }];
      const bonus = await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'wis',
        characters,
        [],
        defaultGetName
      );

      expect(bonus).toBe(5);
      expect(getAbilitySaveBonus).toHaveBeenCalledWith({}, 'wis');
    });

    it('returns ability save bonus when character is found without computedStats', async () => {
      getAbilitySaveBonus.mockReturnValue(3);

      const characters = [{ name: 'Hero' }];
      const bonus = await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'con',
        characters,
        [],
        defaultGetName
      );

      expect(bonus).toBe(3);
      expect(getAbilitySaveBonus).toHaveBeenCalledWith({ name: 'Hero' }, 'con');
    });

    it('returns 0 when character not found in characters array', async () => {
      getAbilitySaveBonus.mockReturnValue(0);

      const bonus = await getCreatureSaveBonus(
        { type: 'player', name: 'NoOne' },
        'str',
        [],
        [],
        defaultGetName
      );

      // character is undefined, so character?.computedStats || character → undefined
      expect(getAbilitySaveBonus).toHaveBeenCalledWith(undefined, 'str');
    });

    it('uses getName to transform character property before matching', async () => {
      getAbilitySaveBonus.mockReturnValue(4);

      const characters = [{ name: 'hero_lower' }];
      const customGetName = (cName) => cName.toUpperCase();

      await getCreatureSaveBonus(
        { type: 'player', name: 'HERO_LOWER' },
        'dex',
        characters,
         [],
        customGetName
       );

      expect(getAbilitySaveBonus).toHaveBeenCalledWith({ name: 'hero_lower' }, 'dex');
     });

    it('does not call getMonsterData for player creatures', async () => {
      const characters = [{ name: 'Hero' }];

      await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'con',
        characters,
        [],
        defaultGetName
      );

      expect(getMonsterData).not.toHaveBeenCalled();
    });
  });

  describe('monster creature (non-player)', () => {
    it('returns monster saving_throws modifier when available', async () => {
      getMonsterData.mockResolvedValue({
        saving_throws: { wis: { modifier: 6 } },
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'wis',
        [],
        [],
        defaultGetName
      );

      expect(bonus).toBe(6);
    });

    it('falls back to ability_score_modifiers when saving_throws missing', async () => {
      getMonsterData.mockResolvedValue({
        ability_score_modifiers: { con: 2 },
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'con',
        [],
        [],
        defaultGetName
      );

      expect(bonus).toBe(2);
    });

    it('prefers saving_throws over ability_score_modifiers when both present', async () => {
      getMonsterData.mockResolvedValue({
        saving_throws: { dex: { modifier: 5 } },
        ability_score_modifiers: { dex: 3 },
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'dex',
        [],
        [],
        defaultGetName
      );

      expect(bonus).toBe(5);
    });

    it('returns 0 when monster not found (null from getMonsterData)', async () => {
      getMonsterData.mockResolvedValue(null);

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'NonExistent' },
        'str',
        [],
        [],
        defaultGetName
      );

      expect(bonus).toBe(0);
    });

    it('returns 0 when monster has neither saving_throws nor ability_score_modifiers for the ability', async () => {
      getMonsterData.mockResolvedValue({
        saving_throws: {},
        ability_score_modifiers: {},
      });

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'int',
        [],
        [],
        defaultGetName
      );

      expect(bonus).toBe(0);
    });

    it('returns 0 when getMonsterData throws an error', async () => {
      getMonsterData.mockRejectedValue(new Error('not found'));

      const bonus = await getCreatureSaveBonus(
        { type: 'monster', name: 'Goblin' },
        'wis',
        [],
        [],
        defaultGetName
      );

      expect(bonus).toBe(0);
    });

    it('calls getMonsterData with monster name and campaignNpcs', async () => {
      getMonsterData.mockResolvedValue(null);

      await getCreatureSaveBonus(
        { type: 'monster', name: 'Ogre' },
        'str',
        [],
        [{ name: 'Custom Ogre' }],
        defaultGetName
      );

      expect(getMonsterData).toHaveBeenCalledWith('Ogre', [{ name: 'Custom Ogre' }]);
    });
  });

  describe('campaignNpcs used for monsters', () => {
    it('passes campaignNpcs to getMonsterData for monster creatures', async () => {
      const customNpcs = [{ armorClass: 17, name: 'Ogre', image_path: '' }];
      getMonsterData.mockResolvedValue(customNpcs[0]);

      await getCreatureSaveBonus(
        { type: 'monster', name: 'Ogre' },
        'con',
        [],
        customNpcs,
        defaultGetName
      );

      expect(getMonsterData).toHaveBeenCalledWith('Ogre', customNpcs);
    });

    it('does not pass campaignNpcs for player creatures', async () => {
      const characters = [{ name: 'Hero' }];
      getAbilitySaveBonus.mockReturnValue(0);

      await getCreatureSaveBonus(
        { type: 'player', name: 'Hero' },
        'wis',
        characters,
        [{ armorClass: 15, name: 'Goblin' }],
        defaultGetName
      );

      expect(getMonsterData).not.toHaveBeenCalled();
    });
  });
});

describe('rollConditionSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });



  it('returns correct result when roll succeeds (save bonus only, no aura)', async () => {
    const condition = { ability: 'wis', dc: 15 };

    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(12);

    const mod = await import('./conditionSaveService.js');
    const result = await mod.rollConditionSave(
       { type: 'player', name: 'Hero' },
      condition,
       [{ name: 'Hero' }],
        [],
          'Campaign',
            '',
              defaultGetName
        );

    expect(result.total).toBe(15); // 12 + 3 + 0
    expect(result.success).toBe(true);
    expect(result.roll).toBe(12);
    expect(result.bonus).toBe(3);
    expect(result.bonusDetail).toBeUndefined();
   });

  it('returns failure when roll fails', async () => {
    const condition = { ability: 'str', dc: 18 };
    const creature = { type: 'player', name: 'Hero' };

    getAbilitySaveBonus.mockReturnValue(2);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(5);

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      creature,
      condition,
      [{ name: 'Hero' }],
      [],
      'Campaign',
      '',
      defaultGetName
    );

    expect(result.total).toBe(7);
    expect(result.success).toBe(false);
    expect(result.bonusDetail).toBeUndefined();
  });

  it('includes aura bonus in total and success calculation', async () => {
    getAbilitySaveBonus.mockReturnValue(3);
    computeAuraBonus.mockResolvedValue({ bonus: 2 });
    rollD20.mockReturnValue(14);

    const condition = { ability: 'con', dc: 18 };

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      { type: 'player', name: 'Hero' },
      condition,
      [{ name: 'Hero' }],
      [],
      'Campaign',
      '',
      defaultGetName
    );

    expect(result.total).toBe(19); // 14 + 3 + 2
    expect(result.success).toBe(true); // 19 >= 18
    expect(result.bonus).toBe(5); // saveBonus(3) + auraBonus(2)
  });

  it('includes bonusDetail with aura when auraBonus > 0 and no sourceName', async () => {
    getAbilitySaveBonus.mockReturnValue(0);
    computeAuraBonus.mockResolvedValue({ bonus: 1 });
    rollD20.mockReturnValue(10);

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      { type: 'player', name: 'Hero' },
      { ability: 'wis', dc: 11 },
      [{ name: 'Hero' }],
      [],
      'Campaign',
      '',
      defaultGetName
    );

    expect(result.bonusDetail).toBe('(+1 aura)');
  });

  it('includes bonusDetail with aura sourceName when available', async () => {
    getAbilitySaveBonus.mockReturnValue(2);
    computeAuraBonus.mockResolvedValue({ bonus: 3, sourceName: 'Paladin' });
    rollD20.mockReturnValue(8);

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      { type: 'player', name: 'Hero' },
      { ability: 'wis', dc: 13 },
      [{ name: 'Hero' }],
      [],
      'Campaign',
      '',
      defaultGetName
    );

    expect(result.bonusDetail).toBe('(+3 aura from Paladin)');
  });

  it('does not include bonusDetail when auraBonus is 0 (even with sourceName)', async () => {
    getMonsterData.mockResolvedValue({ saving_throws: { con: { modifier: 5 } } });
    computeAuraBonus.mockResolvedValue({ bonus: 0, sourceName: 'None' });
    rollD20.mockReturnValue(1);

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
       { type: 'monster', name: 'Goblin' },
       { ability: 'con', dc: 6 },
       [],
       [],
       'Campaign',
       '',
      defaultGetName
     );

    expect(result.bonusDetail).toBeUndefined();
    });

  it('calls computeAuraBonus with correct parameters', async () => {
    getAbilitySaveBonus.mockReturnValue(0);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(10);

    await (await import('./conditionSaveService.js')).rollConditionSave(
      { type: 'player', name: 'Ally' },
      { ability: 'con', dc: 10 },
      [{ name: 'Group' }],
      [],
      'TheCampaign',
      'DungeonMap',
      defaultGetName
    );

    expect(computeAuraBonus).toHaveBeenCalledWith({
      targetName: 'Ally',
      characters: [{ name: 'Group' }],
      campaignName: 'TheCampaign',
      activeMapName: 'DungeonMap',
    });
  });

  it('correctly calculates total at exact dc boundary (roll + bonus = dc)', async () => {
    getAbilitySaveBonus.mockReturnValue(5);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(10);

    const condition = { ability: 'str', dc: 15 };

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      { type: 'player', name: 'Hero' },
      condition,
      [{ name: 'Hero' }],
      [],
      '',
      '',
      defaultGetName
    );

    expect(result.success).toBe(true); // 15 >= 15
  });

  it('correctly calculates total just below dc boundary', async () => {
    getAbilitySaveBonus.mockReturnValue(4);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(10);

    const condition = { ability: 'str', dc: 15 };

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      { type: 'player', name: 'Hero' },
      condition,
      [{ name: 'Hero' }],
      [],
      '',
      '',
      defaultGetName
    );

    expect(result.success).toBe(false); // 14 < 15
  });

  it('calls rollD20 exactly once', async () => {
    getAbilitySaveBonus.mockReturnValue(0);
    computeAuraBonus.mockResolvedValue({ bonus: 0 });
    rollD20.mockReturnValue(1);

    await (await import('./conditionSaveService.js')).rollConditionSave(
      { type: 'player', name: 'Hero' },
      { ability: 'con', dc: 10 },
      [{ name: 'Hero' }],
      [],
      '',
      '',
      defaultGetName
    );

    expect(rollD20).toHaveBeenCalledTimes(1);
  });

  it('handles negative save bonus and aura bonus correctly', async () => {
    getAbilitySaveBonus.mockReturnValue(-1);
    computeAuraBonus.mockResolvedValue({ bonus: 1 });
    rollD20.mockReturnValue(10);

    const modModule = await import('./conditionSaveService.js');
    const result = await modModule.rollConditionSave(
      { type: 'player', name: 'Hero' },
      { ability: 'con', dc: 10 },
      [{ name: 'Hero' }],
      [],
      '',
      '',
      defaultGetName
    );

    expect(result.total).toBe(10); // 10 + (-1) + 1
    expect(result.success).toBe(true); // 10 >= 10
    expect(result.bonus).toBe(0); // -1 + 1 = 0
  });
});

describe('removeCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player creature removal', () => {
    it('removes condition by key when creature is a player with string conditions', () => {
      const getRV = makeGetRuntimeValue({
        'Hero:activeConditions': ['blinded', 'charmed'],
      });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'CHARMED' }, // uppercase — case-insensitive match
        getRV,
        setRV,
        'Campaign'
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded'], 'Campaign');
    });

    it('removes condition when condition is passed as a plain string', () => {
      const getRV = makeGetRuntimeValue({
        'Hero:activeConditions': ['frightened', 'grappled'],
      });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        'Frightened', // string instead of object with key
        getRV,
        setRV,
        'Campaign'
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['grappled'], 'Campaign');
    });

    it('handles null activeConditions gracefully (treats as empty array)', () => {
      const getRV = vi.fn(() => null);
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'poisoned' },
        getRV,
        setRV,
        'Campaign'
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], 'Campaign');
    });

    it('handles undefined activeConditions gracefully', () => {
      const getRV = vi.fn(() => undefined);
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'poisoned' },
        getRV,
        setRV,
        'Campaign'
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], 'Campaign');
    });
  });

  describe('monster creature removal', () => {
    it('removes condition by id from monster conditions array', () => {
      const combatSummary = {
        creatures: [
          { type: 'monster', name: 'Orc', conditions: [{ id: 'a', key: 'blinded' }, { id: 'b', key: 'charmed' }] },
        ],
      };

      removeCondition(
        combatSummary,
        'Orc',
        { id: 'a' },
        null, // getRuntimeValue unused for monster
        null, // setRuntimeValue unused for monster
        ''
      );

      expect(combatSummary.creatures[0].conditions).toEqual([{ id: 'b', key: 'charmed' }]);
    });

    it('preserves other conditions when removing by id', () => {
      const combatSummary = {
        creatures: [
          { type: 'monster', name: 'Orc', conditions: [{ id: 'c', key: 'grappled' }] },
        ],
      };

      removeCondition(
        combatSummary,
        'Orc',
        { id: 'x' }, // no matching id
        null,
        null,
        ''
      );

      expect(combatSummary.creatures[0].conditions).toEqual([{ id: 'c', key: 'grappled' }]);
    });
  });

  describe('creature not found', () => {
    it('does nothing when player creature name not in combatSummary', () => {
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Other' }] },
        'NonExistent',
        { key: 'blinded' },
        vi.fn(),
        setRV,
        ''
      );

      expect(setRV).not.toHaveBeenCalled();
    });

    it('does nothing when monster creature name not in combatSummary', () => {
      const combatSummary = { creatures: [{ type: 'monster', name: 'Orc' }] };

      removeCondition(
        combatSummary,
        'Ghost',
        { id: 'x' },
        vi.fn(),
        vi.fn(),
        ''
      );

      // No mutation should occur
      expect(combatSummary.creatures).toEqual([{ type: 'monster', name: 'Orc' }]);
    });
  });

  describe('case-insensitive matching for player', () => {
    it('removes lower-case condition when key is uppercase', () => {
      const getRV = makeGetRuntimeValue({
        'Hero:activeConditions': ['charmed'],
      });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'CHARMED' },
        getRV,
        setRV,
        ''
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], '');
    });

    it('removes mixed-case condition from array', () => {
      const getRV = makeGetRuntimeValue({
        'Hero:activeConditions': ['Charmed'],
      });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed' },
        getRV,
        setRV,
        ''
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], '');
    });

    it('removes condition when passed string is uppercase and stored value is lowercase', () => {
      const getRV = makeGetRuntimeValue({
        'Hero:activeConditions': ['frightened'],
      });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        'FRIGHTENED',
        getRV,
        setRV,
        ''
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', [], '');
    });
  });

  describe('no-op when condition not in list', () => {
    it('does not call setRuntimeValue when player has no matching condition', () => {
      const getRV = makeGetRuntimeValue({
        'Hero:activeConditions': ['blinded'],
      });
      const setRV = makeSetRuntimeValue();

      removeCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed' },
        getRV,
        setRV,
        ''
      );

      // condition not found → filtered === original → still updated since filter ran
      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded'], '');
    });
  });
});

describe('addCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player immunity check', () => {
    it('does not add condition when playerStats provided and player is immune', () => {
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
        { name: 'Hero', allFeatures: [] } // playerStats
      );

      expect(playerIsImmuneToCondition).toHaveBeenCalled();
      expect(setRV).not.toHaveBeenCalled();
    });

    it('does not call playerIsImmuneToCondition when playerStats is null', () => {
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
        '', // campaignName is empty — should skip immunity check
        null // playerStats
      );

      expect(playerIsImmuneToCondition).not.toHaveBeenCalled();
    });

    it('does not call playerIsImmuneToCondition when campaignName is falsy (even with getRuntimeValue)', () => {
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
         '', // campaignName is falsy — immunity check skipped
         {} // playerStats present but campaignName prevents call
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
        playerStats
      );

      expect(playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'charmed',
        playerStats,
        getRuntimeValue: getRV,
        campaignName: 'Campaign',
      });
    });
  });

  describe('player creature — add to activeConditions', () => {
    it('adds new condition to player activeConditions', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': ['blinded'] });
      const setRV = makeSetRuntimeValue();

      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV,
        setRV,
        'Campaign',
        {}
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['blinded', 'charmed'], 'Campaign');
    });

    it('deduplicates condition before adding (case-insensitive)', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const getRV = makeGetRuntimeValue({ 'Hero:activeConditions': ['Charmed'] });
      const setRV = makeSetRuntimeValue();

      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        getRV,
        setRV,
        'Campaign',
        {}
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['charmed'], 'Campaign');
    });

    it('handles null activeConditions and adds new condition', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const getRV = vi.fn(() => null);
      const setRV = makeSetRuntimeValue();

      addCondition(
        { creatures: [{ type: 'player', name: 'Hero' }] },
        'Hero',
        { key: 'poisoned', label: 'Poisoned' },
        12,
        'con',
        getRV,
        setRV,
        '',
        {}
      );

      expect(setRV).toHaveBeenCalledWith('Hero', 'activeConditions', ['poisoned'], '');
    });
  });

  describe('monster creature — add inline condition object', () => {
    it('adds new condition object to monster conditions array', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const combatSummary = {
        creatures: [
          { type: 'npc', name: 'Goblin', conditions: [] },
        ],
      };

      addCondition(
        combatSummary,
        'Goblin',
        { key: 'frightened', label: 'Frightened' },
        13,
        'wis',
        vi.fn(),
        vi.fn(),
        '',
        null // no playerStats for monsters
      );

      const condition = combatSummary.creatures[0].conditions[0];
      expect(condition.key).toBe('frightened');
      expect(condition.label).toBe('Frightened');
      expect(condition.dc).toBe(13);
      expect(condition.ability).toBe('wis');
      expect(condition.id).toBeDefined();
    });

    it('deduplicates existing condition by key before adding for monsters', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const combatSummary = {
        creatures: [
          { type: 'npc', name: 'Goblin', conditions: [{ id: 'x', key: 'blinded' }] },
        ],
      };

      addCondition(
        combatSummary,
        'Goblin',
        { key: 'blinded', label: 'Blinded' },
        10,
        'null',
        vi.fn(),
        vi.fn(),
        '',
        null
      );

      const conditions = combatSummary.creatures[0].conditions;
      expect(conditions.length).toBe(1); // replaced duplicate
      expect(conditions[0].key).toBe('blinded');
    });

    it('falls back to Date.now + Math.random id when crypto.randomUUID missing', () => {
      playerIsImmuneToCondition.mockReturnValue(false);
      const originalRandomUUID = crypto.randomUUID;
      delete globalThis.crypto.randomUUID;

      try {
        const combatSummary = {
          creatures: [
            { type: 'npc', name: 'Orc', conditions: [] },
          ],
        };

        addCondition(
          combatSummary,
          'Orc',
          { key: 'stunned', label: 'Stunned' },
          10,
          'con',
          vi.fn(),
          vi.fn(),
          '',
          null
        );

        const id = combatSummary.creatures[0].conditions[0].id;
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^\d+-/);
      } finally {
        globalThis.crypto.randomUUID = originalRandomUUID;
      }
    });
  });

  describe('creature not found', () => {
    it('does nothing when creature name not in combatSummary (player path)', () => {
      const setRV = makeSetRuntimeValue();

      addCondition(
        { creatures: [{ type: 'player', name: 'Other' }] },
        'NonExistent',
        { key: 'blinded', label: 'Blinded' },
        10,
        'null',
        vi.fn(),
        setRV,
        '',
        null
      );

      expect(setRV).not.toHaveBeenCalled();
    });

    it('does nothing when creature name not in combatSummary (monster path)', () => {
      const combatSummary = { creatures: [{ type: 'npc', name: 'Orc' }] };

      addCondition(
        combatSummary,
        'NonExistent',
        { key: 'blinded', label: 'Blinded' },
        10,
        'null',
        vi.fn(),
        vi.fn(),
        '',
        null
      );

      expect(combatSummary.creatures).toEqual([{ type: 'npc', name: 'Orc' }]);
    });
  });

  describe('immunity early return still called before creature not found', () => {
    it('checks immunity before checking creature existence when playerStats present', () => {
      playerIsImmuneToCondition.mockReturnValue(true);

      addCondition(
        { creatures: [] }, // no creatures at all
        'NonExistent',
        { key: 'charmed', label: 'Charmed' },
        15,
        'wis',
        vi.fn(),
        makeSetRuntimeValue(),
        'Campaign',
        {}
      );

      expect(playerIsImmuneToCondition).toHaveBeenCalled();
    });
  });
});

describe('buildConditionPopup', () => {
  it('returns a popup object with all fields correctly set', () => {
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

  it('sets success to false when save fails', () => {
    const popup = buildConditionPopup(5, 2, undefined, 'Strength', 'Grappled', 14, false);

    expect(popup.success).toBe(false);
    expect(popup.rollType).toBe('condition-save');
    expect(popup.hit).toBeUndefined();
  });

  it('handles null bonusDetail gracefully', () => {
    const popup = buildConditionPopup(10, 0, null, 'Constitution', 'Paralyzed', 12, true);

    expect(popup.bonusDetail).toBeNull();
    expect(popup.bonus).toBe(0);
  });

  it('handles undefined bonusDetail', () => {
    const popup = buildConditionPopup(8, 3, undefined, 'Dexterity', 'Blinded', 11, false);

    expect(popup.bonusDetail).toBeUndefined();
    expect(popup.bonus).toBe(3);
  });

  it('handles empty string bonusDetail', () => {
    const popup = buildConditionPopup(20, 10, '', 'Intelligence', 'Stunned', 20, true);

    expect(popup.bonusDetail).toBe('');
  });

  it('sets targetName to null and targetAc to null in all cases', () => {
    const popup = buildConditionPopup(1, -3, 'detail', 'Charisma', 'Frightened', 5, false);

    expect(popup.targetName).toBeNull();
    expect(popup.targetAc).toBeNull();
  });

  it('includes the correct name (ability label) in popup', () => {
    const popup = buildConditionPopup(13, 1, undefined, 'Charisma', 'Bewitched', 14, false);
    expect(popup.name).toBe('Charisma');
  });

  it('wraps the roll in an array inside rolls field', () => {
    const popup = buildConditionPopup(7, 0, undefined, 'Wisdom', 'Cursed', 10, false);
    expect(Array.isArray(popup.rolls)).toBe(true);
    expect(popup.rolls).toEqual([7]);
    expect(popup.rolls.length).toBe(1);
  });
});
