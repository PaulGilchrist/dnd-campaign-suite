// @improved-by-ai
// BUG CLA-096 lock: the rounds-clock expiry must actually log (previously the
// fly buff was purged in silence unless the target happened to be incapacitated).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { getName: vi.fn((val) => String(val)) },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
  restoreSuppressedConditions: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/polymorphService.js', () => ({ revertPolymorph: vi.fn() }));
vi.mock('../../automation/handlers/spells/animalShapesService.js', () => ({ revertAnimalShapes: vi.fn() }));
vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({ revertTruePolymorph: vi.fn() }));
vi.mock('../../automation/handlers/spells/shapechangeService.js', () => ({ revertShapechange: vi.fn() }));
vi.mock('../../combat/summons/summonedCreatureService.js', () => ({ removeSummonedCreatures: vi.fn() }));
vi.mock('../../combat/conditions/targetEffectDefinitions.js', () => ({ registerTargetEffect: vi.fn() }));
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

const FLY_BUFF = { name: 'Draconic Flight', effect: 'fly_speed_equals_walk_speed' };

describe('CLA-096 fly_speed_equals_walk_speed expiry logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs the duration expiry when the buff drops on the clock', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [FLY_BUFF];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearExpirationEffects([{ type: 'fly_speed_equals_walk_speed' }], 'DragonbornTest', 'DragonbornTest', campaignName);

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'DragonbornTest',
      abilityName: 'Draconic Flight',
      description: expect.stringContaining('duration has expired'),
    }));
  });

  it('keeps the Incapacitated dissolve text when the holder is incapacitated', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [FLY_BUFF];
      if (key === 'activeConditions') return ['incapacitated'];
      return null;
    });

    clearExpirationEffects([{ type: 'fly_speed_equals_walk_speed' }], 'DragonbornTest', 'DragonbornTest', campaignName);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      description: expect.stringContaining('due to the Incapacitated condition'),
    }));
  });

  it('stays silent when no fly buff stands (retract already cleared it)', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearExpirationEffects([{ type: 'fly_speed_equals_walk_speed' }], 'DragonbornTest', 'DragonbornTest', campaignName);

    expect(addEntry).not.toHaveBeenCalled();
  });
});
