// @maintained-by-ai
// Lane: Undying Sentinel (Paladin feature) zero-HP interception through applyDamageToTarget.
// Owns the Sentinel-unique contract: the drop-to-0 intercept return bytes (incl. interceptedFeature
// identity from the ZERO_HP_INTERCEPTORS dispatch order, applyDamage.js :595-614), the heal formula
// min(1 + 3 x paladin level, runtime-store max HP) (undyingSentinelService.js :26-35), the full
// stamped write-set (currentHitPoints, once-per-long-rest latch, death-save stabilise, isDead,
// unconscious-filter), the verbatim 'healing' log entry (undyingSentinelService.js :54-64), and the
// loud throw when stored max HP is missing.
// Not re-driven here:
// - Generic resistance/save/HP arithmetic: applyDamage.helpers.test.js :53-196; entry guards and
//   player HP bookkeeping: applyDamage.test.js :146-155 / :157-177; DC recalc: :334-366.
// - Arcane Ward absorption through applyDamageToTarget: applyDamage.buffs.test.js :209 — a
//   ward-absorbed hit never reaches 0, so the Sentinel silently passes on the same above-zero
//   guard covered in the falsifier lane below.
// - Manual-activation handler lane: automation/handlers/class-cleric-paladin/undyingSentinelHandler.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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

const SENTINEL = [{ name: 'Undying Sentinel' }, { name: 'Divine Sense' }];

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
function makeCharacter(name, { level = 15, features = SENTINEL } = {}) {
  return {
    name,
    computedStats: {
      name,
      level,
      hitPoints: { max: 150 },
      class: { name: 'Paladin', class_levels: [{ level }] },
      allFeatures: features,
      equipment: [],
    },
  };
}

// Runtime-store stub keyed by `${name}.${key}` factories — never positional-once-chains.
function store(overrides = {}) {
  const values = { ...overrides };
  const defaults = {
    activeConditions: () => [],
    activeBuffs: () => [],
    targetEffects: () => [],
    tempHp: () => 0,
  };
  const impl = (name, key) => {
    const k = `${name}.${key}`;
    if (k in values) return values[k];
    const def = defaults[key];
    return def ? def() : undefined;
  };
  return impl;
}

function makeSummary(name) {
  return { round: 1, creatures: [makeCreature(name)] };
}

function applyLethal(cs, name, { level = 15, features = SENTINEL, damage = 10 } = {}) {
  return applyDamageToTarget(cs, name, damage, ['Slashing'], {
    campaignName,
    characters: [makeCharacter(name, { level, features })],
  });
}

describe('applyDamageToTarget — Undying Sentinel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('intercepts drop-to-0: heals to 1 + 3x level, stamps latch and stabilise bytes, strips unconscious, logs healing verbatim', async () => {
    getRuntimeValue.mockImplementation(store({
      'GloryPaladin.currentHitPoints': 10,
      'GloryPaladin.hitPoints': 150,
      'GloryPaladin.activeConditions': ['unconscious', 'blinded'],
    }));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const cs = makeSummary('GloryPaladin');
    const result = await applyLethal(cs, 'GloryPaladin', { level: 15 });

    // Return contract: intercepted at the zero-HP seam, attributed to this feature,
    // damage fully annulled (oldHp retained, 10 damage rolled off).
    expect(result).toMatchObject({
      intercepted: true,
      interceptedFeature: 'Undying Sentinel',
      finalDamage: 0,
      damageDealt: 10,
      oldHp: 10,
      newHp: 46, // 1 + (3 * 15)
    });

    // Stamped bytes: HP lifted to 46 (over the flow's interim 0 write), once-per-long-rest
    // latch, death-save stabilise, isDead cleared, unconscious stripped while other
    // conditions are preserved.
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'currentHitPoints', 46, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'undyingSentinelUsed', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'deathSaves', [false, false, false], campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'deathFailures', [false, false, false], campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'isDead', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'activeConditions', ['blinded'], campaignName);

    // Combat-summary creature mirror updated so the card renders the revival.
    expect(cs.creatures[0].currentHp).toBe(46);

    // No death-save prompt — the target never died.
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();

    // Healing log entry verbatim (maxHp read from the runtime store, not the creature).
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'healing',
      targetName: 'GloryPaladin',
      delta: 46,
      amount: 46,
      currentHp: 46,
      maxHp: 150,
      isHealing: true,
      isUnconscious: false,
      sourceName: 'Undying Sentinel',
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchSpy.mockRestore();
  });

  it.each([
    ['level 1 heals 1 + 3', 1, 150, 4],
    ['level 20 heals 1 + 60', 20, 200, 61],
    ['healing caps at max HP (not 61)', 20, 50, 50],
  ])('heal formula min(1 + 3xlevel, maxHp): %s', async (_label, level, maxHp, expectedHp) => {
    getRuntimeValue.mockImplementation(store({
      'GloryPaladin.currentHitPoints': 10,
      'GloryPaladin.hitPoints': maxHp,
    }));

    const result = await applyLethal(makeSummary('GloryPaladin'), 'GloryPaladin', { level });

    expect(result).toMatchObject({ intercepted: true, interceptedFeature: 'Undying Sentinel', finalDamage: 0, newHp: expectedHp });
    expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'currentHitPoints', expectedHp, campaignName);
  });

  it.each([
    ['the once-per-long-rest latch is already set', SENTINEL, { 'GloryPaladin.undyingSentinelUsed': true }, 10],
    ['the Undying Sentinel feature is not present', [{ name: 'Extra Attack' }], {}, 10],
    ['allFeatures is null', null, {}, 10],
    ['damage leaves HP above 0', SENTINEL, { 'GloryPaladin.currentHitPoints': 5 }, 3],
  ])('stays silent when %s — no latch stamp, no heal, normal damage handling takes over', async (_label, features, overrides, damage) => {
    getRuntimeValue.mockImplementation(store({
      'GloryPaladin.currentHitPoints': 10,
      'GloryPaladin.hitPoints': 150,
      ...overrides,
    }));

    const expectedHp = Math.max(0, (overrides['GloryPaladin.currentHitPoints'] ?? 10) - damage);
    const result = await applyLethal(makeSummary('GloryPaladin'), 'GloryPaladin', { features, damage });

    expect(result).toMatchObject({ finalDamage: damage, newHp: expectedHp });
    expect(result.intercepted).toBeUndefined();
    expect(result.interceptedFeature).toBeUndefined();

    // Guard stays silent: no latch stamp, no Sentinel healing log.
    expect(setRuntimeValue).not.toHaveBeenCalledWith('GloryPaladin', 'undyingSentinelUsed', true, campaignName);
    expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ sourceName: 'Undying Sentinel' }));

    if (expectedHp === 0) {
      expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'GloryPaladin' }));
    } else {
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    }
  });

  it('throws loudly (no silent fallback) when stored max HP is missing', async () => {
    getRuntimeValue.mockImplementation(store({
      'GloryPaladin.currentHitPoints': 10,
      'GloryPaladin.hitPoints': null,
    }));

    await expect(applyLethal(makeSummary('GloryPaladin'), 'GloryPaladin')).rejects.toThrow('Undying Sentinel: hitPoints not found for GloryPaladin');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('GloryPaladin', 'undyingSentinelUsed', true, campaignName);
    expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ sourceName: 'Undying Sentinel' }));
  });
});
