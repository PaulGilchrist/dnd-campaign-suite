import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn().mockReturnValue(false),
}));

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

import { handle, processStinkingCloudAreaSave, applyStinkingCloudTurnEnd } from './stinkingCloudHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

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

function makeAction(automation = {}, metaCtx = {}) {
  return {
    name: 'Stinking Cloud',
    automation: { type: 'stinking_cloud', saveDc: 18, saveType: 'CON', ...automation },
    metaCtx,
  };
}

function makePlayerStats(overrides = {}) {
  return { name: casterName, level: 20, spellAbilities: { saveDc: 18 }, ...overrides };
}

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

// ── handle(): zone registration ────────────────────────────────

describe('stinkingCloudHandler zone registration (SP-111)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(18);
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p1',
      promise: Promise.resolve({ success: true, roll: 20, total: 22 }),
    });
    logService.addEntry.mockResolvedValue({});
  });

  it('registers the _stinkingCloud_<caster> zone tracking key with radius 20 and CON DC', async () => {
    const store = createStore({ 'campaign.targetEffects': [] });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1' }] });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(store.setRuntimeValue).toHaveBeenCalledWith(
      casterName,
      trackingKey,
      expect.objectContaining({
        caster: casterName,
        saveDc: 18,
        saveType: 'CON',
        radius: 20,
        mapName,
        campaignName,
      }),
      campaignName,
    );
  });

  it('registers a 10-round zone expiration clearing tracking + zone + block tes', async () => {
    const store = createStore({ 'campaign.targetEffects': [] });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1' }] });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(addExpiration).toHaveBeenCalledWith(
      casterName,
      casterName,
      [
        { type: 'clear_runtime_value', creatureName: casterName, key: trackingKey },
        { type: 'remove_target_effect', effectKey: 'stinking_cloud', source: casterName },
        { type: 'remove_target_effect', effectKey: 'no_action_and_bonus_action', source: casterName },
      ],
      campaignName,
      10,
    );
  });

  it('writes the no_action_and_bonus_action block te when the cast-time save fails', async () => {
    const store = createStore({ 'campaign.targetEffects': [] });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p1',
      promise: Promise.resolve({ success: false, roll: 1, total: 3 }),
    });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    expect(store.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Thug 1',
          effect: 'no_action_and_bonus_action',
          source: casterName,
          duration: 'until_end_of_current_turn',
        }),
      ]),
      campaignName,
      true,
    );
    // The zone marker te must still be written.
    expect(store.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Thug 1',
          effect: 'stinking_cloud',
          source: casterName,
          duration: 'concentration',
        }),
      ]),
      campaignName,
    );
  });

  it('does NOT write the block te when the cast-time save succeeds', async () => {
    const store = createStore({ 'campaign.targetEffects': [] });
    installStore(store);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Thug 1' }] });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'p1',
      promise: Promise.resolve({ success: true, roll: 20, total: 22 }),
    });

    await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    const blockWrites = store.setRuntimeValue.mock.calls.filter(
      call => call[0] === 'campaign' && call[1] === 'targetEffects'
        && Array.isArray(call[2]) && call[2].some(te => te.effect === 'no_action_and_bonus_action')
    );
    expect(blockWrites).toHaveLength(0);
  });
});

// ── processStinkingCloudAreaSave: turn-start recurring save ───

describe('stinkingCloudHandler.processStinkingCloudAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue({});
    rangeCheck.isWithinRange.mockResolvedValue(true);
    automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
  });

  it('returns null when no zone tracking exists', async () => {
    const store = createStore();
    installStore(store);
    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);
    expect(result).toBeNull();
  });

  it('returns null when tracking has no saveDc', async () => {
    const store = createStore({ [`${casterName}.${trackingKey}`]: { caster: casterName } });
    installStore(store);
    const result = await processStinkingCloudAreaSave(casterName, 'Thug 1', campaignName, mapName);
    expect(result).toBeNull();
  });

  it('returns null when a positioned target is outside the 20ft sphere', async () => {
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
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  it('forces a CON save at turn start and applies Poisoned + block te on failure', async () => {
    const store = createStore({
      [`${casterName}.${trackingKey}`]: baseTracking,
      'campaign.targetEffects': [
        { target: 'Thug 1', effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 },
      ],
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

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Thug 1',
      saveType: 'CON',
      saveDc: 18,
      dcSuccess: 'none',
    });
    expect(store.store['Thug 1.activeConditions']).toEqual(['poisoned']);
    expect(store.store['campaign.targetEffects']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: 'Thug 1',
        effect: 'no_action_and_bonus_action',
        source: casterName,
        duration: 'until_end_of_current_turn',
      }),
    ]));
    expect(result.payload.description).toContain('failed');
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
      'campaign.targetEffects': [
        { target: 'Thug 1', effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 },
      ],
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
      'campaign.targetEffects': [
        { target: 'Thug 1', effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 },
        { target: 'Thug 1', effect: 'no_action_and_bonus_action', source: casterName, duration: 'until_end_of_current_turn' },
      ],
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
    expect(result.payload.description).toContain('succeeded');
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
});

// ── applyStinkingCloudTurnEnd: "until the end of the current turn" ───

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
      'campaign.targetEffects': [
        { target: 'Thug 1', effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 },
        { target: 'Thug 1', effect: 'no_action_and_bonus_action', source: casterName, duration: 'until_end_of_current_turn' },
      ],
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
      'campaign.targetEffects': [
        { target: 'Thug 1', effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 },
      ],
      'Thug 1.activeConditions': [],
    });
    installStore(store);

    await applyStinkingCloudTurnEnd(campaignName, 'Thug 1');

    expect(store.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
