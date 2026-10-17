// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── PAIR seam map (stinkingCloudHandler.js — this file + stinkingCloudHandler.test.js) ─
// THIS file (#1973) — SP-111 RECURRING area-save CONTENT (processStinkingCloudAreaSave +
//   applyStinkingCloudTurnEnd): exact-key `_stinkingCloud_<caster>` tracking guards,
//   caster-anchored isWithinRange gating (gridless fallback), poison-immunity skip gates
//   (monster immunities + player Poisoned-condition immunity), turn-start CON save via
//   createSaveListener, Poisoned apply/refresh with activeConditionMeta dc/ability/source,
//   block-te registerTargetEffect write (real registry fn → setRuntimeValue 5th arg
//   skipSync=true) + dedupe, rollback ledger (addTargetResult, appliedDamage 0 — this
//   spell deals NO damage, condition + action block only), rollback-free save logs, popup
//   prose (full-string own-composition pins), and the turn-end shed lane ("until the end
//   of the current turn"): sheds only when the creature carries a live stinking_cloud zone
//   te (manual poison never auto-shed), idempotent no-side-effect guards.
// SIBLING stinkingCloudHandler.test.js (#1974 main) — cast-time handle() orchestration:
//   buildSaveDc, combat-context gate, target selection, per-target cast saves (incl.
//   disadvantage on heightenTarget), cast-time Poisoned/meta/targetEffects marker writes,
//   concentration registration, immunity counting, popup tallies, [stinkingCloud] catch
//   chains.
// INHERITED BY #1974 (SP-111 cast-time wires, trimmed out of this file 2026-10-16 per
//   lane split — add there, never re-add here): exact pins for the `_stinkingCloud_<caster>`
//   tracking STORE (saveDc/saveType CON/radius 20/mapName), the zone expiration
//   addExpiration({ rounds: 10, effects: [clear_runtime_value(trackingKey),
//   remove_target_effect stinking_cloud, remove_target_effect no_action_and_bonus_action] })
//   (CLA-334 minutes→rounds ×10 encoding of 'Concentration, up to 1 minute', matured by
//   zoneDurationClock at initiative seams — round counter, never a wall-clock timer), and
//   the cast-time block-te write (skipSync=true) on a failed cast save. Sibling currently
//   pins addExpiration times(2) (:311) and the stinking_cloud marker content (:328) but
//   NOT these three exact-content pins.
// Liveness (verified 2026-10-16): SP-111 expiration WIRED — expireStaleEffects.js:106
//   Phase 4 processZoneTurnStartSaves(effectKey 'stinking_cloud', trackingPrefix
//   'stinkingCloud') consumes caster zone tracking and calls
//   processStinkingCloudAreaSave(te.source, activeName, campaignName, zoneTracking.mapName);
//   in-area enumeration is consumer-side (te.target === active creature), geometry detail
//   lives behind isWithinRange here. Consumer-side routing pinned in
//   expireStaleEffects.test.js:344-386. applyStinkingCloudTurnEnd LIVE at
//   navigationHandlers.js:191 (own-turn-end seam); handle() LIVE via automation
//   index.js:584 'stinking_cloud' dispatch. Contrast: grease processGreaseAreaSave has
//   ZERO production callers (pending-wiring, flagged in its closed pair); sleet Phase 3
//   and web Phase 5 share this wired pattern (sleet quartet closed 28/24/11/10).
// PROD DEFECT grep (sleetStorm un-awaited getCombatContext :286 contrast): CLEAN — both
//   getCombatContext sites in this handler are awaited (:111 area save, :254 handle).
// Lane notes: createSaveListener opts here OMIT the `disadvantage` key (cast-time handle()
//   includes it) — exact-object pins keep the lanes distinguishable. Movement-exit
//   semantics: outside the caster-anchored 20ft sphere → null, save re-forced next turn
//   start by the consumer. Turn-based only: no timers in this file, none in the handler
//   lane (duration = rounds at initiative seams).
// Mock rationale: targetEffectDefinitions is REAL (unmocked) — registerTargetEffect writes
//   the block te through the mocked runtime store. areaSpellUtils is REAL (spellNoticePopup
//   composes the popups); its own imports (concentrationService / combatData / storage) are
//   mocked only to isolate module-import side effects of the handler graph. damageRollback
//   mock: addTargetResult is awaited in this lane; storeSpellLastAttack is handle()-side only.
// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// Import-side-effect isolation only — neither recurring export calls addExpiration
// (cast-time wires owned by sibling #1974).
vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn().mockReturnValue(false),
}));

