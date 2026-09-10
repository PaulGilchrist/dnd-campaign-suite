// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
} from './truePolymorphService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { revertPolymorph } from './polymorphService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: { CON: { bonus: 2 } },
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

describe('truePolymorphService.summonCreatureFromObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      return undefined;
    });
  });

  it('returns no_monster when monster is not found', async () => {
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    const result = await summonCreatureFromObject('nonexistent', casterName, 15, 9, makePlayerStats(), campaignName);

    expect(result).toEqual({ ok: false, reason: 'no_monster' });
  });

  it('returns no_combat when there is no combat summary', async () => {
    getCombatSummary.mockReturnValue(null);
    loadMonsters.mockResolvedValue([{ index: 'wolf', name: 'Wolf' }]);

    const result = await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    expect(result).toEqual({ ok: false, reason: 'no_combat' });
  });

  it('creates a new creature and adds it to combat', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      type: 'beast',
      armor_class: 13,
      hit_points: 11,
      damage_resistances: ['slashing'],
      damage_immunities: [],
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [{ name: 'Bite' }],
    };
    loadMonsters.mockResolvedValue([monster]);

    const result = await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    expect(result.ok).toBe(true);
    expect(result.creatureName).toBe('Wolf');

    const cs = getCombatSummary(campaignName);
    const wolf = cs.creatures.find(c => c.name === 'Wolf');
    expect(wolf).toBeDefined();
    expect(wolf.summonedBy).toBe(casterName);
    expect(wolf.summonSource).toBe('true_polymorph');
    expect(wolf.monsterIndex).toBe('wolf');
  });

  it('uses canonical monster AC — no slot scaling (43g)', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('wolf', casterName, 15, 3, makePlayerStats(), campaignName);

    const cs = getCombatSummary(campaignName);
    const wolf = cs.creatures.find(c => c.name === 'Wolf');
    expect(wolf.ac).toBe(13); // canonical monsters.json armor_class — no slot scaling (43g)
  });

  it('uses base HP regardless of slot level', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('wolf', casterName, 15, 5, makePlayerStats(), campaignName);

    const cs = getCombatSummary(campaignName);
    const wolf = cs.creatures.find(c => c.name === 'Wolf');
    expect(wolf.maxHp).toBe(11);
    expect(wolf.currentHp).toBe(11);
  });

  it('sets initiative as value - 0.1', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    const cs = getCombatSummary(campaignName);
    const wolf = cs.creatures.find(c => c.name === 'Wolf');
    expect(wolf.initiative).toBe('14.9');
  });

  it('adds a summoned targetEffect', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Wolf',
          source: casterName,
          effect: 'summoned',
          duration: 'concentration',
        }),
      ]),
      campaignName,
      true,
    );
  });

  it('does not duplicate summoned targetEffect if one already exists', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [{ target: 'Wolf', source: casterName, effect: 'summoned', duration: 'concentration' }];
      }
      return undefined;
    });

    await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    // setRuntimeValue should not be called for targetEffects since the effect already exists
    const effectsCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'targetEffects');
    expect(effectsCalls.length).toBe(0);
  });

  it('registers concentration on the caster', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    expect(addConcentration).toHaveBeenCalledWith(
      expect.any(Object),
      casterName,
      'True Polymorph',
      expect.any(Number),
    );
  });

  it('logs the summon', async () => {
    const monster = {
      index: 'wolf',
      name: 'Wolf',
      armor_class: 13,
      hit_points: 11,
      size: 'Medium',
      speed: '50 ft.',
      ability_scores: { str: 12, dex: 14, con: 11, int: 3, wis: 12, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('wolf', casterName, 15, 9, makePlayerStats(), campaignName);

    const logCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('transforms an object into Wolf'));
    expect(logCalls.length).toBe(1);
  });

  it('sets default values for missing monster fields', async () => {
    const monster = {
      index: 'empty',
      name: 'Empty',
      armor_class: 10,
      hit_points: 0,
      ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('empty', casterName, 15, 9, makePlayerStats(), campaignName);

    const cs = getCombatSummary(campaignName);
    const creature = cs.creatures.find(c => c.name === 'Empty');
    expect(creature.type).toBe('npc');
    expect(creature.monsterType).toBeUndefined();
    expect(creature.size).toBe('Medium');
    expect(creature.speed).toEqual({ walk: '30 ft.' });
    expect(creature.actions).toEqual([]);
  });

  it('calculates monster save bonuses correctly', async () => {
    const monster = {
      index: 'goblin',
      name: 'Goblin',
      armor_class: 15,
      hit_points: 11,
      size: 'Small',
      speed: '30 ft.',
      ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      proficiency_bonus: 2,
      special_abilities: [{ name: 'Goblin Stealth' }],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('goblin', casterName, 15, 9, makePlayerStats(), campaignName);

    const cs = getCombatSummary(campaignName);
    const creature = cs.creatures.find(c => c.name === 'Goblin');
    // str: floor((8-10)/2) = -1, no str save bonus
    expect(creature.saveBonuses.str).toBe(-1);
    // dex: floor((14-10)/2) = 2, no dex save bonus in abilities
    expect(creature.saveBonuses.dex).toBe(2);
    // con: floor((10-10)/2) = 0
    expect(creature.saveBonuses.con).toBe(0);
    // wis: floor((8-10)/2) = -1
    expect(creature.saveBonuses.wis).toBe(-1);
  });

  it('uses monster damage_immunities as fallback for immunities', async () => {
    const monster = {
      index: 'fire_elemental',
      name: 'Fire Elemental',
      armor_class: 12,
      hit_points: 50,
      size: 'Large',
      speed: '40 ft.',
      damage_immunities: ['fire'],
      ability_scores: { str: 10, dex: 10, con: 10, int: 6, wis: 10, cha: 10 },
      proficiency_bonus: 2,
      special_abilities: [],
      actions: [],
    };
    loadMonsters.mockResolvedValue([monster]);

    await summonCreatureFromObject('fire_elemental', casterName, 15, 9, makePlayerStats(), campaignName);

    const cs = getCombatSummary(campaignName);
    const creature = cs.creatures.find(c => c.name === 'Fire Elemental');
    expect(creature.immunities).toEqual(['fire']);
  });
});

describe('truePolymorphService.revertTruePolymorph', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when combat summary has no creatures', () => {
    getCombatSummary.mockReturnValue({ creatures: null });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when target creature is not found', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(false);
  });

  it('removes summoned creature from combat and logs', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: targetName, type: 'monster', summonedBy: casterName, summonSource: 'true_polymorph' },
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(true);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();

    const logCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('fades away'));
    expect(logCalls.length).toBe(1);

    // Verify the stored combat summary has the creature removed
    const storageCall = vi.mocked(storage.set).mock.calls.find(call => call[0] === 'combatSummary');
    const storedCs = storageCall[1];
    const found = storedCs.creatures.find(c => c.name === targetName);
    expect(found).toBeUndefined();
  });

  it('removes summoned targetEffect for the creature', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: targetName, type: 'monster', summonedBy: casterName, summonSource: 'true_polymorph' },
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockReturnValue([
      { target: targetName, source: casterName, effect: 'summoned', duration: 'concentration' },
      { target: 'Other', source: 'Other', effect: 'hold_monster' },
    ]);

    revertTruePolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({ target: 'Other', effect: 'hold_monster' }),
      ]),
      campaignName,
      true,
    );
  });

  it('reverts object transform: restores original stats', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          maxHp: 34,
          ac: 11,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block', icon: 'fa-cube' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['incapacitated'];
      return undefined;
    });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(true);

    const cs = getCombatSummary(campaignName);
    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(15);
    expect(creature.ac).toBe(13);
    expect(creature.speed).toBe('30 ft.');
    expect(creature.polymorphObject).toBeUndefined();
    expect(creature.objectType).toBeUndefined();
    expect(creature.polymorphSource).toBeUndefined();
    expect(creature.polymorphOriginal).toBeUndefined();
  });

  it('removes incapacitated condition on object transform revert', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          maxHp: 34,
          ac: 11,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['incapacitated', 'blinded'];
      return undefined;
    });

    revertTruePolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      targetName,
      'activeConditions',
      ['blinded'],
      campaignName,
    );
  });

  it('does not modify conditions if incapacitated is not present', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          maxHp: 34,
          ac: 11,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['blinded'];
      return undefined;
    });

    revertTruePolymorph(targetName, campaignName);

    const condCalls = vi.mocked(setRuntimeValue).mock.calls.filter(call => call[1] === 'activeConditions' && call[0] === targetName);
    expect(condCalls.length).toBe(0);
  });

  it('removes object_transform targetEffect on revert', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          maxHp: 34,
          ac: 11,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return [];
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: targetName, source: casterName, effect: 'object_transform', duration: 'concentration' },
          { target: 'Other', source: 'Other', effect: 'hold_monster' },
        ];
      }
      return undefined;
    });

    revertTruePolymorph(targetName, campaignName);

    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[1] === 'targetEffects');
    if (effectsCall) {
      const effects = effectsCall[2];
      expect(effects.find(e => e.effect === 'object_transform')).toBeUndefined();
      expect(effects.find(e => e.effect === 'hold_monster')).toBeDefined();
    }
  });

  it('logs the revert for object transform', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          maxHp: 34,
          ac: 11,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockReturnValue([]);

    revertTruePolymorph(targetName, campaignName);

    const revertCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('reverts to their normal form'));
    expect(revertCalls.length).toBe(1);
  });

  it('falls through to revertPolymorph for creature_to_creature polymorph', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          polymorphSource: casterName,
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockReturnValue([]);
    revertPolymorph.mockReturnValue(true);

    const result = revertTruePolymorph(targetName, campaignName);

    expect(revertPolymorph).toHaveBeenCalledWith(targetName, campaignName);
    expect(result).toBe(true);
  });

  it('returns false when creature has no polymorph fields', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: targetName, type: 'monster', maxHp: 15, ac: 13, speed: '30 ft.' },
      ],
    });

    const result = revertTruePolymorph(targetName, campaignName);

    expect(result).toBe(false);
    expect(revertPolymorph).not.toHaveBeenCalled();
  });

  it('persists combat summary after reverting object transform', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          maxHp: 34,
          ac: 11,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphObject: { type: 'stone_block' },
          polymorphOriginal: { maxHp: 15, ac: 13, speed: '30 ft.' },
        },
      ],
    });
    getRuntimeValue.mockReturnValue([]);

    revertTruePolymorph(targetName, campaignName);

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
  });
});
