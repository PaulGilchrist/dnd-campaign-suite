// @maintained-by-ai
// prismaticSpray SEXTET lane #1944 — SUMMARY composition (subject prismaticSprayHandler.js).
// Owns the popup/result-summary prose templates built at the bottom of handle():
//   `Prismatic Spray affects N creature(s). ${results.join(' ')} N creature(s) saved. N ray(s) immune.`
//   and the all-saved branch `No creatures affected by Prismatic Spray. ...`.
// These are FULL-STRING own-composition pins — siblings hold toContain fragments only.
// Seam map in prismaticSprayHandler.damage-regression.test.js header.
// Trimmed here (owned elsewhere per seam map):
//   • 'falls back to 12d6 when damage is not in automation' — TRUE DUPE of #1939's
//     fix-site ② pin (hardened there with a rollExpression assertion); deleted.
//   • custom-damage createSaveListener payload pin — formula (#1939) / payload row (#1942).
//   • storeSpellLastAttack / buildSaveDc call pins, createSaveListener dispatch counts —
//     orchestration (#1940).
// Math.random is forced in every test so the joined results and ray names are exact.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve()),
  computeDamageAfterSave: vi.fn((raw, success) => (success ? Math.floor(raw / 2) : raw)),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './prismaticSprayHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestWizard';

const originalRandom = Math.random;

// Force pickRays' firstRoll (1d8) so every target gets the same ray, deterministically.
function forceRoll(dieValue) {
  Math.random = () => (dieValue - 0.5) / 8;
}

function makeAction(overrides = {}) {
  return {
    name: 'Prismatic Spray',
    automation: {
      type: 'prismatic_spray',
      saveType: 'DEX',
      saveDc: 15,
      damage: '12d6',
      ...overrides,
    },
  };
}

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: 'Orc', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: 'Dragon', type: 'monster', weaknessesAndResistivities: { immunities: ['fire'] } },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function failSaveListener() {
  return {
    promptId: 'prismatic-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'prismatic-prompt',
    promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
  };
}

function mockFailingFlow(dc = 15) {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(dc);
  diceRoller.rollExpression.mockReturnValue({ total: 30 });
  savePrompt.createSaveListener.mockReturnValue(failSaveListener());
}

// ── Tests ──────────────────────────────────────────────────────

describe('prismaticSprayHandler.handle - summary composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('pins the full affected-summary string for three failed Indigo rays', async () => {
    mockFailingFlow();
    forceRoll(6); // Indigo for all targets

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    // Status-ray fail phrasing + affected/saved counts + empty-immunity trailing space.
    expect(result.payload.description.trim()).toBe(
      'Prismatic Spray affects 3 creature(s). ' +
      'Goblin: Indigo ray (failed DEX save, Restrained). ' +
      'Orc: Indigo ray (failed DEX save, Restrained). ' +
      'Dragon: Indigo ray (failed DEX save, Restrained). ' +
      '0 creature(s) saved.'
    );
  });

  it('pins the full mixed saved/failed summary string across targets', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(15);
    diceRoller.rollExpression.mockReturnValue({ total: 30 });

    let callCount = 0;
    savePrompt.createSaveListener.mockImplementation(() => {
      callCount++;
      return {
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: callCount === 1, roll: callCount === 1 ? 14 : 5, total: callCount === 1 ? 14 : 5 }),
      };
    });
    forceRoll(5); // Blue/cold for all targets — avoids Dragon's fire immunity skewing the mix

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    // Saved-vs-failed phrasing in one string: Goblin saved, Orc/Dragon took full damage.
    expect(result.payload.description.trim()).toBe(
      'Prismatic Spray affects 2 creature(s). ' +
      'Goblin: Blue ray (saved DEX save). ' +
      'Orc: Blue ray (failed DEX save, full damage). ' +
      'Dragon: Blue ray (failed DEX save, full damage). ' +
      '1 creature(s) saved.'
    );
  });

  it('pins the full all-saved branch string', async () => {
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
    savePrompt.buildSaveDc.mockReturnValue(15);
    diceRoller.rollExpression.mockReturnValue({ total: 30 });
    savePrompt.createSaveListener.mockReturnValue(successSaveListener());
    forceRoll(6); // Indigo — no immunity interaction on this branch

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description.trim()).toBe(
      'No creatures affected by Prismatic Spray. 3 creature(s) saved.'
    );
  });

  it('pins the full summary string with immunity skip mixed into failed saves', async () => {
    mockFailingFlow();
    forceRoll(1); // Red/fire — Dragon is fire-immune and is skipped (no save queued)

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    // Immunity line is pushed during queueing, before the processed save outcomes.
    expect(result.payload.description.trim()).toBe(
      'Prismatic Spray affects 2 creature(s). ' +
      'Dragon is immune to Red ray (Fire immunity). ' +
      'Goblin: Red ray (failed DEX save, full damage). ' +
      'Orc: Red ray (failed DEX save, full damage). ' +
      '0 creature(s) saved. 1 ray(s) immune.'
    );
  });

  it('pins the full single-target summary string', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    });
    savePrompt.buildSaveDc.mockReturnValue(15);
    diceRoller.rollExpression.mockReturnValue({ total: 30 });
    savePrompt.createSaveListener.mockReturnValue(failSaveListener());
    forceRoll(6); // Indigo, not 8 (no two-ray reroll)

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.payload.description.trim()).toBe(
      'Prismatic Spray affects 1 creature(s). ' +
      'Goblin: Indigo ray (failed DEX save, Restrained). ' +
      '0 creature(s) saved.'
    );
  });

  it('pins the full Violet summary string with saved and blinded phrasing', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
        { name: 'Orc', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    });
    savePrompt.buildSaveDc.mockReturnValue(15);

    let callCount = 0;
    savePrompt.createSaveListener.mockImplementation(() => {
      callCount++;
      return {
        promptId: 'prismatic-prompt',
        promise: Promise.resolve({ success: callCount === 1, roll: 5, total: 5 }),
      };
    });
    forceRoll(7); // Violet for both targets

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    // Violet has its own failed-outcome wording ('Blinded'), distinct from Indigo/full-damage rays.
    expect(result.payload.description.trim()).toBe(
      'Prismatic Spray affects 1 creature(s). ' +
      'Goblin: Violet ray (saved DEX save). ' +
      'Orc: Violet ray (failed DEX save, Blinded). ' +
      '1 creature(s) saved.'
    );
  });

  it('uses the action name and automation_info type in the popup payload', async () => {
    mockFailingFlow();
    forceRoll(6);

    const result = await handle(
      { name: 'Custom Prismatic Spray', automation: makeAction().automation },
      makePlayerStats(),
      campaignName,
      null,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Custom Prismatic Spray');
  });
});
