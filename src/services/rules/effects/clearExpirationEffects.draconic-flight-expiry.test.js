// @maintained-by-ai
// BUG CLA-096 lock: the rounds-clock expiry must actually log (previously the
// fly buff was purged in silence unless the target happened to be incapacitated).
// Direct-handler contract of handleFlySpeedEqualsWalkSpeed
// (clearExpirationEffects.js 'fly_speed_equals_walk_speed'):
//   1. buff standing, holder not incapacitated → one duration-expiry log with
//      exact bytes + exact buff-strip write preserving foreign buffs;
//   2. incapacitated holder → only the Incapacitated dissolve log (cited by
//      #1285, preserved verbatim);
//   3. no fly buff standing (retract already cleared it) → silent, foreign
//      buffs preserved.
// Registration-side (addExpiration) is owned by the Draconic Flight modal lane;
// the turn-start incapacitated face lives in
// turnStartEffects.draconic-flight-incapacitated.test.js.
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
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';
const holder = 'DragonbornTest';

const FLY_BUFF = { name: 'Draconic Flight', effect: 'fly_speed_equals_walk_speed' };
const FOREIGN_BUFF = { name: 'Haste', effect: 'double_move' };

const expiry = [{ type: 'fly_speed_equals_walk_speed' }];

describe('CLA-096 fly_speed_equals_walk_speed expiry logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips only the fly buff and logs the duration expiry once when the clock drops it', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [FLY_BUFF, FOREIGN_BUFF];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearExpirationEffects(expiry, holder, holder, campaignName);

    // Exact buff-strip write: the fly effect buff goes, the foreign buff stands.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'activeBuffs', [FOREIGN_BUFF], campaignName);

    // Full log bytes; no Incapacitated dissolve text on the non-incapacitated path.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: holder,
      abilityName: 'Draconic Flight',
      description: "DragonbornTest's spectral wings dissolve — Draconic Flight's duration has expired.",
      timestamp: expect.any(Number),
    });
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
      if (key === 'activeBuffs') return [FOREIGN_BUFF];
      if (key === 'activeConditions') return [];
      return null;
    });

    clearExpirationEffects(expiry, holder, holder, campaignName);

    expect(addEntry).not.toHaveBeenCalled();
    // Final state: the foreign buff is preserved untouched by the no-op expiry.
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'activeBuffs', [FOREIGN_BUFF], campaignName);
  });
});
