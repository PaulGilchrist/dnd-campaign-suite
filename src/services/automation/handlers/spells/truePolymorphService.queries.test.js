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
  getActiveTruePolymorphs,
  getActiveObjectTransforms,
  getTruePolymorphCaster,
  getObjectTransformCaster,
} from './truePolymorphService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

describe('truePolymorphService.getActiveTruePolymorphs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only true_polymorph effects', () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'true_polymorph', source: casterName },
      { target: 'Orc', effect: 'polymorph', source: casterName },
      { target: 'Kobold', effect: 'true_polymorph', source: 'OtherCaster' },
    ]);

    const effects = getActiveTruePolymorphs(campaignName);

    expect(effects).toHaveLength(2);
    expect(effects.every(te => te.effect === 'true_polymorph')).toBe(true);
  });

  it('returns empty array when no effects exist', () => {
    getRuntimeValue.mockReturnValue([]);

    const effects = getActiveTruePolymorphs(campaignName);

    expect(effects).toEqual([]);
  });

  it('returns empty array when targetEffects is undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);

    const effects = getActiveTruePolymorphs(campaignName);

    expect(effects).toEqual([]);
  });
});

describe('truePolymorphService.getActiveObjectTransforms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only object_transform effects', () => {
    getRuntimeValue.mockReturnValue([
      { target: 'Goblin', effect: 'object_transform', source: casterName },
      { target: 'Orc', effect: 'true_polymorph', source: casterName },
      { target: 'Kobold', effect: 'object_transform', source: 'OtherCaster' },
    ]);

    const effects = getActiveObjectTransforms(campaignName);

    expect(effects).toHaveLength(2);
    expect(effects.every(te => te.effect === 'object_transform')).toBe(true);
  });

  it('returns empty array when no effects exist', () => {
    getRuntimeValue.mockReturnValue([]);

    const effects = getActiveObjectTransforms(campaignName);

    expect(effects).toEqual([]);
  });
});

describe('truePolymorphService.getTruePolymorphCaster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the source for a target with true_polymorph effect', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'true_polymorph', source: casterName },
      { target: targetName, effect: 'polymorph', source: 'OtherCaster' },
    ]);

    expect(getTruePolymorphCaster(targetName, campaignName)).toBe(casterName);
  });

  it('returns null when target has no true_polymorph effect', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'polymorph', source: casterName },
    ]);

    expect(getTruePolymorphCaster(targetName, campaignName)).toBeNull();
  });

  it('handles array target (takes first element)', () => {
    getRuntimeValue.mockReturnValue([
      { target: [targetName, 'extra'], effect: 'true_polymorph', source: casterName },
    ]);

    expect(getTruePolymorphCaster(targetName, campaignName)).toBe(casterName);
  });
});

describe('truePolymorphService.getObjectTransformCaster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the source for a target with object_transform effect', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'object_transform', source: casterName },
      { target: targetName, effect: 'true_polymorph', source: 'OtherCaster' },
    ]);

    expect(getObjectTransformCaster(targetName, campaignName)).toBe(casterName);
  });

  it('returns null when target has no object_transform effect', () => {
    getRuntimeValue.mockReturnValue([
      { target: targetName, effect: 'true_polymorph', source: casterName },
    ]);

    expect(getObjectTransformCaster(targetName, campaignName)).toBeNull();
  });

  it('handles array target (takes first element)', () => {
    getRuntimeValue.mockReturnValue([
      { target: [targetName, 'extra'], effect: 'object_transform', source: casterName },
    ]);

    expect(getObjectTransformCaster(targetName, campaignName)).toBe(casterName);
  });
});
