// @maintained-by-ai
// Lane: direct-module + barrel-import entry-point face of expireStaleEffects
// with the CLEAR side LIVE (real expireForCreature/expireForTarget/
// clearExpirationEffects run — no mock on the clear path). Maturity truth
// table, dispatch-arg routing and rewrite payloads are owned by the twin
// expirations_expireStaleEffects.test.js (#1298) which mocks the clear side
// to pin the sweep; here the sweep is proven end-to-end against the real
// handlers. Early exits are owned here (cited by expirations_applyAuraDamage
// .test.js:15 and the twin header). Phase 3 sleet seam: sleetStormHandler
// .areaSave.test.js + twin. Phase 5 web: expireStaleEffects.web.test.js.
// Cited BY: stinkingCloudHandler.areaSave.test.js ("expireStaleEffects.test
// .js:344-386" — the SP-111 block, preserved at the bottom of this file;
// range shifted to :292-334 after this pass), clearExpirationEffects.test.js
// (real-clear consequence face), naturesVeilHandler.test.js (self-targeted
// Phase 2 face — the :251-280 real invisible-clear owner, preserved).
// No-timers policy: the round is read ONLY through the getCurrentCombatRound
// seam; store fixtures use the exact-payload seedStore pattern (#1294).
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

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/stinkingCloudHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(null),
  processStinkingCloudAreaSave: vi.fn().mockResolvedValue(null),
  applyStinkingCloudTurnEnd: vi.fn().mockResolvedValue(null),
}));

import { expireStaleEffects } from './expirations.js';
import { processStinkingCloudAreaSave } from '../../automation/handlers/spells/stinkingCloudHandler.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import {
  getCurrentCombatRound,
  getActiveCreatureName,
  getCombatSummary,
} from '../../encounters/combatData.js';

const KEY = 'pendingExpirations';

// mockClear keeps implementations — explicitly reset the mutable seams so a
// seeded store or normalizer from a previous test can never leak into the
// next, then restore the neutral defaults the sweep expects.
function resetMocks() {
  vi.clearAllMocks();
  getAllStoreKeys.mockReset().mockReturnValue([]);
  getRuntimeValue.mockReset().mockReturnValue(null);
  getCombatSummary.mockReset().mockReturnValue(null);
  getCurrentCombatRound.mockReset().mockReturnValue(2);
  getActiveCreatureName.mockReset().mockReturnValue('Goblin');
  utils.getName.mockReset().mockImplementation((v) => v);
}

function seedStore(values) {
  getRuntimeValue.mockImplementation((name, prop) => {
    const key = `${name}.${prop}`;
    return key in values ? values[key] : null;
  });
}

function seedActiveCombat(activeName, currentRound, creatures) {
  getCurrentCombatRound.mockReturnValue(currentRound);
  getActiveCreatureName.mockReturnValue(activeName);
  getCombatSummary.mockReturnValue({ creatures });
}

