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
  confirmTruePolymorphTransform,
  applyObjectTransform,
} from './truePolymorphService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

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

const baseTransform = {
  targetName,
  creature: {
    name: 'Bear',
    index: 'bear',
    size: 'Large',
    hit_points: 34,
    armor_class: 11,
    speed: '40 ft.',
    challenge_rating: '1',
  },
  casterName,
  spell: { name: 'True Polymorph', level: 9 },
  playerStats: makePlayerStats(),
  campaignName,
};

describe('truePolymorphService.confirmTruePolymorphTransform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: targetName, type: 'monster', currentHp: 7, maxHp: 15, ac: 13, speed: '30 ft.', initiative: 12, initiativeBonus: 0 },
        { name: casterName, type: 'player' },
      ],
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: targetName, type: 'monster', currentHp: 7, maxHp: 15, ac: 13, speed: '30 ft.', initiative: 12, initiativeBonus: 0 },
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
  });

  it('summons creature for object_into_creature mode', async () => {
    const creature = {
      name: 'Bear',
      index: 'bear',
      size: 'Large',
      hit_points: 34,
      armor_class: 11,
      speed: '40 ft.',
      challenge_rating: '1',
    };
    const mode = 'object_into_creature';
    loadMonsters.mockResolvedValue([{ index: 'bear', name: 'Bear' }]);

    const result = await confirmTruePolymorphTransform({
      targetName: null,
      creature,
      casterName,
      spell: { name: 'True Polymorph', level: 9 },
      playerStats: makePlayerStats(),
      campaignName,
      mode,
    });

    // The function delegates to summonCreatureFromObject which is the real function.
    // Verify it was reached by checking loadMonsters was called (summonCreatureFromObject calls it)
    expect(loadMonsters).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('summons creature with random initiative when caster has no initiative', async () => {
    const creature = {
      name: 'Bear',
      index: 'bear',
      size: 'Large',
      hit_points: 34,
      armor_class: 11,
      speed: '40 ft.',
      challenge_rating: '1',
    };
    const mode = 'object_into_creature';
    loadMonsters.mockResolvedValue([{ index: 'bear', name: 'Bear' }]);

    getCombatSummary.mockReturnValue({
      creatures: [
        { name: casterName, type: 'player', initiative: '', initiativeBonus: 2 },
      ],
    });

    const result = await confirmTruePolymorphTransform({
      targetName: null,
      creature,
      casterName,
      spell: { name: 'True Polymorph', level: 9 },
      playerStats: makePlayerStats(),
      campaignName,
      mode,
    });

    // Verify loadMonsters was called (summonCreatureFromObject calls it)
    expect(loadMonsters).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('returns no_target when creature is missing from combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = await confirmTruePolymorphTransform(baseTransform);

    expect(result).toEqual({ ok: false, reason: 'no_target' });
  });

  it('overrides creature stats with beast form and stores originals', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    await confirmTruePolymorphTransform(baseTransform);

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(34);
    expect(creature.ac).toBe(11);
    expect(creature.speed).toBe('40 ft.');
    expect(creature.beastName).toBe('Bear');
    expect(creature.polymorphSource).toBe(casterName);
    expect(creature.polymorphOriginal).toEqual({ maxHp: 7, ac: 15, speed: '30 ft.' });
    expect(creature.polymorphBeast).toEqual({
      name: 'Bear',
      index: 'bear',
      size: 'Large',
      hitPoints: 34,
      armorClass: 11,
      speed: '40 ft.',
      challengeRating: '1',
    });
  });

  it('sets temp HP to the full beast form HP', async () => {
    await confirmTruePolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 34, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 34, campaignName);
  });

  it('persists the combat summary', async () => {
    await confirmTruePolymorphTransform(baseTransform);

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
  });

  it('adds a true_polymorph targetEffect', async () => {
    await confirmTruePolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: targetName,
          source: casterName,
          effect: 'true_polymorph',
          duration: 'concentration',
          beastName: 'Bear',
          mode: 'creature_to_creature',
        }),
      ]),
      campaignName,
      true,
    );
  });

  it('replaces an existing true_polymorph or polymorph effect instead of duplicating', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: targetName, effect: 'true_polymorph', source: 'OldCaster' },
          { target: targetName, effect: 'polymorph', source: 'AnotherCaster' },
        ];
      }
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });

    await confirmTruePolymorphTransform(baseTransform);

    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    const effects = effectsCall[2];
    expect(effects).toHaveLength(1);
    expect(effects[0].source).toBe(casterName);
  });

  it('registers concentration on the caster', async () => {
    await confirmTruePolymorphTransform(baseTransform);

    expect(addConcentration).toHaveBeenCalledWith(
      expect.any(Object),
      casterName,
      'True Polymorph',
      expect.any(Number),
    );
  });

  it('writes a true_polymorph pending expiration with infinite rounds', async () => {
    await confirmTruePolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      casterName,
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({
          target: targetName,
          effects: expect.arrayContaining([expect.objectContaining({ type: 'true_polymorph' })]),
          expiryRounds: Infinity,
          expireOnCreatureName: null,
        }),
      ]),
      campaignName,
    );
  });

  it('logs the transformation', async () => {
    await confirmTruePolymorphTransform(baseTransform);

    const transformCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('is transformed into Bear'));
    expect(transformCalls.length).toBe(1);
  });

  it('handles creature with no hit_points (defaults to 0)', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    const creatureWithoutHp = {
      name: 'Bear',
      index: 'bear',
      size: 'Large',
      armor_class: 11,
      speed: '40 ft.',
      challenge_rating: '1',
    };

    await confirmTruePolymorphTransform({
      ...baseTransform,
      creature: creatureWithoutHp,
    });

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(0);
    expect(creature.ac).toBe(11);
  });
});