// Import-side-effect isolation only (real areaSpellUtils imports these).
vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
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

import { processStinkingCloudAreaSave, applyStinkingCloudTurnEnd } from './stinkingCloudHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Constants & helpers ────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const casterName = 'TestWizard';
const trackingKey = `_stinkingCloud_${casterName}`;

const baseTracking = {
  caster: casterName,
  mapName,
  campaignName,
  saveDc: 18,
  saveType: 'CON',
  radius: 20,
  timestamp: 123,
  duration: 'Concentration, up to 1 minute',
};

// Simple in-memory store for the mocked runtime service.
function createStore(initial = {}) {
  const store = { ...initial };
  const getRuntimeValue = vi.fn((key, field) => {
    const v = store[`${key}.${field}`];
    return v === undefined ? null : v;
  });
  const setRuntimeValue = vi.fn((key, field, value) => {
    store[`${key}.${field}`] = value;
  });
  return { store, getRuntimeValue, setRuntimeValue };
}

function installStore(store) {
  useRuntimeState.getRuntimeValue.mockImplementation(store.getRuntimeValue);
  useRuntimeState.setRuntimeValue.mockImplementation(store.setRuntimeValue);
}

const zoneTe = { target: 'Thug 1', effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 };
const blockTe = { target: 'Thug 1', effect: 'no_action_and_bonus_action', source: casterName, duration: 'until_end_of_current_turn' };

// ── processStinkingCloudAreaSave: recurring turn-start CON save ───
// Consumed live by expireStaleEffects Phase 4 (SP-111) at each zone-te-carrying
// creature's TURN START. Zero damage — Poisoned + block te only.

