// @maintained-by-ai
// Lane: Relentless Endurance (Orc race trait) zero-HP interception through applyDamageToTarget.
// Owns the relentless-endurance-unique contract: the drop-to-0 intercept return bytes (incl.
// interceptedFeature identity from the ZERO_HP_INTERCEPTORS dispatch order), the full stamped
// write-set (HP-floor at 1, once-per-rest latch, death-save stabilise, unconscious-filter),
// the 'hp_change' log entry, the RE-only damage-sequence latch (_reTriggeredSequenceIds —
// follow-up hits in the same sequence stay pinned at 1; a new sequence dies), and the loud
// throw when stored max HP is missing.
// Generic resistance/save/evasion arithmetic lives in applyDamage.helpers.test.js
// (computeDamageAfterResistances :53-86, computeDamageAfterSave :88-104,
// rollSaveForCreature :106-166, hasEvasionForSave :168-182,
// computeDamageAfterEvasion :184-196) — not re-driven here.
// Handler-lane coverage lives in automation/handlers/class-cleric-paladin/relentlessEnduranceHandler.test.js — not duplicated here.

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
function makeCharacter(name, { maxHp = 78, features = [{ name: 'Relentless Endurance' }] } = {}) {
  return {
    name,
    computedStats: {
      name,
      level: 1,
      hitPoints: { max: maxHp },
      class: { name: 'Rogue', class_levels: [{ level: 1 }] },
      allFeatures: features,
      equipment: [],
    },
  };
}

const RE_TRAIT = [{ name: 'Relentless Endurance' }, { name: 'Darkvision' }];

// Runtime-store stub keyed by `${name}.${key}` factories — never positional-once-chains.
// Mutable via set() so a test can simulate state written by a previous apply (latch, HP).
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
  impl.set = (name, key, value) => { values[`${name}.${key}`] = value; };
  return impl;
}

function makeSummary(name) {
  return { round: 1, creatures: [makeCreature(name)] };
}

function applyLethal(cs, name, { maxHp = 78, features = RE_TRAIT, damage = 10, ...options } = {}) {
  return applyDamageToTarget(cs, name, damage, ['Slashing'], {
    campaignName,
    characters: [makeCharacter(name, { maxHp, features })],
    ...options,
  });
}