// ---------------------------------------------------------------------------
// Early exits — owned here (cited by expirations_applyAuraDamage.test.js
// and the twin header). Nothing may read or write the store before the
// combat guards pass.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — early exits', () => {
  beforeEach(resetMocks);

  it.each([
    { name: 'null', value: null },
    { name: 'empty string', value: '' },
  ])('bails before any combat read when active creature name is $name', async ({ value }) => {
    getActiveCreatureName.mockReturnValue(value);

    await expireStaleEffects('MyCampaign');

    expect(getCombatSummary).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'null', summary: null },
    { name: 'not-an-object', summary: 'not-an-object' },
  ])('bails before any store read when combat summary is $name', async ({ summary }) => {
    getCombatSummary.mockReturnValue(summary);

    await expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'missing', summary: {} },
    { name: 'not an array', summary: { creatures: 'not-an-array' } },
  ])('bails before any store read when combat summary creatures is $name', async ({ summary }) => {
    getCombatSummary.mockReturnValue(summary);

    await expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 1 — creature matching, with the CLEAR side LIVE: normalized names
// gate the sweep, raw names address the store, and the real
// clearExpirationEffects runs against the matured entry.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — creature matching (real clear)', () => {
  beforeEach(resetMocks);

  it('matches via getName but reads, clears and rewrites the queue under the raw name, skipping non-matching creatures', async () => {
    utils.getName.mockImplementation((v) => (v === 'goblin' ? 'Goblin' : v));
    seedActiveCombat('Goblin', 2, [{ name: 'Orc' }, { name: 'goblin' }]);
    const stale = {
      target: 'Human',
      effects: [{ type: 'stunned', condition: 'speed_halved' }],
      appliedRound: 1,
      expiryRounds: 1,
    };
    seedStore({ 'goblin.pendingExpirations': [stale] });

    await expireStaleEffects('MyCampaign');

    // raw-name store access; the non-matching Orc store is never touched
    expect(getRuntimeValue).toHaveBeenCalledWith('goblin', KEY);
    expect(getRuntimeValue).not.toHaveBeenCalledWith('Orc', KEY);
    // real clearExpirationEffects ran for the matured entry's target...
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'stunned_speedHalved', null, 'MyCampaign');
    // ...and the queue was rewritten empty under the raw name
    expect(setRuntimeValue).toHaveBeenCalledWith('goblin', KEY, [], 'MyCampaign');
  });

  it('touches no stores at all when no creature matches the active name', async () => {
    seedActiveCombat('Goblin', 2, [{ name: 'Orc' }, { name: 'Dragon' }]);

    await expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Stale vs fresh sweep — real clear side, exact payloads. The mixed batch
// here proves the LIVE handlers keep fresh entries inert while the queue is
// rewritten with only the survivors; pure rewrite arithmetic is the twin's.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — stale vs fresh entries (real clear)', () => {
  beforeEach(resetMocks);

  it('clears only the matured entry via the real handlers and rewrites the queue with the exact survivor list', async () => {
    const stale = {
      target: 'Human',
      effects: [{ type: 'stunned', condition: 'speed_halved' }],
      appliedRound: 0,
      expiryRounds: 1,
    };
    const fresh = {
      target: 'Orc',
      effects: [{ type: 'advantage_on_target' }],
      appliedRound: 2,
      expiryRounds: 1,
    };
    seedActiveCombat('Goblin', 2, [{ name: 'Goblin' }]);
    seedStore({ 'Goblin.pendingExpirations': [stale, fresh] });

    await expireStaleEffects('MyCampaign');

    // matured entry cleared for real...
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'stunned_speedHalved', null, 'MyCampaign');
    // ...while the fresh entry's clear leg never ran
    expect(getRuntimeValue).not.toHaveBeenCalledWith('Goblin', '_advantageOn_Orc');
    // exactly one queue rewrite, carrying only the survivor
    const pendingWrites = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && c[1] === KEY,
    );
    expect(pendingWrites).toEqual([['Goblin', KEY, [fresh], 'MyCampaign']]);
  });
});

