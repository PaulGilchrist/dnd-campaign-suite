// @maintained-by-ai 2026-11-18
// Lane: Phase 6 GREASE consumer routing of expireStaleEffects — the
// dispatch seam from a carrier's turn-start sweep to processGreaseAreaSave
// (owner decision 2026-11-19 "WIRE IT": the SP-056 recurring lane was
// pending-wired — processGreaseAreaSave had ZERO production callers — and is
// now wired through the SP-111/SP-126 processZoneTurnStartSaves helper,
// exactly like the stinking-cloud/web lanes this file mirrors).
// This lane owns only the grease-visible dispatch consequence: the exact
// 4-arg dispatch (caster, carrier, campaign, tracking mapName), the 'grease'
// effectKey / '_grease_' trackingPrefix store addressing, and the negative
// legs (tracking swept, tracking without saveDc, caster-only tracking with no
// zone te, te on another creature). Save CONTENT (DEX recurring save,
// already-Prone skip, in-area check, immunity) is owned by
// greaseAreaSaveHandler.areaSave.test.js; the cast-side te/tracking writers
// are owned by greaseAreaSaveHandler.handle.test.js; clock-clear consumption
// is clearExpirationEffects.grease-sleet-zone-expiry.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 2),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/sleetStormHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processSleetStormAreaSave: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../automation/handlers/spells/stinkingCloudHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processStinkingCloudAreaSave: vi.fn().mockResolvedValue(null),
  applyStinkingCloudTurnEnd: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../automation/handlers/spells/webAreaSaveHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processWebAreaSave: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../automation/handlers/spells/greaseAreaSaveHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processGreaseAreaSave: vi.fn().mockResolvedValue(null),
}));

import { expireStaleEffects } from './expireStaleEffects.js';
import { processGreaseAreaSave } from '../../automation/handlers/spells/greaseAreaSaveHandler.js';
import { getRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';

const campaignName = 'test-campaign';

// The live grease zone te written at cast (stampGreaseZoneEffects).
const GREASE_TE = { target: 'Zombie 1', effect: 'grease', source: 'TestCaster', dc: 15, duration: '1_minute' };
// Caster-side zone tracking produced at cast (`_grease_<caster>`).
const ZONE_TRACKING = { caster: 'TestCaster', saveDc: 15, saveType: 'DEX', mapName: 'Battle Map' };

// mockClear keeps implementations — explicitly reset the mutable seams so a
// seeded store or active name from a previous test can never leak into the
// next, then restore the neutral defaults the sweep expects.
function resetMocks() {
  vi.clearAllMocks();
  getAllStoreKeys.mockReset().mockReturnValue([]);
  getRuntimeValue.mockReset().mockReturnValue(null);
  processGreaseAreaSave.mockReset().mockResolvedValue(null);
  getActiveCreatureName.mockReset().mockReturnValue('Zombie 1');
  getCombatSummary.mockReset().mockReturnValue({
    creatures: [{ name: 'TestCaster' }, { name: 'Zombie 1' }, { name: 'Thug 1' }],
  });
}

function seedStore(values) {
  getRuntimeValue.mockImplementation((name, prop) => {
    const key = `${name}.${prop}`;
    return key in values ? values[key] : null;
  });
}

describe('expireStaleEffects — Phase 6 grease turn-start recurring save', () => {
  beforeEach(resetMocks);

  it('dispatches exactly one grease area save for the active carrier, passing the caster zone tracking through under the _grease_ prefix', async () => {
    seedStore({
      'campaign.targetEffects': [GREASE_TE],
      'TestCaster._grease_TestCaster': ZONE_TRACKING,
    });

    await expireStaleEffects(campaignName);

    // the grease-specific tracking key is read on the caster
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCaster', '_grease_TestCaster', campaignName);
    // 5-arg dispatch (Option A, bug-zone-save-computedstats-bucket-has-no-
    // producer): caster, carrier, campaign, tracking mapName, roster-resolved
    // targetStats — undefined here (no characters threaded; monster carrier).
    expect(processGreaseAreaSave).toHaveBeenCalledTimes(1);
    expect(processGreaseAreaSave).toHaveBeenCalledWith('TestCaster', 'Zombie 1', campaignName, 'Battle Map', undefined);
  });

  it('threads the roster-resolved targetStats (computedStats || character) into the recurring save', async () => {
    // LIVE PIN: the immunity gate's ONLY stats source is this threaded param
    // (the runtime `computedStats` bucket has no producer and its read is
    // deleted). A dropped thread fails the 5th-arg pin.
    getActiveCreatureName.mockReturnValue('Hero');
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestCaster' }, { name: 'Hero' }] });
    seedStore({
      'campaign.targetEffects': [{ target: 'Hero', effect: 'grease', source: 'TestCaster', dc: 13, duration: '1 minute' }],
      'TestCaster._grease_TestCaster': ZONE_TRACKING,
    });
    const heroStats = { name: 'Hero', immunities: ['prone'] };

    await expireStaleEffects(campaignName, 'Hero', [{ name: 'Hero', computedStats: heroStats }]);

    expect(processGreaseAreaSave).toHaveBeenCalledTimes(1);
    expect(processGreaseAreaSave).toHaveBeenCalledWith('TestCaster', 'Hero', campaignName, 'Battle Map', heroStats);
  });

  it.each([
    {
      name: 'the caster zone tracking is gone (clock expiry swept it)',
      activeName: 'Zombie 1',
      store: { 'campaign.targetEffects': [GREASE_TE] },
    },
    {
      name: 'zone tracking exists but carries no saveDc',
      activeName: 'Zombie 1',
      store: {
        'campaign.targetEffects': [GREASE_TE],
        'TestCaster._grease_TestCaster': { caster: 'TestCaster', saveType: 'DEX', mapName: 'Battle Map' },
      },
    },
    {
      name: 'only the caster zone tracking stands — no live grease te anywhere',
      activeName: 'Zombie 1',
      store: {
        'campaign.targetEffects': [],
        'TestCaster._grease_TestCaster': ZONE_TRACKING,
      },
    },
    {
      name: 'the live grease te sits on another creature, not the active one',
      activeName: 'Thug 1',
      store: {
        'campaign.targetEffects': [GREASE_TE],
        'TestCaster._grease_TestCaster': ZONE_TRACKING,
      },
    },
  ])('does not fire a grease save when $name', async ({ activeName, store }) => {
    getActiveCreatureName.mockReturnValue(activeName);
    seedStore(store);

    await expireStaleEffects(campaignName);

    expect(processGreaseAreaSave).not.toHaveBeenCalled();
  });
});
