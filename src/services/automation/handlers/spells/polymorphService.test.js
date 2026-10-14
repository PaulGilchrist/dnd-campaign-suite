import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
  getCurrentCombatRound: vi.fn(() => 3),
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

vi.mock('./polymorphHandler.js', () => ({
  handle: vi.fn(),
}));

import { applyPolymorph, confirmPolymorphTransform, revertPolymorph, getActivePolymorphs, getPolymorphCaster } from './polymorphService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../../encounters/combatData.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';
import { handle as runPolymorphHandler } from './polymorphHandler.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

const beast = {
  name: 'Wolf',
  index: 'wolf',
  size: 'Medium',
  hit_points: 22,
  armor_class: 13,
  speed: '40 ft.',
  challenge_rating: '1/4',
};

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
  beast,
  casterName,
  spell: { name: 'Polymorph', level: 4 },
  playerStats: makePlayerStats(),
  campaignName,
};

describe('polymorphService.applyPolymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-polymorph spells', async () => {
    const result = await applyPolymorph({ name: 'Fireball' }, {}, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
    expect(runPolymorphHandler).not.toHaveBeenCalled();
  });

  it('dispatches to the polymorph handler and returns its result', async () => {
    const popup = { type: 'popup', payload: { type: 'polymorph_select', targetName } };
    runPolymorphHandler.mockResolvedValue(popup);

    const spell = { name: 'Polymorph', level: 4 };
    const result = await applyPolymorph(spell, { polymorphTarget: targetName, spellSaveDc: 15 }, makePlayerStats(), campaignName, null);

    expect(runPolymorphHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Polymorph',
        automation: expect.objectContaining({ type: 'polymorph', saveDc: 15, saveType: 'WIS' }),
        spellSlotLevel: 4,
      }),
      expect.anything(),
      campaignName,
      null,
    );
    expect(result).toBe(popup);
  });

  it('returns null when the handler throws', async () => {
    runPolymorphHandler.mockRejectedValue(new Error('boom'));

    const result = await applyPolymorph({ name: 'Polymorph', level: 4 }, { polymorphTarget: targetName }, makePlayerStats(), campaignName, null);

    expect(result).toBeNull();
  });
});

describe('polymorphService.confirmPolymorphTransform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 },
        { name: casterName, type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') return [];
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });
  });

  it('returns no_target when creature is missing from combat', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: casterName, type: 'player' }] });

    const result = await confirmPolymorphTransform(baseTransform);

    expect(result).toEqual({ ok: false, reason: 'no_target' });
  });

  it('overrides creature stats with beast form and stores originals', async () => {
    const cs = { creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }] };
    getCombatContext.mockResolvedValue(cs);

    await confirmPolymorphTransform(baseTransform);

    const creature = cs.creatures[0];
    expect(creature.maxHp).toBe(22);
    expect(creature.ac).toBe(13);
    expect(creature.speed).toBe('40 ft.');
    expect(creature.beastName).toBe('Wolf');
    expect(creature.polymorphSource).toBe(casterName);
    expect(creature.polymorphOriginal).toEqual({ maxHp: 7, ac: 15, speed: 30 });
  });

  it('sets temp HP to the full beast form HP', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 22, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 22, campaignName);
  });

  it('persists the combat summary', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    expect(setCombatSummaryCache).toHaveBeenCalled();
  });

  it('adds a polymorph targetEffect', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({ target: targetName, source: casterName, effect: 'polymorph', beastName: 'Wolf', duration: 'concentration' }),
      ]),
      campaignName,
      true,
    );
  });

  it('replaces an existing polymorph effect instead of duplicating', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [{ target: targetName, effect: 'polymorph', source: 'OldCaster' }];
      }
      if (key === casterName && subKey === 'pendingExpirations') return [];
      return undefined;
    });

    await confirmPolymorphTransform(baseTransform);

    const effectsCall = vi.mocked(setRuntimeValue).mock.calls.find(call => call[0] === 'campaign' && call[1] === 'targetEffects');
    const effects = effectsCall[2];
    expect(effects).toHaveLength(1);
    expect(effects[0].source).toBe(casterName);
  });

  it('registers concentration on the caster', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(addConcentration).toHaveBeenCalledWith(
      expect.any(Object),
      casterName,
      'Polymorph',
      expect.any(Number),
    );
  });

  it('writes a polymorph pending expiration with infinite rounds', async () => {
    await confirmPolymorphTransform(baseTransform);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      casterName,
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({
          target: targetName,
          effects: expect.arrayContaining([expect.objectContaining({ type: 'polymorph' })]),
          expiryRounds: Infinity,
        }),
      ]),
      campaignName,
    );
  });

  it('logs the transformation', async () => {
    await confirmPolymorphTransform(baseTransform);

    const transformCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('is transformed into Wolf'));
    expect(transformCalls.length).toBe(1);
  });
});

