// MA-1673: Vrock "Spores" on the save-chip saveProcessing seam
// (processNpcSave inline path + processPlayerSave prompt path). The
// dc_success:"none" DATA fix flows into context.dcSuccess and is consumed at
// applySaveDamage via computeDamageAfterEvasion (fail → FULL, success →
// ZERO). Pre-fix the absent field defaulted the context to 'half', so a
// saving throw SUCCESS still paid half the 1d10 pool (MV-20 half-default
// leak §63/§456 family MA-0481/MA-0622/MA-0781). These locks prove both
// faces at both seams: FAIL pays full 7 rolled + grants Poisoned; SUCCESS
// pays ZERO (finalDamage 0, applyDamageToTarget not landed, no Poisoned).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = vi.hoisted(() => ({}));
const savePrompt = vi.hoisted(() => ({ next: null, lastPayload: null }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

// Deterministic 1d10 = 7 (matches the live FAIL ledger byte: rolls [7]).
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: () => ({ total: 7, rolls: [7], modifier: 0 }),
  rollD20: () => 7,
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: (_campaign, payload) => {
    savePrompt.lastPayload = payload;
    return { payload, promise: Promise.resolve(savePrompt.next) };
  },
}));

vi.mock('../../services/ui/logService.js', () => ({ addEntry: () => Promise.resolve() }));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: async () => ({
    creatures: [
      { name: 'Vrock 1', type: 'npc', currentHp: 152, maxHp: 152, ac: 15, resistances: [], immunities: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, resistances: [], immunities: [] },
      { name: 'AasimarTest', type: 'player', currentHp: 999, maxHp: 999, ac: 19, resistances: [], immunities: [] },
    ],
  }),
  getCurrentCombatRound: () => 1,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.hoisted(() => vi.fn(async (_cs, _t, fd) => ({ finalDamage: fd, newHp: 999 - fd })));

// Faithful three-mode computeDamageAfterSave (§87/MA-0367): fail → raw,
// 'half' → floor, 'full' → raw, 'none' → 0.
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  normalizeSaveType: (t) => String(t || '').toLowerCase(),
  computeDamageAfterSave: (raw, success, dcSuccess) => {
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  },
  computeDamageAfterEvasion: (raw, success, dcSuccess, evasionActive) => {
    if (evasionActive && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  },
  applyDamageToTarget: (...a) => applyDamageToTarget(...a),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
  isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: vi.fn(() => false),
  playerIsImmuneToCondition: vi.fn(() => false),
}));

const addExpiration = vi.hoisted(() => vi.fn());
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';
import monstersData from '../../../public/data/monsters.json';

const screamRow = () => monstersData.find(m => m.index === 'vrock').actions.find(a => a.name === 'Stunning Scream');

const campaignName = 'test-campaign';
const ATTACKER = 'Vrock 1';
const TARGET = 'Bandit 1';

