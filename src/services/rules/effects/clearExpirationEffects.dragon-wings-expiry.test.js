// @maintained-by-ai
// BUG CLA-099 lock: the dragon_wings rounds-clock expiry must clear the active
// flag and log — previously the EXPIRATION_HANDLERS entry was a silent strip
// with zero runtime producers.
// Direct-handler contract of the inline 'dragon_wings' entry
// (clearExpirationEffects.js:418-431). This is a DISTINCT handler from
// handleFlySpeedEqualsWalkSpeed (CLA-096, owned by
// clearExpirationEffects.draconic-flight-expiry.test.js): no activeConditions
// read, no Incapacitated branch. Every expiry dispatch performs exactly two
// setRuntimeValue writes (unconditional flag clear + buff-strip); the log is
// gated on a wings buff standing:
//   1. buff standing → flag cleared, only the wings buff stripped (foreign
//      buff survives), one duration-expiry log with exact bytes;
//   2. no wings buff standing (retract already dropped it) → flag still
//      cleared, silent, foreign buffs preserved verbatim.
// Activation-side lives in dragonWingsHandler/dragonWingsService tests;
// rest-resource keys in restRules-constants.cla099-dragon-wings.test.js.
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
const holder = 'AberrantSorcerer';

const WINGS_BUFF = { name: 'Dragon Wings', effect: 'dragon_wings' };
const FOREIGN_BUFF = { name: 'Bless', effect: 'bless' };

const expiry = [{ type: 'dragon_wings' }];

describe('CLA-099 dragon_wings expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips only the wings buff, clears the flag, and logs the duration expiry once', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [WINGS_BUFF, FOREIGN_BUFF];
      return null;
    });

    clearExpirationEffects(expiry, holder, holder, campaignName);

    // Exact write budget: flag clear + buff-strip, nothing more.
    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'dragonWingsActive', false, campaignName);
    // Exact buff-strip write: the wings buff goes, the foreign buff stands.
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'activeBuffs', [FOREIGN_BUFF], campaignName);

    // Full log bytes.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: holder,
      abilityName: 'Dragon Wings',
      description: "AberrantSorcerer's draconic wings dissolve — Dragon Wings' duration has expired.",
      timestamp: expect.any(Number),
    });
  });

  it('clears the flag but stays silent when no wings buff stands (retract already dropped it)', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [FOREIGN_BUFF];
      return null;
    });

    clearExpirationEffects(expiry, holder, holder, campaignName);

    expect(addEntry).not.toHaveBeenCalled();
    // The flag clear is unconditional even on the silent path; the foreign
    // buff is preserved untouched by the no-strip buff write.
    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'dragonWingsActive', false, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith(holder, 'activeBuffs', [FOREIGN_BUFF], campaignName);
  });
});
