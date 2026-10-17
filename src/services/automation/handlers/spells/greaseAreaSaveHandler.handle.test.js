// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── PAIR seam map (greaseAreaSaveHandler.js — handle.test.js #1922 + areaSave.test.js #1921) ─
// THIS file (#1922) — handle() ORCHESTRATION (this lane is the tracking WRITER):
//   buildSaveDc inputs, caster map position (loadMapData), cast ability_use log
//   (full-string, own composition), `_grease_<caster>` tracking STORE write
//   (exact key + exact shape incl. radius — mine), addExpiration
//   (remove_grease_area), setCondition modal payload (full-shape — mine).
// SIBLING greaseAreaSaveHandler.areaSave.test.js (#1921) — processGreaseAreaSave
//   content + reader-side tracking guards: do NOT re-pin process* internals here.
// Liveness (verified 2026-10-16, own greps):
//   LIVE: handle() registered index.js:556 — 'grease_area_save' (5e spells.json
//     grease automation[1]). Its setCondition modal is consumed live:
//     useCharActionsAutomation.js:287 modalMap → CharActionModals.jsx renders
//     SetConditionModal.jsx whose props destructure every pinned payload field
//     (combatSummary/attackerName/attackerPos/saveDc/campaignName/mapData/
//     featureName/conditionName/saveType/rangeFeet/durationRounds).
//   ⚠ CRITICAL FLAG (re-verified, documented — do NOT fix here): the tracking
//     store's ONLY reader is processGreaseAreaSave, which has ZERO production
//     callers — expireStaleEffects.js wires sleet (Phase 3), stinking_cloud
//     (SP-111) and web (SP-126) recurring turn-start lanes but NOT grease — and
//     'remove_grease_area' is absent from clearExpirationEffects.js
//     EXPIRATION_HANDLERS; unknown types are silently skipped (:520-524, no
//     console), so the expiration entry drains at rounds:10 with zero grease
//     cleanup. Tracking STORE + addExpiration writes below are PENDING-WIRING
//     (SP-126 web precedent), kept as contract-preservation for when the lane
//     is wired or retired; the modal-payload and log pins above are LIVE.
//   Spell-shape caveat (flagged, not fixed): spells.json automation[1].duration
//     is '1 minute' (space). The handler's parser reads snake_case only
//     ('1_minute' prefix, N_round), so a raw-JSON passthrough yields
//     durationRounds undefined and addExpiration dormant — pinned honestly in
//     the 'raw spell JSON shape' test. snake_case '1_minute' remains the lane
//     fixture convention (cf. index.test.js eyebite/SP-042).
// Notes: rangeValidation + automationImmunities + conditionSaveService/damageRollback
//   graph mocks isolate module-import side effects only — handle() itself calls
//   neither playerIsImmuneToCondition nor isDistanceInRange (those are process-lane).
//   makeAction MERGES automation overrides (never replaces) — fixture convention.

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './greaseAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as mapsService from '../../../maps/mapsService.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';
const TRACKING_KEY = '_grease_TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Intelligence', bonus: 2 }],
    ...overrides,
  };
}