describe('applyDamageToTarget — Relentless Endurance (Orc race trait)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('intercepts drop-to-0: HP floored at 1, stamps latch and stabilise bytes, strips unconscious, logs hp_change', async () => {
    getRuntimeValue.mockImplementation(store({
      'Grushnak.currentHitPoints': 10,
      'Grushnak.hitPoints': 78,
      'Grushnak.activeConditions': ['unconscious', 'blinded'],
    }));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const cs = makeSummary('Grushnak');
    const result = await applyLethal(cs, 'Grushnak');

    // Return contract: intercepted at the zero-HP seam, attributed to this feature,
    // damage fully annulled (oldHp retained, 10 damage rolled off).
    expect(result).toMatchObject({
      intercepted: true,
      interceptedFeature: 'Relentless Endurance',
      finalDamage: 0,
      damageDealt: 10,
      oldHp: 10,
      newHp: 1,
    });

    // Stamped bytes: HP floor at 1, once-per-rest latch, death-save stabilise,
    // unconscious stripped while other conditions are preserved.
    expect(setRuntimeValue).toHaveBeenCalledWith('Grushnak', 'currentHitPoints', 1, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Grushnak', 'relentlessEnduranceUsed', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Grushnak', 'deathSaves', [false, false, false], campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Grushnak', 'deathFailures', [false, false, false], campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Grushnak', 'isDead', 0, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Grushnak', 'activeConditions', ['blinded'], campaignName);

    // Combat-summary creature mirror updated so the card renders the revival.
    expect(cs.creatures[0].currentHp).toBe(1);

    // No death-save prompt — the target never died.
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();

    // hp_change log entry verbatim.
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'hp_change',
      targetName: 'Grushnak',
      delta: 1,
      currentHp: 1,
      maxHp: 78,
      isUnconscious: false,
      sourceName: 'Relentless Endurance',
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    dispatchSpy.mockRestore();
  });

  it.each([
    ['the once-per-rest latch is already set', RE_TRAIT, { 'Grushnak.relentlessEnduranceUsed': true }],
    ['the Relentless Endurance trait is not present', [{ name: 'Darkvision' }], {}],
    ['allFeatures is null', null, {}],
  ])('stays silent when %s — damage drops target to 0 and normal death handling takes over', async (_label, features, overrides) => {
    getRuntimeValue.mockImplementation(store({
      'Grushnak.currentHitPoints': 10,
      'Grushnak.hitPoints': 78,
      ...overrides,
    }));

    const result = await applyLethal(makeSummary('Grushnak'), 'Grushnak', { features });

    // Guard fires: no interception, damage lands, target falls to 0 with a death-save prompt.
    expect(result.finalDamage).toBe(10);
    expect(result.newHp).toBe(0);
    expect(result.intercepted).toBeUndefined();
    expect(result.interceptedFeature).toBeUndefined();
    expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'Grushnak' }));

    // Guard stays silent: no HP-floor write, no latch stamp, no hp_change log from the trait.
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Grushnak', 'currentHitPoints', 1, campaignName);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Grushnak', 'relentlessEnduranceUsed', true, campaignName);
    expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ sourceName: 'Relentless Endurance' }));
  });

  it('pins follow-up hits in the same damage sequence at 1 but lets a new sequence kill', async () => {
    const grushnakStore = store({
      'Grushnak.currentHitPoints': 10,
      'Grushnak.hitPoints': 78,
    });
    getRuntimeValue.mockImplementation(grushnakStore);
    const cs = makeSummary('Grushnak');

    // First hit of the sequence: trait intercepts and latches.
    const first = await applyLethal(cs, 'Grushnak', { damageSequenceId: 'seq-re-1' });
    expect(first).toMatchObject({ intercepted: true, interceptedFeature: 'Relentless Endurance', newHp: 1 });

    // Simulate the runtime state the intercept wrote: latch set, 1 HP standing.
    grushnakStore.set('Grushnak', 'relentlessEnduranceUsed', true);
    grushnakStore.set('Grushnak', 'currentHitPoints', 1);

    // Follow-up hit, same sequence: pinned at 1 even though 50 damage would re-kill.
    const second = await applyLethal(cs, 'Grushnak', { damage: 50, damageSequenceId: 'seq-re-1' });
    expect(second).toMatchObject({ oldHp: 1, newHp: 1, finalDamage: 50 });
    expect(second.intercepted).toBeUndefined();
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    // HP stays pinned: the latest persisted HP write lifts the lethal 0 back to 1
    // (production lands 0 in the store before the sequence guard runs, so scope by last write).
    const hpWrites = setRuntimeValue.mock.calls
      .filter(c => c[0] === 'Grushnak' && c[1] === 'currentHitPoints')
      .map(c => c[2]);
    expect(hpWrites.at(-1)).toBe(1);

    // Different sequence: the latch is sequence-scoped — the new sequence lands and kills.
    const third = await applyLethal(cs, 'Grushnak', { damage: 50, damageSequenceId: 'seq-re-2' });
    expect(third).toMatchObject({ oldHp: 1, newHp: 0 });
    expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({ targetName: 'Grushnak' }));

    // The latch was stamped exactly once (by the first intercept, never re-stamped).
    const latchStamps = setRuntimeValue.mock.calls.filter(c => c[1] === 'relentlessEnduranceUsed');
    expect(latchStamps).toHaveLength(1);
  });

  it('throws loudly (no silent fallback) when stored max HP is missing', async () => {
    getRuntimeValue.mockImplementation(store({
      'Grushnak.currentHitPoints': 10,
      'Grushnak.hitPoints': null,
    }));

    await expect(applyLethal(makeSummary('Grushnak'), 'Grushnak')).rejects.toThrow('Relentless Endurance: hitPoints not found for Grushnak');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Grushnak', 'relentlessEnduranceUsed', true, campaignName);
  });
});
