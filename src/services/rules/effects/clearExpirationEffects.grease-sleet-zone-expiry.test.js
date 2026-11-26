// @maintained-by-ai 2026-11-18
// SP-056 WIRE IT lock (owner decision 2026-11-19): the grease/sleet zone
// clocks (greaseAreaSaveHandler.handle.js:76 / sleetStormHandler.handle
// .js:74 producers) must reach a real EXPIRATION_HANDLERS consumer — both
// types were silently skipped (unknown types fall through :644), leaving the
// `_grease_<caster>` / `_sleetStorm_<caster>` tracking keys as ghosts forever.
// Direct-handler contract of the inline 'remove_grease_area' and
// 'remove_sleet_storm_area' entries (clearExpirationEffects.js), mirroring the
// dragon-wings-expiry.test.js shape. Grease's handler performs at most two
// setRuntimeValue writes (unconditional tracking-key null + conditional zone-
// te strip, clear_silence_zone precedent — one type sweeps its own lane);
// sleet's is the bare tracking-key null (its `sleet_storm` tes live on the
// concentration-break sweep lane, untouched here). Neither logs (sibling
// shape: 'clear_runtime_value' is a silent nuller).
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
const caster = 'TestWizard';
const GREASE_KEY = '_grease_TestWizard';
const SLEET_KEY = '_sleetStorm_TestWizard';

const GREASE_TE = { target: 'Goblin', effect: 'grease', source: caster, dc: 13, duration: '1_minute' };
const FOREIGN_GREASE_TE = { target: 'Goblin', effect: 'grease', source: 'OtherWizard', dc: 15, duration: '1_minute' };
const SLEET_TE = { target: 'Goblin', effect: 'sleet_storm', source: caster, dc: 13, duration: 'concentration' };

const greaseExpiry = [{ type: 'remove_grease_area', greaseKey: GREASE_KEY }];
const sleetExpiry = [{ type: 'remove_sleet_storm_area', sleetKey: SLEET_KEY }];

describe('SP-056 remove_grease_area expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nulls the tracking key and strips only this caster\'s grease tes (foreign twins survive)', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [GREASE_TE, FOREIGN_GREASE_TE, SLEET_TE];
      return null;
    });

    clearExpirationEffects(greaseExpiry, caster, caster, campaignName);

    // Exact write budget: tracking-key null + one filtered te rewrite.
    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).toHaveBeenCalledWith(caster, GREASE_KEY, null, campaignName);
    // Own grease te goes; the other caster's grease te and the sleet te stand.
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [FOREIGN_GREASE_TE, SLEET_TE], campaignName);
    // Silent expiry — sibling nullers (clear_runtime_value) log nothing.
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('nulls the tracking key with zero te writes when no grease te stands', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [SLEET_TE];
      return null;
    });

    clearExpirationEffects(greaseExpiry, caster, caster, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(caster, GREASE_KEY, null, campaignName);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('normalizes a corrupt campaign targetEffects store without a rewrite', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return 'not-an-array';
      return null;
    });

    clearExpirationEffects(greaseExpiry, caster, caster, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(caster, GREASE_KEY, null, campaignName);
  });
});

describe('SP-056 remove_sleet_storm_area expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nulls the sleet zone tracking key — one write, no te sweep, no log', () => {
    getRuntimeValue.mockReturnValue(null);

    clearExpirationEffects(sleetExpiry, caster, caster, campaignName);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(caster, SLEET_KEY, null, campaignName);
    // The sleet_storm tes keep their concentration-break sweep lane.
    expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', campaignName);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