// Merges overrides into the default automation — never replaces it.
function makeAction(automation = {}) {
  return {
    name: 'Grease',
    automation: {
      type: 'grease_area_save',
      saveType: 'DEX',
      conditionInflicted: 'Prone',
      size: '10-foot',
      duration: '1_minute',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

const onMapData = { players: [{ name: casterName, gridX: 5, gridY: 10 }] };

// Exact-key finder — this lane owns the writer; pin the exact key, no fallback.
function greaseStoreCalls() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter((c) => c[1] === TRACKING_KEY);
}

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Deterministic baseline stubs (clearAllMocks keeps implementations — stub fresh).
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(13);
    mapsService.loadMapData.mockResolvedValue(onMapData);
  });

  describe('return value', () => {
    it('returns the full setCondition modal payload and feeds buildSaveDc the automation', async () => {
      const action = makeAction();
      const stats = makePlayerStats();

      const result = await handle(action, stats, campaignName, mapName);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledTimes(1);
      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, stats);
      expect(result).toEqual({
        type: 'modal',
        modalName: 'setCondition',
        payload: {
          combatSummary: baseCombatContext,
          attackerName: casterName,
          attackerPos: { gridX: 5, gridY: 10 },
          saveDc: 13,
          campaignName,
          mapData: onMapData,
          featureName: 'Grease',
          conditionName: 'Prone',
          saveType: 'DEX',
          rangeFeet: 10,
          durationRounds: 10,
        },
      });
    });

    it('includes attackerPos from map data or null when caster not on map', async () => {
      // caster found on map at a different cell than combatSummary
      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: casterName, gridX: 12, gridY: 20 }],
      });
      let result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.attackerPos).toEqual({ gridX: 12, gridY: 20 });

      // caster not on map
      mapsService.loadMapData.mockResolvedValue({ players: [] });
      result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.attackerPos).toBeNull();
    });

    it('includes mapData when mapName provided, null when mapName is null', async () => {
      let result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(result.payload.mapData).toEqual(onMapData);

      mapsService.loadMapData.mockClear();
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.mapData).toBeNull();
    });
  });

  describe('save type and condition defaults', () => {
    it('uses custom saveType from automation, defaults to DEX', async () => {
      savePrompt.buildSaveDc.mockReturnValue(14);

      let result = await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, null);
      expect(result.payload.saveType).toBe('CON');

      result = await handle(makeAction({ saveType: undefined }), makePlayerStats(), campaignName, null);
      expect(result.payload.saveType).toBe('DEX');
    });

    it('uses custom conditionInflicted from automation, defaults to Prone', async () => {
      let result = await handle(makeAction({ conditionInflicted: 'Blinded' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.conditionName).toBe('Blinded');

      result = await handle(makeAction({ conditionInflicted: undefined }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.conditionName).toBe('Prone');
    });
  });

  describe('area radius parsing', () => {
    it('parses size values correctly, defaulting to 10', async () => {
      let result = await handle(makeAction({ size: '10-foot' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(10);

      result = await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(15);

      result = await handle(makeAction({ size: 'invalid' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(10);

      result = await handle(makeAction({ size: undefined }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.rangeFeet).toBe(10);
    });
  });

  describe('duration and expiration', () => {
    it('sets expiration and payload durationRounds for 1_minute (10 rounds)', async () => {
      const result = await handle(makeAction({ duration: '1_minute' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(10);
      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: [{ type: 'remove_grease_area', greaseKey: TRACKING_KEY }], campaignName, rounds: 10 });
    });

    it('sets expiration and payload durationRounds for round-based durations', async () => {
      let result = await handle(makeAction({ duration: '3_rounds' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(3);
      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: [{ type: 'remove_grease_area', greaseKey: TRACKING_KEY }], campaignName, rounds: 3 });

      expirations.addExpiration.mockClear();
      result = await handle(makeAction({ duration: '1_rounds' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(1);

      expirations.addExpiration.mockClear();
      result = await handle(makeAction({ duration: '5_rounds' }), makePlayerStats(), campaignName, mapName);
      expect(result.payload.durationRounds).toBe(5);
      expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
    });

    it('does not set expiration or durationRounds for unrecognized duration values', async () => {
      let result = await handle(makeAction({ duration: 'unknown' }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(result.payload.durationRounds).toBeUndefined();

      result = await handle(makeAction({ duration: '' }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();

      result = await handle(makeAction({ duration: undefined }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('dormant on raw spell JSON shape: "1 minute" (space) parses to no rounds and no expiration', async () => {
      // spells.json automation[1].duration is '1 minute' — the snake_case-only
      // parser yields undefined rounds on raw passthrough. Pin the dormant leg
      // honestly (flagged in header); do not encode as desired end-state.
      const result = await handle(makeAction({ duration: '1 minute' }), makePlayerStats(), campaignName, mapName);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(result.payload.durationRounds).toBeUndefined();
    });
  });

  describe('tracking data storage (PENDING-WIRING — sole reader processGreaseAreaSave has zero production callers)', () => {
    it('stores the exact-key tracking shape once when caster found on map', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const calls = greaseStoreCalls();
      expect(calls).toHaveLength(1);
      const [targetKey, key, data, campaign] = calls[0];
      expect(targetKey).toBe(casterName);
      expect(key).toBe(TRACKING_KEY);
      expect(campaign).toBe(campaignName);

      const { timestamp, ...tracking } = data;
      expect(tracking).toEqual({
        caster: casterName,
        center: { gridX: 5, gridY: 10 },
        mapName,
        campaignName,
        saveDc: 13,
        saveType: 'DEX',
        condition: 'Prone',
        radius: 10,
        duration: '1_minute',
      });
      expect(typeof timestamp).toBe('number');
    });

    it('stores null center and mapName when caster not on map or mapName is null', async () => {
      // caster not found on map
      mapsService.loadMapData.mockResolvedValue({ players: [] });
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);
      expect(greaseStoreCalls()[0][2].center).toBeNull();
      expect(greaseStoreCalls()[0][2].mapName).toBe(mapName);

      // mapName is null
      useRuntimeState.setRuntimeValue.mockClear();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(greaseStoreCalls()[0][2].center).toBeNull();
      expect(greaseStoreCalls()[0][2].mapName).toBeNull();
    });

    it('stores custom values from automation in tracking data', async () => {
      await handle(makeAction({ duration: '3_rounds' }), makePlayerStats(), campaignName, null);
      expect(greaseStoreCalls()[0][2].duration).toBe('3_rounds');

      useRuntimeState.setRuntimeValue.mockClear();
      await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);
      expect(greaseStoreCalls()[0][2].radius).toBe(15);

      useRuntimeState.setRuntimeValue.mockClear();
      await handle(makeAction({ conditionInflicted: 'Blinded' }), makePlayerStats(), campaignName, mapName);
      expect(greaseStoreCalls()[0][2].condition).toBe('Blinded');

      useRuntimeState.setRuntimeValue.mockClear();
      savePrompt.buildSaveDc.mockReturnValue(14);
      await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);
      expect(greaseStoreCalls()[0][2].saveType).toBe('CON');
      expect(greaseStoreCalls()[0][2].saveDc).toBe(14);
    });
  });

  describe('map handling', () => {
    it('does not load map data when mapName is null', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('handles map load failure gracefully', async () => {
      mapsService.loadMapData.mockRejectedValueOnce(new Error('not found'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'bad-map');

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('setCondition');
      expect(result.payload.attackerPos).toBeNull();
      expect(result.payload.mapData).toBeNull();
      // cast still recorded — the tracking write and modal survive the map failure
      expect(greaseStoreCalls()[0][2].center).toBeNull();
    });
  });

  describe('log entries', () => {
    it('calls addEntry with ability_use type and the exact composed description', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Grease',
        description: 'Grease activated — DEX save DC 13, 10ft square area.',
      });
    });

    it('composes the parsed radius into the log description', async () => {
      await handle(makeAction({ size: '15-foot' }), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: 'Grease activated — DEX save DC 13, 15ft square area.',
      }));
    });

    it('still completes the cast when the log write rejects', async () => {
      logService.addEntry.mockRejectedValueOnce(new Error('log down'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.modalName).toBe('setCondition');
      expect(greaseStoreCalls()).toHaveLength(1);
    });
  });
});