describe('stinkingCloudHandler.processStinkingCloudAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue({});
    rangeCheck.isWithinRange.mockResolvedValue(true);
    automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
  });

  it('returns null when zone tracking is missing or lacks saveDc', async () => {
    const noTracking = createStore();
    installStore(noTracking);
    expect(await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName)).toBeNull();

    const noDc = createStore({ [`${casterName}.${trackingKey}`]: { caster: casterName } });
    installStore(noDc);
    expect(await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName)).toBeNull();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  it('returns null when a positioned target is outside the 20ft sphere (movement-exit; re-forced next turn start)', async () => {
    const store = createStore({ [`${casterName}.${trackingKey}`]: baseTracking });
    installStore(store);
    rangeCheck.isWithinRange.mockResolvedValue(false);

    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);

    expect(result).toBeNull();
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, 'Thug 1', 20);
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  it('auto-skips the save for poison-immune creatures', async () => {
    const store = createStore({ [`${casterName}.${trackingKey}`]: baseTracking });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Thug 1', type: 'monster', weaknessesAndResistivities: { immunities: ['Poison'] } }],
    });

    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);

    expect(result).toBeNull();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  it('skips the save for players immune to the Poisoned condition', async () => {
    const store = createStore({ [`${casterName}.${trackingKey}`]: baseTracking });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Hero', type: 'player' }],
    });
    automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);

    const result = await processStinkingCloudAreaSave(casterName, 'Hero', campaignName, mapName);

    expect(result).toBeNull();
    expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith(
      expect.objectContaining({ conditionKey: 'poisoned' }),
    );
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  it('forces a CON save at turn start and applies Poisoned + block te on failure', async () => {
    const store = createStore({
      [`${casterName}.${trackingKey}`]: baseTracking,
      'campaign.targetEffects': [zoneTe],
      'Thug 1.activeConditions': [],
      'Thug 1.activeConditionMeta': {},
    });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1', type: 'monster' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p-turn',
      promise: Promise.resolve({ success: false, roll: 2, total: 4 }),
    });

    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);

    // Lane-distinct opts: NO `disadvantage` key (cast-time handle() adds it).
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Thug 1',
      saveType: 'CON',
      saveDc: 18,
      dcSuccess: 'none',
    });
    expect(store.store['Thug 1.activeConditions']).toEqual(['poisoned']);
    expect(store.store['Thug 1.activeConditionMeta'].poisoned).toEqual(
      expect.objectContaining({ dc: 18, ability: 'con', source: 'stinking_cloud' }),
    );
    // No damage — condition + action block only.
    expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Thug 1',
      saveResult: 'failure',
      conditions: ['poisoned'],
      appliedDamage: 0,
    }));
    // Block te via REAL registerTargetEffect → setRuntimeValue(..., campaignName, skipSync=true).
    expect(store.store['campaign.targetEffects']).toEqual(expect.arrayContaining([
      expect.objectContaining(blockTe),
    ]));
    // Full-string own-composition popup pin.
    expect(result.payload.description).toBe(
      'Thug 1 failed the CON save (DC 18) at turn start. Poisoned until the end of the current turn — can\'t take an Action or Bonus Action.',
    );
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'save_result',
      rollType: 'save-stinking-cloud',
      success: false,
      saveDc: 18,
      targetName: 'Thug 1',
    }));
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'applied',
      characterName: 'Thug 1',
      condition: 'Poisoned',
    }));
  });

  it('refreshes Poisoned and keeps a single block te when already poisoned', async () => {
    const store = createStore({
      [`${casterName}.${trackingKey}`]: baseTracking,
      'campaign.targetEffects': [zoneTe, blockTe],
      'Thug 1.activeConditions': ['poisoned'],
      'Thug 1.activeConditionMeta': { poisoned: { dc: 18, ability: 'con' } },
    });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1', type: 'monster' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p-turn',
      promise: Promise.resolve({ success: false, roll: 2, total: 4 }),
    });

    await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);

    expect(store.store['Thug 1.activeConditions']).toEqual(['poisoned']);
    const blockCount = store.store['campaign.targetEffects'].filter(te => te.effect === 'no_action_and_bonus_action').length;
    expect(blockCount).toBe(1);
  });

  it('sheds Poisoned + block te on a successful turn-start save', async () => {
    const store = createStore({
      [`${casterName}.${trackingKey}`]: baseTracking,
      'campaign.targetEffects': [zoneTe, blockTe],
      'Thug 1.activeConditions': ['poisoned'],
    });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1', type: 'monster' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p-turn',
      promise: Promise.resolve({ success: true, roll: 19, total: 21 }),
    });

    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);

    expect(store.store['Thug 1.activeConditions']).toEqual([]);
    expect(store.store['campaign.targetEffects'].some(te => te.effect === 'no_action_and_bonus_action')).toBe(false);
    // Zone marker survives a successful save (cloud persists with concentration).
    expect(store.store['campaign.targetEffects'].some(te => te.effect === 'stinking_cloud')).toBe(true);
    expect(result.payload.description).toBe(
      'Thug 1 succeeded the CON save (DC 18) at turn start. Unaffected.',
    );
    // Turn-start reason distinguishes this shed from the turn-end shed lane below.
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Thug 1',
      condition: 'Poisoned',
      reason: 'Stinking Cloud (turn-start save succeeded)',
    }));
  });

  it('proceeds with the save when map data is unavailable (gridless)', async () => {
    const store = createStore({
      [`${casterName}.${trackingKey}`]: { ...baseTracking, mapName: null },
      'Thug 1.activeConditions': [],
      'Thug 1.activeConditionMeta': {},
    });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1', type: 'monster' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p-turn',
      promise: Promise.resolve({ success: true, roll: 19, total: 21 }),
    });

    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, null);

    expect(savePrompt.createSaveListener).toHaveBeenCalled();
    expect(result.payload.name).toBe('Stinking Cloud');
  });

  it('resilient to log failure: ability_use addEntry rejection still completes the save', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore({
      [`${casterName}.${trackingKey}`]: baseTracking,
      'campaign.targetEffects': [zoneTe],
      'Thug 1.activeConditions': [],
    });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1', type: 'monster' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p-turn',
      promise: Promise.resolve({ success: true, roll: 19, total: 21 }),
    });
    // First addEntry call is the turn-start ability_use prompt log.
    logService.addEntry.mockRejectedValueOnce(new Error('log error'));

    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);

    expect(savePrompt.createSaveListener).toHaveBeenCalled();
    expect(result.payload.name).toBe('Stinking Cloud');
    expect(console.error).toHaveBeenCalledWith('[stinkingCloudAreaSave] Error:', expect.any(Error));
    spy.mockRestore();
  });
});