describe('truePolymorphService.applyObjectTransform', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns no_target when creature is missing from combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = await applyObjectTransform({
    targetName: 'Missing',
    objectType: 'stone_block',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    expect(result).toEqual({ ok: false, reason: 'no_target' });
  });

  it('overrides creature stats with object form and stores originals', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    const result = await applyObjectTransform({
    targetName,
    objectType: 'stone_block',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    expect(result.ok).toBe(true);

    const creature = cs.creatures[0];
    expect(creature.polymorphSource).toBe(casterName);
    expect(creature.polymorphOriginal).toEqual({ maxHp: 15, ac: 13, speed: '30 ft.' });
    expect(creature.polymorphObject).toEqual({ type: 'stone_block', icon: 'fa-cube' });
    expect(creature.objectType).toBe('stone_block');
  });

  it('adds incapacitated condition when not already present', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return [];
      return undefined;
    });

    await applyObjectTransform({
    targetName,
    objectType: 'iron_chain',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    expect(setRuntimeValue).toHaveBeenCalledWith(
      targetName,
      'activeConditions',
      expect.arrayContaining(['incapacitated']),
      campaignName,
    );
  });

  it('does not duplicate incapacitated condition when already present', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === targetName && subKey === 'activeConditions') return ['incapacitated'];
      return undefined;
    });

    await applyObjectTransform({
    targetName,
    objectType: 'iron_chain',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    const condCalls = vi.mocked(setRuntimeValue).mock.calls.filter(
      call => call[1] === 'activeConditions' && call[0] === targetName,
    );
    expect(condCalls.length).toBe(0);
  });

  it('persists the combat summary', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    await applyObjectTransform({
    targetName,
    objectType: 'stone_block',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
  });

  it('adds an object_transform targetEffect', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    await applyObjectTransform({
    targetName,
    objectType: 'wooden_crate',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: targetName,
          source: casterName,
          effect: 'object_transform',
          duration: 'concentration',
          objectType: 'wooden_crate',
        }),
      ]),
      campaignName,
      true,
    );
  });

  it('removes existing object_transform, true_polymorph, and polymorph effects before adding new one', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [
          { target: targetName, effect: 'object_transform', source: 'Old' },
          { target: targetName, effect: 'true_polymorph', source: 'Old' },
          { target: targetName, effect: 'polymorph', source: 'Old' },
          { target: 'Other', effect: 'hold_monster', source: 'Other' },
        ];
      }
      if (key === targetName && subKey === 'activeConditions') return [];
      return undefined;
    });

    await applyObjectTransform({
    targetName,
    objectType: 'stone_block',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    const effects = effectsCall[2];
    expect(effects).toHaveLength(2); // old ones removed + new one + Other
    expect(effects.find(e => e.effect === 'object_transform')?.source).toBe(casterName);
  });

  it('registers concentration on the caster', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }, { name: casterName, type: 'player' }] };
    getCombatContext.mockResolvedValue(cs);

    await applyObjectTransform({
    targetName,
    objectType: 'stone_block',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    expect(addConcentration).toHaveBeenCalledWith(
      expect.any(Object),
      casterName,
      'True Polymorph',
      expect.any(Number),
    );
  });

  it('logs the transformation', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    await applyObjectTransform({
    targetName,
    objectType: 'stone_block',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    const transformCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('is transformed into an stone_block'));
    expect(transformCalls.length).toBe(1);
  });

  it('uses default icon for unknown object types', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    await applyObjectTransform({
    targetName,
    objectType: 'mystery_type',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});

    const creature = cs.creatures[0];
    expect(creature.polymorphObject.icon).toBe('fa-circle');
  });

  it('handles all known object type icons', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 15, ac: 13, speed: '30 ft.' }] };
    getCombatContext.mockResolvedValue(cs);

    await applyObjectTransform({
    targetName,
    objectType: 'iron_bars',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});
    expect(cs.creatures[0].polymorphObject.icon).toBe('fa-grip-lines');

    await applyObjectTransform({
    targetName,
    objectType: 'glass_vial',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});
    expect(cs.creatures[0].polymorphObject.icon).toBe('fa-flask');

    await applyObjectTransform({
    targetName,
    objectType: 'leather_book',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});
    expect(cs.creatures[0].polymorphObject.icon).toBe('fa-book');

    await applyObjectTransform({
    targetName,
    objectType: 'bronze_statue',
    casterName,
    spell: { name: 'True Polymorph' },
    campaignName,
    playerStats: makePlayerStats(),
});
    expect(cs.creatures[0].polymorphObject.icon).toBe('fa-statue');
  });
});
