// @improved-by-ai
// BUG CLA-099 lock: the dragon_wings rounds-clock expiry must clear the active
// flag and log — previously the EXPIRATION_HANDLERS entry was a silent strip
// with zero runtime producers.
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
const WINGS_BUFF = { name: 'Dragon Wings', effect: 'dragon_wings' };

describe('CLA-099 dragon_wings expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the buff and the active flag and logs the duration expiry', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [WINGS_BUFF, { name: 'Bless', effect: 'bless' }];
      return null;
    });

    clearExpirationEffects([{ type: 'dragon_wings' }], 'AberrantSorcerer', 'AberrantSorcerer', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'dragonWingsActive', false, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'activeBuffs', [{ name: 'Bless', effect: 'bless' }], campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'AberrantSorcerer',
      abilityName: 'Dragon Wings',
      description: expect.stringContaining('duration has expired'),
    }));
  });

  it('clears the flag but stays silent when no wings buff stands (retract already dropped it)', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      return null;
    });

    clearExpirationEffects([{ type: 'dragon_wings' }], 'AberrantSorcerer', 'AberrantSorcerer', campaignName);

    expect(setRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'dragonWingsActive', false, campaignName);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