// ── applyStinkingCloudTurnEnd: "until the end of the current turn" ───
// LIVE seam at navigationHandlers.js:191 (end of the affected creature's own turn).

describe('stinkingCloudHandler.applyStinkingCloudTurnEnd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue({});
  });

  it('does nothing when the creature has no stinking_cloud zone te', async () => {
    const store = createStore({
      'campaign.targetEffects': [],
      'Thug 1.activeConditions': ['poisoned'],
    });
    installStore(store);

    await applyStinkingCloudTurnEnd(campaignName, 'Thug 1');

    // Manual poison without the cloud marker must never auto-shed.
    expect(store.store['Thug 1.activeConditions']).toEqual(['poisoned']);
    expect(store.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears Poisoned + block te at end of turn and logs the removal', async () => {
    const store = createStore({
      'campaign.targetEffects': [zoneTe, blockTe],
      'Thug 1.activeConditions': ['poisoned'],
    });
    installStore(store);

    await applyStinkingCloudTurnEnd(campaignName, 'Thug 1');

    expect(store.store['Thug 1.activeConditions']).toEqual([]);
    expect(store.store['campaign.targetEffects'].some(te => te.effect === 'no_action_and_bonus_action')).toBe(false);
    // Zone marker survives — the cloud persists for future turn starts.
    expect(store.store['campaign.targetEffects'].some(te => te.effect === 'stinking_cloud')).toBe(true);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      action: 'removed',
      characterName: 'Thug 1',
      condition: 'Poisoned',
      reason: 'Stinking Cloud (end of current turn)',
    }));
  });

  it('is idempotent: a second pass with cleared state writes nothing new', async () => {
    const store = createStore({
      'campaign.targetEffects': [zoneTe],
      'Thug 1.activeConditions': [],
    });
    installStore(store);

    await applyStinkingCloudTurnEnd(campaignName, 'Thug 1');

    expect(store.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('resilient to log failure: rejected removal log still clears state and logs the error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore({
      'campaign.targetEffects': [zoneTe, blockTe],
      'Thug 1.activeConditions': ['poisoned'],
    });
    installStore(store);
    // The turn-end shed makes exactly one addEntry call — deterministic rejection.
    logService.addEntry.mockRejectedValueOnce(new Error('log error'));

    await applyStinkingCloudTurnEnd(campaignName, 'Thug 1');

    expect(store.store['Thug 1.activeConditions']).toEqual([]);
    expect(store.store['campaign.targetEffects'].some(te => te.effect === 'no_action_and_bonus_action')).toBe(false);
    expect(console.error).toHaveBeenCalledWith('[stinkingCloudTurnEnd] Error:', expect.any(Error));
    spy.mockRestore();
  });
});
