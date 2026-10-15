// @maintained-by-ai: 2026-10-14
// MA-2079: Zmey Gorynych "Wing Buffet (Costs 2 Actions)" shipped delegates_to
// "Triple Fire Breath (Recharge 5-6)" with NO own save/damage fields — the gated
// press spent 2 legendary uses honestly (MA-1883 name-parse) then rode the MASTER
// payload wholesale: picker opened "90-ft Cone … 11d8 Fire … DC 23", roll button +
// ledger carried the master name (MA-2022 thunderbird storm-call hijack twin).
// Fix is DATA-only (MA-2022 pattern): drop delegates_to, author OWN fields
// save_dc 23 / save_type Dexterity / damage_dice_primary "2d8" /
// damage_type_primary "Fire". dc_success stays UNSET — RAW "Success: Half damage"
// is the engine half-default (MA-2045 unset pattern). Range stays ABSENT — picker
// shape parses from the CHILD description's "60-foot Cone" (MA-2033). Costs-2
// rides the name parse; recharge decoupled: rechargeUsageOf reads ONLY the
// pressed row's flat recharge (monsterRecharge.js) → gate null → the press never
// consults the master's key. This file owns the Wing Buffet row: master Triple
// Fire Breath fingerprint + live recharge lane live in
// monsterRecharge.ma2081-zmey-triple-fire-breath.test.js; Dust Storm sibling in
// the ma2078 twin.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { legendaryDelegateAction, legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ZMEY = monsters.find((m) => m.index === 'zmey-gorynych');
const WING = ZMEY.legendary_actions[3];

describe('MA-2079 disk fingerprint: Zmey Wing Buffet self-resolving save row', () => {
  it('own save fields authored on RAW-identical row, delegates_to GONE, costs-2 name parse', () => {
    expect(ZMEY.name).toBe('Zmey Gorynych');
    expect(WING.name).toBe('Wing Buffet (Costs 2 Actions)');
    expect(WING.description).toBe('Zmey Gorynych beats his wings in a wide arc, exhaling fire in a 60-foot Cone. Each creature in the area must succeed on a DC 23 Dexterity saving throw or take 11 (2d8) Fire damage.');
    expect(WING.description).toContain('60-foot Cone'); // picker-lane prose shape source (MA-2033)
    expect(WING.description).not.toContain('90'); // master's 90-ft shape never leaked into the child

    expect(WING.save_dc).toBe(23);
    expect(WING.save_type).toBe('Dexterity');
    expect(WING.damage_dice_primary).toBe('2d8');
    expect(WING.damage_type_primary).toBe('Fire');
    expect(WING.dc_success).toBeUndefined(); // RAW half on success = engine default (MA-2045)

    expect(WING.delegates_to).toBeUndefined();
    expect(legendaryDelegateAction(ZMEY, WING)).toBeNull(); // no delegate leg reachable: own save_dc > 0 self-resolves (§204/§225)
    expect(legendaryActionCost(WING)).toBe(2); // MA-1883 live: press spends exactly 2
  });

  it('nothing else rides the row — no condition payload, prose-shape picker, recharge decoupled even with the master key SPENT (§165/§211)', () => {
    expect(WING.save_effect).toBeUndefined();
    expect(extractConditionsFromSaveEffect(WING.save_effect)).toEqual([]); // no condition payload on either face
    expect(WING.range).toBeUndefined(); // shape parsed from CHILD description "60-foot Cone"
    expect(WING.uses).toBeUndefined();
    expect(WING.advisory).toBeUndefined();
    expect(WING.recharge).toBeUndefined();
    expect(rechargeUsageOf(WING)).toBeNull();
    expect(monsterRechargeGate(WING, { 'Triple Fire Breath': { recharged: false, threshold: 5 } })).toBeNull(); // press never consults, refuses on, or consumes the master's gate
  });
});

// ── Live-lane unit: processSaveRoll NPC-inline branch driven from the disk row's
// OWN bytes (ma2022 harness mirror): formula transports as damage_dice_primary
// "2d8" — NEVER the master's 11d8 — fail pays FULL Σ2d8, dc_success UNSET
// half-default pays floor(Σ/2) on success, and the ledger carries the CHILD name.
const runtimeStore = {};
const saveLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
  default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: () => Promise.resolve(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Bandit 1' }),
  getCurrentCombatRound: () => 2,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 99 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  normalizeSaveType: (t) => String(t || '').toUpperCase(),
  computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
  computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
    (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
      : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
  applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
  isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasIgnoreResistance: () => false,
  playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
}));

import { processSaveRoll } from './saveProcessing.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

const campaignName = 'test-campaign';
const ZMEY_NAME = 'Zmey Gorynych 1';

// Deterministic 2d8 pool (live fail face lands ≤16 there).
const MOCK_DAMAGE = { total: 13, rolls: [7, 6], modifier: 0 };

async function rollNpcInline({ targetName, effectiveD20, bonus }) {
  return processSaveRoll({
    rollType: 'save',
    target: { name: targetName, type: 'npc' }, // EB-joined NPC → processNpcSave inline lane
    characterName: targetName,
    campaignName,
    context: {
      attackerName: ZMEY_NAME,
      targetName,
      actionName: WING.name,
      saveDc: WING.save_dc,
      saveType: WING.save_type,
      dcSuccess: 'half', // untouched default transport (row authors no dc_success)
      autoDamageFormula: WING.damage_dice_primary,
      autoDamageDamageType: WING.damage_type_primary,
      saveConditions: extractConditionsFromSaveEffect(WING.save_effect),
      effectiveD20,
      effectiveBonus: 0,
    },
    bonus,
    r1: effectiveD20,
    r2: effectiveD20,
    logEntry: (entry) => saveLogs.push(entry),
    setPopupHtml: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  saveLogs.length = 0;
  rollExpression.mockReturnValue(MOCK_DAMAGE);
});

describe('MA-2079 live-lane unit: own-fields save — rollExpression + ledger pinned to the CHILD row, never the master', () => {
  it('failed save (Bandit dex +1, even nat 20 = 21 < DC 23): rolls 2d8 (NOT 11d8), pays FULL pool, ledger carries Wing Buffet name, zero conditions', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 1', effectiveD20: 20, bonus: 1 });
    expect(saveSuccess).toBe(false); // 21 < 23 — raw +1 caps below DC structurally

    const formulas = rollExpression.mock.calls.map(c => c[0]);
    expect(formulas).toEqual(['2d8']); // master pool never reachable

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(13); // full Σ2d8 (≤16 face)

    const dmgLog = saveLogs.find(e => e.rollType === 'save-damage'); // pre-fix: ledger name was "Triple Fire Breath (Recharge 5-6)"
    expect(dmgLog.name).toBe('Wing Buffet (Costs 2 Actions)');
    expect(dmgLog.formula).toBe('2d8');

    expect(runtimeStore['Bandit 1.activeConditions']).toBeUndefined(); // no condition rider on either face
  });

  it('successful save (+30 rig): half-default pays floor(13/2)=6, zero conditions', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 19, bonus: 30 });
    expect(saveSuccess).toBe(true);

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(6); // half-default (dc_success UNSET)

    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
  });
});