describe('polymorphService.revertPolymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [
        {
          name: targetName,
          type: 'monster',
          currentHp: 5,
          maxHp: 22,
          ac: 13,
          speed: '40 ft.',
          polymorphSource: casterName,
          polymorphOriginal: { maxHp: 7, ac: 15, speed: 30 },
          polymorphBeast: { name: 'Wolf' },
          beastName: 'Wolf',
        },
      ],
    });
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (key === 'campaign' && subKey === 'targetEffects') {
        return [{ target: targetName, source: casterName, effect: 'polymorph', beastName: 'Wolf' }];
      }
      if (key === targetName && subKey === 'polymorphTempHp') return 22;
      if (key === targetName && subKey === 'tempHp') return 22;
      if (key === casterName && subKey === 'pendingExpirations') {
        return [{ target: targetName, effects: [{ type: 'polymorph' }], expiryRounds: Infinity }];
      }
      return undefined;
    });
  });

  it('restores original creature stats and clears polymorph fields', () => {
    const cs = getCombatSummary(campaignName);
    const creature = cs.creatures[0];

    const changed = revertPolymorph(targetName, campaignName);

    expect(changed).toBe(true);
    expect(creature.maxHp).toBe(7);
    expect(creature.ac).toBe(15);
    expect(creature.speed).toBe(30);
    expect(creature.polymorphSource).toBeUndefined();
    expect(creature.polymorphOriginal).toBeUndefined();
    expect(creature.polymorphBeast).toBeUndefined();
    expect(creature.beastName).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
  });

  it('removes the polymorph targetEffect', () => {
    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], campaignName, true);
  });

  it('returns leftover temp HP by subtracting the polymorph buffer', () => {
    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'tempHp', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(targetName, 'polymorphTempHp', 0, campaignName);
  });

  it('removes the polymorph expiration from the caster', () => {
    revertPolymorph(targetName, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith(casterName, 'pendingExpirations', [], campaignName);
  });

  it('logs the revert', () => {
    revertPolymorph(targetName, campaignName);

    const revertCalls = vi.mocked(addEntry).mock.calls.filter(call => call[1]?.description.includes('reverts to their normal form'));
    expect(revertCalls.length).toBe(1);
  });

  it('is idempotent for a creature that is not polymorphed', () => {
    getCombatSummary.mockReturnValue({
      creatures: [{ name: targetName, type: 'monster', currentHp: 5, maxHp: 7, ac: 15, speed: 30 }],
    });
    getRuntimeValue.mockImplementation(() => undefined);

    const changed = revertPolymorph(targetName, campaignName);

    expect(changed).toBe(false);
  });
});

describe('polymorphService helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([
      { target: targetName, source: casterName, effect: 'polymorph' },
      { target: 'Orc', source: 'SomeoneElse', effect: 'polymorph' },
      { target: 'Kobold', source: casterName, effect: 'hold_monster' },
    ]);
  });

  it('getActivePolymorphs returns only polymorph effects', () => {
    const effects = getActivePolymorphs(campaignName);

    expect(effects).toHaveLength(2);
    expect(effects.every(te => te.effect === 'polymorph')).toBe(true);
  });

  it('getPolymorphCaster returns the source for a target', () => {
    expect(getPolymorphCaster(targetName, campaignName)).toBe(casterName);
  });

  it('getPolymorphCaster returns null when not polymorphed', () => {
    expect(getPolymorphCaster('Kobold', campaignName)).toBeNull();
  });
});
