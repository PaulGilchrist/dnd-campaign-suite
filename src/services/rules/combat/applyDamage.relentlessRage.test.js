// @maintained-by-ai
// Lane: Relentless Rage (Barbarian lv11) zero-HP interception through applyDamageToTarget.
// Owns the interception RETURN CONTRACT at the dispatcher (interceptZeroHitPoints): every
// intercepted drop-to-0 must carry an honest numeric newHp so consumer rows (fall_damage
// ledger text, popups, targetCurrentHp feeds) never render "undefined". Relentless Rage's
// async contract ({ awaitingSave: true }) has no post-save HP at trigger time — the bug
// this lane locks: it used to spread NO newHp, printing "(5 → undefined HP)" in the
// fall_damage row while the bucket truth (currentHitPoints 0) sat correctly written.
// The fix threads the stored damage-leg newHp in as the default UNDER the spread, so
// synchronous interceptors (Relentless Endurance below, Undying Sentinel/Boon of
// Recovery/Death Ward in their own lanes) keep their own post-interception bytes unchanged.
//
// Owners cited, NOT re-driven here:
// - checkRelentlessRage predicate/prompt bytes → features/relentlessRageService.checkRelentlessRage.test.js
// - save-result resolution / uses bump / death-save slot machine → saveResults / deathSaves lanes
// - fall_damage row interpolation → services/combat/fallDamage.test.js (exact bytes)
// - RE write-set / sequence latch → applyDamage.relentlessEndurance.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';
import { sendDeathSavePrompt } from '../../combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';

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

// RR trigger lane requests its prompt through the shared listener factory — stub it so
// no window listener/store write is exercised here (resolution is the saveResults lane).
vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-1' })),
  logSaveDismissed: vi.fn(),
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

// Disk-canon 2024 Barbarian lv11 automation row (classes.json, verified in
// relentlessRageService.checkRelentlessRage.test.js against both ruleset twins).
const RR_AUTOMATION = {
  type: 'reaction_save_heal',
  saveType: 'CON',
  saveDc: 10,
  dcScaling: 5,
  healExpression: '2 * barbarian_level',
};

function makeCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 131,
    currentHp: 131,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

// The interceptor's playerComputed comes from options.characters — a raging lv18
// Barbarian carrying ONLY the RR feature row, so the earlier interceptors in
// ZERO_HP_INTERCEPTORS (Sentinel / Last Stand / Relentless Endurance) stay silent.
function makeRagingBarbarian(name) {
  return {
    name,
    computedStats: {
      name,
      level: 18,
      hitPoints: { max: 131 },
      class: { name: 'Barbarian', class_levels: [{ name: 'Barbarian', level: 18 }] },
      allFeatures: [{ name: 'Relentless Rage', automation: RR_AUTOMATION }],
      equipment: [],
    },
  };
}

// Runtime-store stub keyed by `${name}.${key}` (sibling applyDamage interceptor convention).
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
  return { round: 1, creatures: [makeCreature(name, { currentHp: 5 })] };
}

describe('applyDamageToTarget — Relentless Rage interception return contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSaveListener.mockReturnValue({ promptId: 'test-prompt-1' });
  });

  it('carries the honest stored newHp (bucket truth 0) on an awaitingSave intercept — never undefined', async () => {
    getRuntimeValue.mockImplementation(store({
      'Vex.currentHitPoints': 5,
      'Vex.hitPoints': 131,
      'Vex.activeBuffs': [{ name: 'Rage', effect: 'stance' }],
    }));

    const cs = makeSummary('Vex');
    const result = await applyDamageToTarget(cs, 'Vex', 200, ['Bludgeoning'], {
      campaignName,
      characters: [makeRagingBarbarian('Vex')],
      trigger: 'falling',
    });

    // The HP leg wrote the bucket truth (0) BEFORE interception fired — the intercept
    // return must surface that same number so fallDamage.js renders "(5 → 0 HP)",
    // not "(5 → undefined HP)".
    expect(setRuntimeValue).toHaveBeenCalledWith('Vex', 'currentHitPoints', 0, campaignName);
    expect(result).toMatchObject({
      intercepted: true,
      awaitingSave: true,
      interceptedFeature: 'Relentless Rage',
      oldHp: 5,
      damageDealt: 200,
    });
    expect(result.newHp).toBe(0);
    expect(`${result.oldHp} → ${result.newHp} HP`).toBe('5 → 0 HP');

    // Prompt requested at the canon DC-10 ladder base, trigger logged, and the
    // intercepted drop short-circuits death handling with zero hp_change row.
    expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Vex',
      saveType: 'CON',
      saveDc: 10,
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Relentless Rage',
      description: 'Relentless Rage triggered — Vex must make CON save (DC 10)',
    }));
    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'hp_change' }));
  });

  it('threaded default never shadows a synchronous interceptor — Relentless Endurance still returns its own newHp 1', async () => {
    getRuntimeValue.mockImplementation(store({
      'Grushnak.currentHitPoints': 10,
      'Grushnak.hitPoints': 78,
    }));

    const characters = [{
      name: 'Grushnak',
      computedStats: {
        name: 'Grushnak',
        level: 1,
        hitPoints: { max: 78 },
        class: { name: 'Rogue', class_levels: [{ level: 1 }] },
        allFeatures: [{ name: 'Relentless Endurance' }],
        equipment: [],
      },
    }];

    const result = await applyDamageToTarget(makeSummary('Grushnak'), 'Grushnak', 10, ['Slashing'], {
      campaignName,
      characters,
    });

    expect(result).toMatchObject({
      intercepted: true,
      interceptedFeature: 'Relentless Endurance',
      oldHp: 10,
      damageDealt: 10,
    });
    // Its own post-interception value wins over the stored 0 default.
    expect(result.newHp).toBe(1);
  });
});
