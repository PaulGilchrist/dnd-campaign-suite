// @maintained-by-ai
//
// CHECK lane: pins ONLY the pre-prompt gate of checkRelentlessRage() — the
// zero-HP interceptor predicate (relentlessRageService.js:52) invoked by
// applyDamage.js ZERO_HP_INTERCEPTORS at ordinal 4 (applyDamage.js:599,
// chain orchestration owned by the applyDamage lane). The predicate decides
// whether a raging Barbarian at 0 HP gets a CON save (canon: 2024 Barbarian
// lv11 'Relentless Rage' — success heals 2 * barbarian_level), requests the
// save prompt, and returns {intercepted}/{awaitingSave} bytes.
//
// LATCH PAIR: this predicate is the READER of 'relentlessrageUses'
// (DC = saveDc + uses * dcScaling); the WRITER (increment after save
// resolution, consume-even-on-fail) is pinned by the saveResults lane
// (relentlessRageService.saveResults.test.js 'increments uses after save').
// Refuse-vs-consume: a refused check performs zero writes — pinned here.
// Rest-seam reset of the uses latch is owned by the rest lanes (no clock
// here; uses latch is disk-canon recharge 'short_or_long_rest').
//
// Save-result resolution, death-save slot machine, heal-expression
// evaluation, and addEntry-rejection resilience belong to the sibling
// deathSaves / saveResults / errors / helpers lanes — not duplicated here.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'test-guid-123') },
}));

// ── Imports ────────────────────────────────────────────────────

import { checkRelentlessRage } from './relentlessRageService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import classes2024 from '../../../../public/data/2024/classes.json';
import classes5e from '../../../../public/data/classes.json';

const campaignName = 'test-campaign';
const CREATURE = { name: 'TestBarbarian', currentHp: 0 };

// Disk-canon automation row (verified programmatically below against both
// /data/classes.json and /data/2024/classes.json, Barbarian level 11).
const CANON_AUTOMATION = {
  type: 'reaction_save_heal',
  saveType: 'CON',
  saveDc: 10,
  dcScaling: 5,
  healExpression: '2 * barbarian_level',
};

function makePlayerComputed(automation = CANON_AUTOMATION) {
  // allFeatures is the ONLY shape the check lane reads; level/class belong
  // to save-result heal evaluation (helpers/saveResults lanes).
  return { name: 'TestBarbarian', allFeatures: [{ name: 'Relentless Rage', automation }] };
}

// Strict argument-keyed store fake: throws on any key the predicate must
// never read (retired keys such as 'ragePoints' die here).
function seedRuntime({ activeBuffs, uses }) {
  runtimeState.getRuntimeValue.mockImplementation((characterKey, key) => {
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'relentlessrageUses') return uses;
    throw new Error(`unexpected getRuntimeValue("${characterKey}", "${key}")`);
  });
}

function reseed(automation, { activeBuffs = [{ name: 'Rage' }], uses = 0 } = {}) {
  runtimeState.getRuntimeValue.mockReset();
  runtimeState.setRuntimeValue.mockReset();
  logService.addEntry.mockReset();
  createSaveListener.mockReset();
  createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
  logService.addEntry.mockResolvedValue({});
  seedRuntime({ activeBuffs, uses });
  return makePlayerComputed(automation ?? CANON_AUTOMATION);
}

function expectRefused(result) {
  expect(result).toEqual({ intercepted: false });
  expect(createSaveListener).not.toHaveBeenCalled();
  expect(logService.addEntry).not.toHaveBeenCalled();
  expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
}

// ── Tests ──────────────────────────────────────────────────────

