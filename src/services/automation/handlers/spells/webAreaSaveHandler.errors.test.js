// ── webAreaSave QUINTET lane #1991 .errors ─────────────────────────────────
// (full seam map: webAreaSaveHandler.areaSave.test.js header; guards lane
// #1990 .edgeCases pins ZERO console.error by design — this file is the only
// webAreaSave lane with console.error pins)
// THIS lane: EVERY addEntry-rejection catch site reachable from handle() —
// the [web]-prefixed leg of the cast lane. Prefix discrimination verified at
// source (grep):
//   [web] Error:          :227 ability_use (handle loop)          → THIS file
//   [web] Error:           :51 save_result success (saveSuccess)  → THIS file
//   [web] Error:          :130 condition (restrainWebTarget)      → THIS file
//   [web] Error:          :141 save_result failure (restrainWeb…) → THIS file
//   [webAreaSave] Error:  :286/:307/:346 — processWebAreaSave recurring lane
//                          (.areaSave owns; UNREACHABLE from handle() — every
//                          test here cross-pins it NEVER fires)
//   [webAreaSaveHandler] :187 registry-missing guard — .zone lane (#1993);
//                          'web' IS present in targetEffectDefinitions.js:1180
//                          so this site is unreachable — no test written.
//   console.warn :324    — recurring lane (.areaSave), not console.error.
// All four [web] sites compose the identical literal "[web] Error:" + err, so
// site discrimination is by addEntry rejection ORDINAL + exact Error identity +
// exact console.error call count + state-write-survival pins (anti-slop: no
// expect.any(Error), no blanket resolves.toBeDefined — each site pinned by the
// unique rejection it swallows and the writes that must still land around it).
// addEntry ordinals, single target (deterministic):
//   save FAILS: #1 ability_use :227 → #2 condition :130 → #3 save_result-fail :141
//   save SUCCEEDS: #1 ability_use :227 → #2 save_result-success :51 (terminal)
// Owns nothing else: recurring re-forces (.areaSave), zone/_web_<caster>
// persistence + 600-round merged expiration (#1993), orchestration happy paths
// and guard shapes (#1992/#1990). Rejected logs do NOT advance game state —
// catches only console.error (no timers anywhere; save resolves via the
// captured createSaveListener promise, never a setTimeout).
// Liveness: handle() is dispatched — automation/index.js:271 import, :557
//   'web_area_save' slot (grep-verified 2026-10-16, pinned by
//   index.webDispatch.test.js).
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