// ---------------------------------------------------------------------------
// Self-targeted expirations — scan other stores / own-store expiry with
// the real condition clear running. Cited owner: the :251 pre-rewrite test
// (now :224) — real invisible-clear end-to-end, preserved verbatim.
// ---------------------------------------------------------------------------
describe('expireStaleEffects — self-targeted expirations', () => {
  beforeEach(() => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(4);
    getActiveCreatureName.mockReturnValue('RangerGirl');
  });

  it('expires invisible condition when target matches active creature and round is met', async () => {
    seedActiveCombat('RangerGirl', 4, [{ name: 'RangerGirl' }]);
    getAllStoreKeys.mockReturnValue(['RangerGirl', 'Goblin']);
    seedStore({
      'RangerGirl.pendingExpirations': [
        { target: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], appliedRound: 3, expiryRounds: 1 },
      ],
      'RangerGirl.activeConditions': ['invisible'],
    });

    await expireStaleEffects('test-campaign');

    // Should have removed the invisible condition from activeConditions
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'RangerGirl',
      'activeConditions',
      [],
      'test-campaign'
    );
    // Should have cleared the expired entry
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'RangerGirl',
      KEY,
      [],
      'test-campaign'
    );
  });

  it('keeps self-targeted expiration when round not yet met (zero writes)', async () => {
    seedActiveCombat('RangerGirl', 4, [{ name: 'RangerGirl' }]);
    getAllStoreKeys.mockReturnValue(['RangerGirl']);
    seedStore({
      'RangerGirl.pendingExpirations': [
        { target: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], appliedRound: 3, expiryRounds: 2 },
      ],
      'RangerGirl.activeConditions': ['invisible'],
    });

    await expireStaleEffects('test-campaign');

    // entry survives at round 4 < 3 + 2 — nothing at all is written
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('normalizes the own corrupt store to [] without touching another creature\'s live store', async () => {
    seedActiveCombat('RangerGirl', 4, [{ name: 'RangerGirl' }]);
    getAllStoreKeys.mockReturnValue(['Goblin']);
    seedStore({
      // own store holds garbage — expireForCreature must rewrite it to []
      'RangerGirl.pendingExpirations': 'not-an-array',
      // Goblin owns a live entry targeting a third party — must survive
      'Goblin.pendingExpirations': [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'blinded' }], appliedRound: 3, expiryRounds: 2 },
      ],
    });

    await expireStaleEffects('test-campaign');

    // the ONLY write in the whole sweep is the own-store [] normalization
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('RangerGirl', KEY, [], 'test-campaign');
  });
});

// ---------------------------------------------------------------------------
// SP-111 Stinking Cloud turn-start CON saves (Phase 4) — CITED BY
// stinkingCloudHandler.areaSave.test.js (was :344-386, now :233-270).
// ---------------------------------------------------------------------------
describe('expireStaleEffects — SP-111 Stinking Cloud turn-start saves', () => {
  beforeEach(() => {
    resetMocks();
    getActiveCreatureName.mockReturnValue('Thug 1');
  });

  it('forces a CON area save when the active creature has a live stinking_cloud te', async () => {
    seedActiveCombat('Thug 1', 2, [{ name: 'Thug 1' }]);
    seedStore({
      'campaign.targetEffects': [{ target: 'Thug 1', effect: 'stinking_cloud', source: 'TestWizard', duration: 'concentration', dc: 18 }],
      'TestWizard._stinkingCloud_TestWizard': { saveDc: 18, saveType: 'CON', radius: 20, mapName: 'Cave' },
    });

    await expireStaleEffects('test-campaign');

    expect(processStinkingCloudAreaSave).toHaveBeenCalledTimes(1);
    expect(processStinkingCloudAreaSave).toHaveBeenCalledWith('TestWizard', 'Thug 1', 'test-campaign', 'Cave');
  });

  it('skips the save when the caster zone tracking is gone (cloud ended)', async () => {
    seedActiveCombat('Thug 1', 2, [{ name: 'Thug 1' }]);
    seedStore({
      'campaign.targetEffects': [{ target: 'Thug 1', effect: 'stinking_cloud', source: 'TestWizard', duration: 'concentration', dc: 18 }],
    });

    await expireStaleEffects('test-campaign');

    expect(processStinkingCloudAreaSave).not.toHaveBeenCalled();
  });

  it('does not force saves for creatures without a stinking_cloud te', async () => {
    seedActiveCombat('Thug 1', 2, [{ name: 'Thug 1' }]);
    seedStore({
      // the te sits on Rug, not on the active creature
      'campaign.targetEffects': [{ target: 'Rug', effect: 'stinking_cloud', source: 'TestWizard', duration: 'concentration', dc: 18 }],
    });

    await expireStaleEffects('test-campaign');

    expect(processStinkingCloudAreaSave).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalledWith('TestWizard', '_stinkingCloud_TestWizard', 'test-campaign');
  });
});