describe('relentlessRageService.checkRelentlessRage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
    logService.addEntry.mockResolvedValue({});
  });

  it('refuses malformed feature input with exactly {intercepted:false} and zero runtime reads', () => {
    const computedRows = [
      undefined,
      {},
      { allFeatures: null },
      { allFeatures: 'invalid' },
      { allFeatures: [] },
      { allFeatures: [{}] },
      { allFeatures: [{ name: 'Relentless Rage' }] },
      { allFeatures: [{ name: 'Relentless Rage', automation: null }] },
      // null entries are deref-guarded (feature?.name); lookalike name must
      // NOT match (kills contains-style name mutations).
      { allFeatures: [{ name: 'Rage' }, null, { name: 'Relentless Fury' }] },
    ];
    for (const computed of computedRows) {
      reseed(CANON_AUTOMATION);
      const result = checkRelentlessRage(CREATURE, computed, campaignName);
      expectRefused(result);
      expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
    }
  });

  it('gates on an exact "Rage" activeBuffs entry and consumes nothing when refused', () => {
    const refuseRows = [
      [],
      null,
      [{ name: 'Endless Rage' }], // substring bait — name equality is exact
      [{ name: 'rage' }], // case bait
    ];
    for (const activeBuffs of refuseRows) {
      reseed(CANON_AUTOMATION, { activeBuffs });
      const result = checkRelentlessRage(CREATURE, makePlayerComputed(), campaignName);
      expectRefused(result);
      // Reads activeBuffs once but never the uses latch: a refusal
      // neither escalates nor consumes.
      expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
        ['TestBarbarian', 'activeBuffs', campaignName],
      ]);
    }
    // Contrast: exact 'Rage' entry passes the same gate.
    reseed(CANON_AUTOMATION);
    expect(checkRelentlessRage(CREATURE, makePlayerComputed(), campaignName)).toEqual({
      intercepted: true,
      awaitingSave: true,
    });
  });

  it('intercepts canonical drop-to-0 with the full prompt contract, reader-only latch', () => {
    reseed(CANON_AUTOMATION);
    const result = checkRelentlessRage(CREATURE, makePlayerComputed(), campaignName);

    expect(result).toEqual({ intercepted: true, awaitingSave: true });
    // Full read-set, exact order and arity: getRuntimeValue takes exactly
    // two parameters, so the trailing campaignName on the activeBuffs read
    // is inert and the bare uses read is not a defect.
    expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
      ['TestBarbarian', 'activeBuffs', campaignName],
      ['TestBarbarian', 'relentlessrageUses'],
    ]);
    // Reader-only contract: the predicate never writes (increment is the
    // saveResults lane's writer pin).
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

    expect(createSaveListener).toHaveBeenCalledTimes(1);
    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'TestBarbarian',
      saveType: 'CON',
      saveDc: 10,
    });
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestBarbarian',
      abilityName: 'Relentless Rage',
      description: 'Relentless Rage triggered — TestBarbarian must make CON save (DC 10)',
      source: 'Relentless Rage',
      promptId: 'prompt-123',
    });
  });

  it('escalates saveDc by canon +5 per prior use and mirrors the DC in the log line', () => {
    // uses null -> 0 via `?? 0` (rest-reset latch state).
    for (const [uses, expectedDc] of [[0, 10], [1, 15], [2, 20], [3, 25], [null, 10]]) {
      reseed(CANON_AUTOMATION, { uses });
      const result = checkRelentlessRage(CREATURE, makePlayerComputed(), campaignName);

      expect(result).toEqual({ intercepted: true, awaitingSave: true });
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: 'CON',
        saveDc: expectedDc,
      });
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        description: `Relentless Rage triggered — TestBarbarian must make CON save (DC ${expectedDc})`,
        source: 'Relentless Rage',
        promptId: 'prompt-123',
      });
    }
  });

  it('applies automation defaults and honors custom saveType/saveDc overrides', () => {
    const rows = [
      // Empty automation: all three `||` defaults fire -> CON, DC 10.
      [{ saveType: 'CON', saveDc: 10 }, {}, 0],
      // Falsy-triple bait: 0/null fall through the `||` guards to
      // defaults, NOT 0-DC; null dcScaling stays flat even at uses=1.
      [{ saveType: 'CON', saveDc: 10 }, { saveType: null, saveDc: 0, dcScaling: null }, 1],
      // Custom values pass through untouched; absent dcScaling -> flat at uses=1.
      [{ saveType: 'WIS', saveDc: 12 }, { saveType: 'WIS', saveDc: 12 }, 1],
    ];
    for (const [expected, automation, uses] of rows) {
      reseed(automation, { uses });
      checkRelentlessRage(CREATURE, makePlayerComputed(automation), campaignName);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestBarbarian',
        saveType: expected.saveType,
        saveDc: expected.saveDc,
      });
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestBarbarian',
        abilityName: 'Relentless Rage',
        description: `Relentless Rage triggered — TestBarbarian must make ${expected.saveType} save (DC ${expected.saveDc})`,
        source: 'Relentless Rage',
        promptId: 'prompt-123',
      });
    }
  });

  it('drives the predicate directly from disk canon in both rulesets', () => {
    const diskRows = [classes5e, classes2024].map(data =>
      data.find(c => c.name === 'Barbarian').class_levels[10].features
        .find(f => f.name === 'Relentless Rage')
    );
    // Tripwire: the two ruleset rows must stay identical; if either
    // diverges, every DC/heal pin in this suite needs re-derivation.
    expect(diskRows[0].automation).toEqual(diskRows[1].automation);

    for (const feature of diskRows) {
      const { saveDc, dcScaling, saveType } = feature.automation;
      for (const uses of [0, 2]) {
        const automation = { ...CANON_AUTOMATION, ...feature.automation };
        reseed(automation, { uses });
        const expectedDc = saveDc + uses * dcScaling;
        const result = checkRelentlessRage(CREATURE, makePlayerComputed(automation), campaignName);

        expect(result).toEqual({ intercepted: true, awaitingSave: true });
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
          targetName: 'TestBarbarian',
          saveType,
          saveDc: expectedDc,
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestBarbarian',
          abilityName: 'Relentless Rage',
          description: `Relentless Rage triggered — TestBarbarian must make ${saveType} save (DC ${expectedDc})`,
          source: 'Relentless Rage',
          promptId: 'prompt-123',
        });
      }
    }
  });

  it('golden quirks: undefined computed refuses silently; undefined creature deref throws TypeError', () => {
    // Optional-chain guard on playerComputed (relentlessRageService.js:53).
    reseed(CANON_AUTOMATION);
    expect(checkRelentlessRage(CREATURE, undefined, campaignName)).toEqual({ intercepted: false });

    // Unguarded creature.name (relentlessRageService.js:63) — golden
    // TypeError: the applyDamage interceptor chain always supplies a
    // creature, so no guard exists and none shall be added silently.
    reseed(CANON_AUTOMATION);
    expect(() => checkRelentlessRage(undefined, makePlayerComputed(), campaignName)).toThrow(TypeError);
  });
});