function castAtGoblin() {
  return handle(
    { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
    makePlayerStats(),
    campaignName,
    null,
  );
}

// Stub the captured save prompt (no timers — promise captured up front).
function stubSave({ success, roll }) {
  savePrompt.createSaveListener.mockReturnValue({
    promptId: `web-save-${success ? 'ok' : 'fail'}`,
    promise: Promise.resolve({ success, roll, total: roll }),
  });
}

// Lane-exclusive prefix containment: cast-lane catches emit ONLY
// "[web] Error:" — never the recurring lane's "[webAreaSave] Error:".
function expectWebOnlyErrors(consoleSpy) {
  expect(consoleSpy.mock.calls.every(([msg]) => msg === '[web] Error:')).toBe(true);
  expect(consoleSpy).not.toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', type: 'player' },
  ],
};

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle - error handling', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    // null covers every `|| []` / `|| {}` fallback in the cast lane.
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(15);
    combatData.getCombatSummary.mockReturnValue({});
    logService.addEntry.mockResolvedValue({});
    consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ability_use rejection (ordinal #1, :227): pins [web] + err identity, cast still restrains and logs on', async () => {
    const errAbilityUse = new Error('ability_use log down');
    stubSave({ success: false, roll: 5 });
    logService.addEntry.mockRejectedValueOnce(errAbilityUse); // #1 ability_use; #2/#3 default-resolve

    const result = await castAtGoblin();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', errAbilityUse);
    expectWebOnlyErrors(consoleSpy);

    // State-write survival: the rejected cast banner must not stop restraint.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['restrained'], campaignName,
    );
    expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
      campaignName,
      { targetName: 'Goblin', saveResult: 'failure', roll: 5, total: 5, conditions: ['restrained'], appliedDamage: 0 },
    );
    // Downstream logs (#2 condition, #3 save_result-fail) still attempted.
    expect(logService.addEntry).toHaveBeenCalledTimes(3);
    expect(logService.addEntry.mock.calls[1][1].type).toBe('condition');
    expect(logService.addEntry.mock.calls[2][1].type).toBe('save_result');
    expect(result.type).toBe('popup');
  });

  it('save_result success rejection (ordinal #2 on save path, :51): terminal catch, success ledger already landed', async () => {
    const errSaveOkLog = new Error('save_result success log down');
    stubSave({ success: true, roll: 14 });
    logService.addEntry
      .mockResolvedValueOnce({}) // #1 ability_use
      .mockRejectedValueOnce(errSaveOkLog); // #2 save_result success (last op in saveSuccess)

    const result = await castAtGoblin();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', errSaveOkLog);
    expectWebOnlyErrors(consoleSpy);

    // Success ledger is awaited BEFORE the rejected log — must be exact.
    expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
      campaignName,
      { targetName: 'Goblin', saveResult: 'success', roll: 14, total: 14, conditions: [], appliedDamage: 0 },
    );
    // Nothing follows the catch on this path: exactly the two cast-lane logs.
    expect(logService.addEntry).toHaveBeenCalledTimes(2);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Goblin', 'activeConditions', expect.anything(), campaignName,
    );
    expect(result.type).toBe('popup');
  });

  it('condition log rejection (ordinal #2, :130): restrained state survives, save_result-fail log still fires', async () => {
    const errConditionLog = new Error('condition log down');
    stubSave({ success: false, roll: 5 });
    logService.addEntry
      .mockResolvedValueOnce({}) // #1 ability_use
      .mockRejectedValueOnce(errConditionLog); // #2 condition; #3 default-resolves

    const result = await castAtGoblin();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', errConditionLog);
    expectWebOnlyErrors(consoleSpy);

    // Condition + recurring-save metadata landed before the rejected log row.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['restrained'], campaignName,
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditionMeta', { restrained: { dc: 15, ability: 'str' } }, campaignName,
    );
    // Ordinal #3 save_result-fail log still attempted after the swallow.
    expect(logService.addEntry).toHaveBeenCalledTimes(3);
    expect(logService.addEntry.mock.calls[2][1].type).toBe('save_result');
    expect(logService.addEntry.mock.calls[2][1].success).toBe(false);
    expect(result.type).toBe('popup');
  });

  it('save_result failure rejection (ordinal #3, :141): terminal swallow, full restraint ledger intact', async () => {
    const errSaveFailLog = new Error('save_result failure log down');
    stubSave({ success: false, roll: 5 });
    logService.addEntry
      .mockResolvedValueOnce({}) // #1 ability_use
      .mockResolvedValueOnce({}) // #2 condition
      .mockRejectedValueOnce(errSaveFailLog); // #3 save_result failure

    const result = await castAtGoblin();

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', errSaveFailLog);
    expectWebOnlyErrors(consoleSpy);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin', 'activeConditions', ['restrained'], campaignName,
    );
    expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
      campaignName,
      { targetName: 'Goblin', saveResult: 'failure', roll: 5, total: 5, conditions: ['restrained'], appliedDamage: 0 },
    );
    expect(result.type).toBe('popup');
  });

  it('all three fail-path logs reject: exactly three [web] pins in ordinal order, popup still resolves', async () => {
    const err1 = new Error('ordinal1 ability_use down');
    const err2 = new Error('ordinal2 condition down');
    const err3 = new Error('ordinal3 save_result-fail down');
    stubSave({ success: false, roll: 5 });
    logService.addEntry
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2)
      .mockRejectedValueOnce(err3);

    const result = await castAtGoblin();

    expect(logService.addEntry).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, '[web] Error:', err1);
    expect(consoleSpy).toHaveBeenNthCalledWith(2, '[web] Error:', err2);
    expect(consoleSpy).toHaveBeenNthCalledWith(3, '[web] Error:', err3);
    expectWebOnlyErrors(consoleSpy);
    expect(result.type).toBe('popup');
  });
});