// Live disk row transport (post-fix): dc_success:"none", 1d10 Poison,
// Poisoned fail-only. computeNpcSave reads FULL-word saveBonuses (§163).
const sporesContext = (over = {}) => ({
  saveDc: 15,
  saveType: 'Constitution',
  attackerName: ATTACKER,
  actionName: 'Spores',
  dcSuccess: 'none',
  autoDamageFormula: '1d10',
  autoDamageDamageType: 'Poison',
  saveConditions: ['poisoned'],
  effectiveBonus: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('MA-1673 processNpcSave seam: Vrock Spores dc_success none', () => {
  it('FAIL face (−19 always-fail floor, nat 6): FULL 1d10 (fd 7) + Poisoned granted', async () => {
    const result = await processSaveRoll({
      rollType: 'save',
      target: { name: TARGET, type: 'npc' },
      characterName: TARGET,
      campaignName,
      context: { ...sporesContext(), effectiveD20: 6 },
      bonus: -19,
      r1: 6, r2: 6,
      logEntry: vi.fn(),
      setPopupHtml: vi.fn(),
    });
    expect(result.saveSuccess).toBe(false);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toContain('poisoned');
  });

  it('SUCCESS face (+19 always-success, nat 15): ZERO damage, no hp_change, no Poisoned grant', async () => {
    const result = await processSaveRoll({
      rollType: 'save',
      target: { name: TARGET, type: 'npc' },
      characterName: TARGET,
      campaignName,
      context: { ...sporesContext(), effectiveD20: 15 },
      bonus: 19,
      r1: 15, r2: 15,
      logEntry: vi.fn(),
      setPopupHtml: vi.fn(),
    });
    expect(result.saveSuccess).toBe(true);
    // dc_success:'none' → computeDamageAfterEvasion(7,true,'none')=0 → no damage applied.
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
    expect((runtimeStore[`${TARGET}.activeConditions`] || [])).not.toContain('poisoned');
  });
});

// MA-1674: Vrock "Stunning Scream" twin seam locks — RAW success pays ZERO
// (dc_success:"none" fix for the half-default leak: live pre-fix proof
// "Saved — takes 4 Thunder damage (rolled 15, halved)") and FAIL pays FULL
// 3d6 Thunder + Stunned fail-only (Stunned expiry durationNote stays §38
// GM-enforced advisory; demons-succeed-auto §70 not modeled app-wide).
const screamContext = (over = {}) => ({
  saveDc: 15,
  saveType: 'Constitution',
  attackerName: ATTACKER,
  actionName: 'Stunning Scream',
  dcSuccess: screamRow().dc_success,
  autoDamageFormula: '3d6',
  autoDamageDamageType: 'Thunder',
  saveConditions: ['stunned'],
  effectiveBonus: 0,
  ...over,
});

describe('MA-1674 processNpcSave seam: Vrock Stunning Scream dc_success none', () => {
  it('FAIL face (−19 always-fail floor, nat 6): FULL 3d6 (fd 7) + Stunned granted', async () => {
    const result = await processSaveRoll({
      rollType: 'save',
      target: { name: TARGET, type: 'npc' },
      characterName: TARGET,
      campaignName,
      context: { ...screamContext(), effectiveD20: 6 },
      bonus: -19,
      r1: 6, r2: 6,
      logEntry: vi.fn(),
      setPopupHtml: vi.fn(),
    });
    expect(result.saveSuccess).toBe(false);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toContain('stunned');
  });

  it('SUCCESS face (+19 always-success, nat 15): ZERO damage — RAW success pays nothing', async () => {
    const result = await processSaveRoll({
      rollType: 'save',
      target: { name: TARGET, type: 'npc' },
      characterName: TARGET,
      campaignName,
      context: { ...screamContext(), effectiveD20: 15 },
      bonus: 19,
      r1: 15, r2: 15,
      logEntry: vi.fn(),
      setPopupHtml: vi.fn(),
    });
    expect(result.saveSuccess).toBe(true);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
    expect((runtimeStore[`${TARGET}.activeConditions`] || [])).not.toContain('stunned');
  });
});

describe('MA-1673 processPlayerSave seam: Vrock Spores dc_success none', () => {
  async function resolvePlayerSave(saveResult) {
    savePrompt.next = saveResult;
    return processSaveRoll({
      rollType: 'save',
      target: { name: 'AasimarTest', type: 'player' },
      characterName: 'AasimarTest',
      campaignName,
      context: sporesContext(),
      bonus: 19, r1: 15, r2: 15,
      logEntry: vi.fn(),
      setPopupHtml: vi.fn(),
    });
  }

  it('prompt payload carries dcSuccess "none" (not half-default)', async () => {
    await resolvePlayerSave({ success: true, roll: 15, total: 34 });
    expect(savePrompt.lastPayload.dcSuccess).toBe('none');
  });

  it('SUCCESS face pays ZERO on the player prompt (no positive damage applied)', async () => {
    const result = await resolvePlayerSave({ success: true, roll: 15, total: 34 });
    expect(result.saveSuccess).toBe(true);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
  });

  it('FAIL face pays FULL 1d10 on the player prompt', async () => {
    const result = await resolvePlayerSave({ success: false, roll: 6, total: -13 });
    expect(result.saveSuccess).toBe(false);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);
  });
});
