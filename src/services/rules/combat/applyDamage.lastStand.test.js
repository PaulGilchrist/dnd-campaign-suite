// @maintained-by-ai
// Lane: Boon of Recovery (Last Stand) zero-HP interception through applyDamageToTarget.
// Owns the last-stand-unique contract: the drop-to-0 intercept return bytes (incl.
// interceptedFeature identity from the ZERO_HP_INTERCEPTORS dispatch order), the full
// stamped write-set (heal, latch, stabilise, unconscious-filter) — folded into ONE merged
// setRuntimeBatch POST (backlog 2026-11-15 PW, CLA-092 write-batching), the 'healing' log entry,
// and the gate legs proving the guard fires on lethal damage and stays silent otherwise.
// Generic resistance/save/evasion arithmetic lives in applyDamage.helpers.test.js — not re-driven here.
// Handler-lane ('hp_change' logs via survive_and_heal) lives in boonOfRecoveryHandler.test.js — not duplicated here.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// Prevent unhandled fetch rejections in tests
globalThis.fetch = vi.fn(() => new Promise(() => {}));

function makeCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

// Player entry in the characters list — the interceptor's playerComputed comes from
// here (options.characters), NOT from the combat-summary creature's own fields.
function makeCharacter(name, { maxHp = 180, features = [] } = {}) {
  return {
    name,
    computedStats: {
      name,
      level: 20,
      hitPoints: { max: maxHp },
      class: { name: 'Paladin', class_levels: [{ level: 20 }] },
      allFeatures: features,
      equipment: [],
    },
  };
}

const LAST_STAND = [{ name: 'Last Stand' }];

// Runtime-store stub keyed by `${name}.${key}` factories — never positional-once-chains.
function store(overrides = {}) {
  const defaults = {
    activeConditions: () => [],
    activeBuffs: () => [],
    targetEffects: () => [],
    tempHp: () => 0,
  };
  return (name, key) => {
    const k = `${name}.${key}`;
    if (k in overrides) return overrides[k];
    const def = defaults[key];
    return def ? def() : undefined;
  };
}

function makeSummary(name) {
  return { round: 1, creatures: [makeCreature(name)] };
}

function applyLethal(cs, name, { maxHp = 180, features = LAST_STAND, damage = 10 } = {}) {
  return applyDamageToTarget(cs, name, damage, ['Slashing'], {
    campaignName,
    characters: [makeCharacter(name, { maxHp, features })],
  });
}

describe('applyDamageToTarget — Boon of Recovery (Last Stand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('intercepts drop-to-0: heals 1 + floor(maxHp/2), stamps latch and stabilise bytes, logs healing', async () => {
    getRuntimeValue.mockImplementation(store({
      'BoonChar.currentHitPoints': 10,
      'BoonChar.hitPoints': 180,
      'BoonChar.activeConditions': ['unconscious', 'poisoned'],
    }));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const cs = makeSummary('BoonChar');
    const result = await applyLethal(cs, 'BoonChar');

    // Return contract: intercepted at the zero-HP seam, attributed to this feature,
    // damage fully annulled (oldHp retained, 10 damage rolled off).
    expect(result).toMatchObject({
      intercepted: true,
      interceptedFeature: 'Boon of Recovery',
      finalDamage: 0,
      damageDealt: 10,
      oldHp: 10,
      newHp: 91, // 1 + floor(180/2), capped at maxHp
    });

    // Stamped bytes: heal, one-shot latch, death-save stabilise,
    // unconscious stripped while other conditions are preserved — all SIX
    // keys in ONE merged setRuntimeBatch POST (backlog 2026-11-15 PW,
    // CLA-092 write-batching; CharHitPoints db0ad4cf8 precedent).
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).toHaveBeenCalledWith('BoonChar', {
      currentHitPoints: 91,
      boonOfRecoveryLastStandUsed: true,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
      activeConditions: ['poisoned'],
    }, campaignName);
    // No residual per-key interceptor legs: only the damage flow's own
    // interim currentHitPoints commit may use setRuntimeValue.
    const INTERCEPTOR_KEYS = ['boonOfRecoveryLastStandUsed', 'deathSaves', 'deathFailures', 'isDead', 'activeConditions'];
    const interceptorWrites = setRuntimeValue.mock.calls.filter(
      ([name, key]) => name === 'BoonChar' && INTERCEPTOR_KEYS.includes(key)
    );
    expect(interceptorWrites).toHaveLength(0);

    // Combat-summary creature mirror updated so the card renders the revival.
    expect(cs.creatures[0].currentHp).toBe(91);

    // Healing log entry verbatim (log-family parity 2026-11-14: the 0-HP
    // rescue row rides the hp_change heal family, amount byte retired).
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'hp_change',
      targetName: 'BoonChar',
      delta: 91,
      currentHp: 91,
      maxHp: 180,
      isHealing: true,
      isUnconscious: false,
      sourceName: 'Boon Of Recovery - Last Stand',
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchSpy.mockRestore();
  });

  it.each([
    ['the long-rest latch is already set', LAST_STAND, { 'BoonChar.boonOfRecoveryLastStandUsed': true }],
    ['the Last Stand feature is not present', [{ name: 'Extra Attack' }], {}],
  ])('stays silent when %s — damage drops target to 0 and normal death handling takes over', async (_label, features, overrides) => {
    getRuntimeValue.mockImplementation(store({
      'BoonChar.currentHitPoints': 10,
      'BoonChar.hitPoints': 180,
      ...overrides,
    }));

    const result = await applyLethal(makeSummary('BoonChar'), 'BoonChar', { features });

    // Guard fires: no interception, damage lands, target falls to 0.
    expect(result.finalDamage).toBe(10);
    expect(result.newHp).toBe(0);
    expect(result.intercepted).toBeUndefined();
    expect(result.interceptedFeature).toBeUndefined();
    expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'BoonChar' }));

    // Guard stays silent: no latch stamp, no stabilise bytes, no healing log.
    expect(setRuntimeValue).not.toHaveBeenCalledWith('BoonChar', 'boonOfRecoveryLastStandUsed', true, campaignName);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('BoonChar', 'isDead', 0, campaignName);
    expect(setRuntimeBatch).not.toHaveBeenCalledWith('BoonChar', expect.objectContaining({ boonOfRecoveryLastStandUsed: true }), campaignName);
    expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ sourceName: 'Boon Of Recovery - Last Stand' }));
  });

  it('throws loudly (no silent fallback) when stored max HP is missing', async () => {
    getRuntimeValue.mockImplementation(store({
      'BoonChar.currentHitPoints': 10,
      'BoonChar.hitPoints': null,
    }));

    await expect(applyLethal(makeSummary('BoonChar'), 'BoonChar')).rejects.toThrow('Last Stand: hitPoints not found for BoonChar');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('BoonChar', 'boonOfRecoveryLastStandUsed', true, campaignName);
  });
});
