// @maintained-by-ai: 2026-10-14
// MA-1673: Vrock "Spores" on the processSaveRoll seam — this row's unique
// clause contract at both lanes (NPC inline + player prompt). monsters.json
// row (vrock.actions "Spores": Constitution DC 15, dc_success:"none",
// 1d10 Poison, Poisoned fail-only) drives the context; the dc_success:"none"
// DATA fix flows into context.dcSuccess and is consumed at applySaveDamage via
// computeDamageAfterEvasion: FAIL pays FULL 1d10 (rolled 7) + grants Poisoned;
// SUCCESS pays ZERO (fd 0) and grants no condition — closing the MV-20
// half-default leak (§63/§456 family MA-0481/MA-0622/MA-0781) where the
// absent field defaulted 'half' and a saving throw SUCCESS still paid half.
// Data-row prose/key-order and compute-level locks live in
// services/rules/combat/vrock-spores-dc-success.test.js; the Stunning Scream
// twin row (MA-1674) is locked there and at its 1/Day gate in
// encounters/monsterAbilityUses.vrock-stunning-scream.test.js; generic
// fail/success condition legs defer to saveProcessing.failed-save-conditions.test.js.
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

// Faithful three-mode computeDamageAfterEvasion (§87/MA-0367): fail → raw,
// 'half' → floor, 'full' → raw, 'none' → 0.
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  normalizeSaveType: (t) => String(t || '').toLowerCase(),
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

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { processSaveRoll } from './saveProcessing.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const ATTACKER = 'Vrock 1';
const TARGET = 'Bandit 1';
const PLAYER = 'AasimarTest';

// Live disk row transport (post-fix). computeNpcSave reads FULL-word
// saveBonuses (§163); damage type is prose-carried ("1d10 Poison damage" —
// the row ships no damage_type_primary byte).
const sporesRow = monstersData.find(m => m.index === 'vrock').actions.find(a => a.name === 'Spores');

const sporesContext = (over = {}) => ({
  saveDc: sporesRow.save_dc,
  saveType: sporesRow.save_type,
  attackerName: ATTACKER,
  actionName: sporesRow.name,
  dcSuccess: sporesRow.dc_success,
  autoDamageFormula: sporesRow.damage_dice_primary,
  autoDamageDamageType: 'Poison',
  saveConditions: ['poisoned'],
  effectiveBonus: 0,
  ...over,
});

function runNpcSave({ success }) {
  const d20 = success ? 15 : 6;
  return processSaveRoll({
    rollType: 'save',
    target: { name: TARGET, type: 'npc' },
    characterName: TARGET,
    campaignName,
    context: { ...sporesContext(), effectiveD20: d20 },
    bonus: success ? 19 : -19,
    r1: d20, r2: d20,
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

// The player lane resolves via the save prompt (bonus/r1/r2 are ignored
// there — the prompt payload carries the outcome).
function runPlayerSave(saveResult) {
  savePrompt.next = saveResult;
  return processSaveRoll({
    rollType: 'save',
    target: { name: PLAYER, type: 'player' },
    characterName: PLAYER,
    campaignName,
    context: sporesContext(),
    bonus: 19, r1: 15, r2: 15,
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
});

describe('MA-1673 processNpcSave seam: Vrock Spores dc_success none', () => {
  it('FAIL face (−19 always-fail floor, nat 6): FULL 1d10 (fd 7) + Poisoned granted', async () => {
    const result = await runNpcSave({ success: false });
    expect(result.saveSuccess).toBe(false);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);
    expect(runtimeStore[`${TARGET}.activeConditions`]).toContain('poisoned');
  });

  it('SUCCESS face (+19 always-success, nat 15): ZERO damage, no Poisoned grant', async () => {
    // Fix byte must be present for the ZERO to be non-vacuous: if dc_success
    // regressed to absent/'half', the half-default would pay fd 3 instead.
    expect(sporesRow.dc_success).toBe('none');
    const result = await runNpcSave({ success: true });
    expect(result.saveSuccess).toBe(true);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
    expect((runtimeStore[`${TARGET}.activeConditions`] || [])).not.toContain('poisoned');
  });
});

describe('MA-1673 processPlayerSave seam: Vrock Spores dc_success none', () => {
  it('FAIL face pays FULL 1d10 and the prompt payload carries dcSuccess "none" (not half-default)', async () => {
    const result = await runPlayerSave({ success: false, roll: 6, total: -13 });
    expect(savePrompt.lastPayload.dcSuccess).toBe('none');
    expect(result.saveSuccess).toBe(false);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);
  });

  it('SUCCESS face pays ZERO on the player prompt (no positive damage applied)', async () => {
    const result = await runPlayerSave({ success: true, roll: 15, total: 34 });
    expect(savePrompt.lastPayload.dcSuccess).toBe('none');
    expect(result.saveSuccess).toBe(true);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
  });
});
