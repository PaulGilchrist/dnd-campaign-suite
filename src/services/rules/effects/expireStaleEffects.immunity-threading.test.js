// @maintained-by-ai
// Lane: END-TO-END zone-save immunity threading (Option A landing,
// bug-zone-save-computedstats-bucket-has-no-producer, 2026-11-23). This file
// runs the REAL expireStaleEffects sweep over the REAL zone handlers with the
// REAL playerIsImmuneToCondition rule (automationImmunities is NEVER mocked
// here) — the only mocked leaves are the runtime store, combat data, log,
// save-prompt listener and the handlers' write-side helpers. Together with
// the per-file dispatch-arg pins (expireStaleEffects.test.js / .web / .grease
// / expirations twin) this proves the full production chain the ticket was
// filed for: characters array threaded into the sweep → per-target
// `computedStats || character` resolution → the immunity gate consumes it →
// a rules-derived immune PC is silently skipped at the real turn seam while a
// non-immune control still arms. The pre-fix face (bucket read, zero producer
// → immune PCs prompted and conditioned) is defect-incompatible below: zero
// save-prompt calls, zero log rows and zero writes for the immune carrier.
// Owner header notes kept once, here: the runtime `computedStats` bucket has
// NO producer and the four handlers' bucket reads are DELETED — a re-
// introduced read would leave this test green only by ALSO re-adding the
// bucket seed, which the roster-param contract below forbids.
// Sibling pins (cited, not duplicated): handler-level gate consumption of the
// targetStats param lives in {grease,sleet,web,stinking}AreaSave/.areaSave
// .test.js immunity trios; caller threading in navigationHandlers.test.jsx /
// sseHandlers.zone-expiry-dedupe.test.jsx.
// No timers: zero setTimeout/setInterval/Date.now in this lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { getName: vi.fn((v) => String(v)) },
}));

vi.mock('../../ui/storage.js', () => ({
  default: { set: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

// Phase 1/2 queue legs are owned by the maturity-sweep lanes; pinning the
// immunity chain does not need the clear side (mocking it also keeps the
// clearExpirationEffects import graph out of this file).
vi.mock('./expirationQueue.js', () => ({
  expireForCreature: vi.fn(),
  expireForTarget: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(() => 14),
  createSaveListener: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

// Handler import-side-effect isolation only (the recurring lanes never call
// these write helpers on the SUCCESS arm this test drives).
vi.mock('../expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../automation/handlers/spells/areaSpellUtils.js', () => ({
  spellNoticePopup: vi.fn((name, description) => ({ type: 'popup', payload: { name, description } })),
  resolveSelectedSpellTargets: vi.fn(() => []),
  registerSpellConcentration: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
}));

// NOTE: automationImmunities.js is deliberately NOT mocked — the whole point
// of this lane is the REAL rule consuming the threaded stats.

// ── Imports (real sweep + real handlers) ───────────────────────

import { expireStaleEffects } from './expireStaleEffects.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'Caster';
const IMMUNE = 'ImmuneHero';
const CONTROL = 'ControlBrute';

const ROSTER = [
  { name: CASTER, computedStats: { name: CASTER, immunities: [] } },
  // rules-derived immunity flowing through computedStats (the same shape
  // App.jsx getPlayerStats produces for the live FixtureLandDruid fixture)
  { name: IMMUNE, computedStats: { name: IMMUNE, immunities: ['prone'] } },
  // control: same call shape, NO immunity
  { name: CONTROL, computedStats: { name: CONTROL, immunities: [] } },
];

function seedStore(values) {
  getRuntimeValue.mockImplementation((name, prop) => {
    const key = `${name}.${prop}`;
    return key in values ? values[key] : null;
  });
}

describe('expireStaleEffects — end-to-end zone-save immunity threading (real handlers + real rule)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllStoreKeys.mockReturnValue([]);
    getCurrentCombatRound.mockReturnValue(3);
    getActiveCreatureName.mockReturnValue(CASTER);
    getCombatSummary.mockReturnValue({ creatures: [{ name: CASTER }] });
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: CASTER, type: 'player' },
        { name: IMMUNE, type: 'player' },
        { name: CONTROL, type: 'player' },
      ],
    });
    createSaveListener.mockReturnValue({
      promptId: 'threaded-control',
      promise: Promise.resolve({ success: true, roll: 20, total: 20 }),
    });
  });

  it('sweep over a roster with a rules-immune player: immune carrier arms NOTHING, non-immune control arms the save', async () => {
    // Sleet Storm Phase 3 is target-side enumeration (one sweep processes BOTH
    // carriers), which makes it the tightest one-call discriminator between
    // the immune skip and the armed control.
    seedStore({
      [`${CASTER}._sleetStorm_${CASTER}`]: { saveDc: 14, mapName: 'Cave' },
      'campaign.targetEffects': [
        { effect: 'sleet_storm', source: CASTER, target: IMMUNE },
        { effect: 'sleet_storm', source: CASTER, target: CONTROL },
      ],
      [`${IMMUNE}.activeConditions`]: [],
      [`${CONTROL}.activeConditions`]: [],
    });

    await expireStaleEffects(CAMPAIGN, CASTER, ROSTER);

    // EXACTLY one arm — the non-immune control. The immune PC (prone immunity
    // riding the threaded computedStats) must be silently skipped.
    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ targetName: CONTROL, saveDc: 14 }));
    expect(createSaveListener.mock.calls.every(([, opts]) => opts.targetName !== IMMUNE)).toBe(true);

    // zero log rows mention the immune carrier (no ability_use prompt row,
    // no save_result adjudication row) — while the control pair lands.
    expect(addEntry.mock.calls.every(([, entry]) => !JSON.stringify(entry).includes(IMMUNE))).toBe(true);
    const descriptions = addEntry.mock.calls.map(([, entry]) => entry.description || '');
    expect(descriptions.some(d => d.includes(CONTROL))).toBe(true);

    // zero runtime writes for the immune carrier (no condition, no
    // concentration tracking, no rollback ledger).
    expect(setRuntimeValue.mock.calls.every(([name]) => name !== IMMUNE)).toBe(true);

    // the bucket is NEVER consulted for stats (one canonical shape — the
    // deleted bucket read may not return).
    expect(getRuntimeValue.mock.calls.every(([, key]) => key !== 'computedStats')).toBe(true);
  });

  it('the same sweep WITHOUT a roster still arms the control (roster-miss is not a skip)', async () => {
    seedStore({
      [`${CASTER}._sleetStorm_${CASTER}`]: { saveDc: 14, mapName: 'Cave' },
      'campaign.targetEffects': [{ effect: 'sleet_storm', source: CASTER, target: CONTROL }],
      [`${CONTROL}.activeConditions`]: [],
    });

    await expireStaleEffects(CAMPAIGN, CASTER);

    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ targetName: CONTROL }));
  });
});
