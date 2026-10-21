// @maintained-by-ai
// Lane: Phase 5 WEB consumer routing of expireStaleEffects (SP-126) — the
// dispatch seam from a carrier's turn-start sweep to processWebAreaSave.
// Web is WIRED here (vs the grease-pair pending wiring); the SP-126 bug
// was processWebAreaSave having ZERO callers and `_web_<caster>` ZERO
// producers. This lane owns only the web-visible consequence: the exact
// 4-arg dispatch (caster, carrier, campaign, tracking mapName), the
// 'web' effectKey / '_web_' trackingPrefix store addressing, and the
// negative legs (tracking swept, tracking without saveDc, te on another
// creature). Maturity arithmetic is the twin #1298
// (expirations_expireStaleEffects.test.js); real-clear E2E consequence is
// expireStaleEffects.test.js (#1299 real-clear lane). Save CONTENT (STR
// recurring save, already-Restrained skip, fire gap) is owned by
// webAreaSaveHandler.areaSave.test.js — its quintet seam map cites this
// file's exact-call + negative legs (PRESERVED-CITED-BY: the positive
// dispatch block below).
// Canon: saveType is STR for the recurring save (cast restraint is DEX);
// fixture reflects canon even though the handler is mocked here.
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

import { expireStaleEffects } from './expireStaleEffects.js';
import { processWebAreaSave } from '../../automation/handlers/spells/webAreaSaveHandler.js';
import { getRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';

const campaignName = 'test-campaign';

// The live web zone te written at cast, swept by the concentration break.
const WEB_TE = { target: 'Zombie 1', effect: 'web', source: 'TestCaster', dc: 19, duration: 'concentration' };
// Caster-side zone tracking produced at cast (`_web_<caster>`, SP-126).
const ZONE_TRACKING = { caster: 'TestCaster', saveDc: 19, saveType: 'STR', mapName: 'Spider Nest' };

// mockClear keeps implementations — explicitly reset the mutable seams so a
// seeded store or active name from a previous test can never leak into the
// next, then restore the neutral defaults the sweep expects.
function resetMocks() {
  vi.clearAllMocks();
  getAllStoreKeys.mockReset().mockReturnValue([]);
  getRuntimeValue.mockReset().mockReturnValue(null);
  processWebAreaSave.mockReset().mockResolvedValue(null);
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

describe('expireStaleEffects — Phase 5 web turn-start recurring save (SP-126)', () => {
  beforeEach(resetMocks);

  it('dispatches exactly one web area save for the active carrier, passing the caster zone tracking through under the _web_ prefix', async () => {
    seedStore({
      'campaign.targetEffects': [WEB_TE],
      'TestCaster._web_TestCaster': ZONE_TRACKING,
    });

    await expireStaleEffects(campaignName);

    // the web-specific tracking key is read on the caster
    expect(getRuntimeValue).toHaveBeenCalledWith('TestCaster', '_web_TestCaster', campaignName);
    // 4-arg dispatch: caster, carrier, campaign, tracking mapName
    expect(processWebAreaSave).toHaveBeenCalledTimes(1);
    expect(processWebAreaSave).toHaveBeenCalledWith('TestCaster', 'Zombie 1', campaignName, 'Spider Nest');
  });

  it.each([
    {
      name: 'the caster zone tracking is gone (concentration swept)',
      activeName: 'Zombie 1',
      store: { 'campaign.targetEffects': [WEB_TE] },
    },
    {
      name: 'zone tracking exists but carries no saveDc',
      activeName: 'Zombie 1',
      store: {
        'campaign.targetEffects': [WEB_TE],
        'TestCaster._web_TestCaster': { caster: 'TestCaster', saveType: 'STR', mapName: 'Spider Nest' },
      },
    },
    {
      name: 'the live web te sits on another creature, not the active one',
      activeName: 'Thug 1',
      store: {
        'campaign.targetEffects': [WEB_TE],
        'TestCaster._web_TestCaster': ZONE_TRACKING,
      },
    },
  ])('does not fire a web save when $name', async ({ activeName, store }) => {
    getActiveCreatureName.mockReturnValue(activeName);
    seedStore(store);

    await expireStaleEffects(campaignName);

    expect(processWebAreaSave).not.toHaveBeenCalled();
  });
});
