// @maintained-by-ai: 2026-10-14
// MA-2022: Thunderbird legendary_actions[3] "Storm Call (Costs 2 Actions)" shipped
// `delegates_to:"Thunderstrike (Recharge 5-6)"` with NO own save/damage fields — the
// gated press spent 2 legendary uses honestly (MA-1883 name-parse) then routed through
// the MASTER's payload: 12d10 pool, Thunderstrike ledger name, and consumed the master's
// recharge key (MA-1847/MA-1928 delegate-hijack family). Fix is DATA-only (MA-1928
// byte-shape, MA-1872 twin): drop delegates_to, author OWN fields DC 24 / Dexterity /
// 6d8 Lightning / dc_success "none" (RAW "or take" = fail-only; half-default would leak
// §63). Costs-2 rides the NAME parse (MA-1883, monsterLegendaryUses.js:179).
// Recharge decoupling: rechargeUsageOf reads ONLY the pressed row's flat recharge
// (monsterRecharge.js:35) — Storm Call authors none → gate null → the press never
// spends/refuses on Thunderstrike's key; master keeps MA-2017 recharge:"5-6" intact.
// save_effect stays ABSENT (no condition rider — "or omit" per ticket); range stays
// ABSENT (shapeless-inline lane preserved, §211).
// Wing Clap twin (legendary_actions[2]) pinned in
// saveProcessing.ma2021-thunderbird-wing-clap.test.js — Storm Call is deduped THERE;
// this file is the Storm Call authority.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { rechargeUsageOf, monsterRechargeGate, rechargeActionKey } from '../../services/encounters/monsterRecharge.js';
import { legendaryDelegateAction, legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const THUNDERBIRD = monsters.find((m) => m.index === 'thunderbird');
const STORM_CALL = THUNDERBIRD.legendary_actions[3];
const STRIKE = THUNDERBIRD.actions.find((a) => a.name === 'Thunderstrike (Recharge 5-6)');

describe('MA-2022 disk fingerprint: Thunderbird Storm Call self-resolving save row', () => {
  it('RAW identity + own save fields authored + costs-2 name parse — delegates_to GONE (§204/§225 hijack dead)', () => {
    expect(THUNDERBIRD.name).toBe('Thunderbird');
    expect(STORM_CALL.name).toBe('Storm Call (Costs 2 Actions)');
    expect(STORM_CALL.description).toBe('The Thunderbird calls down a single bolt of lightning on one creature within 120 ft. The target must succeed on a DC 24 Dexterity saving throw or take 27 (6d8) Lightning damage.');
    // Own mechanical fields (MA-1928 byte-shape):
    expect(STORM_CALL.save_dc).toBe(24);
    expect(STORM_CALL.save_type).toBe('Dexterity');
    expect(STORM_CALL.damage_dice_primary).toBe('6d8');
    expect(STORM_CALL.damage_type_primary).toBe('Lightning');
    expect(STORM_CALL.dc_success).toBe('none'); // RAW "or take" — no Success:Half (§63 half-leak guard)
    // Costs-2 via the MA-1883 NAME parse (no structured cost field exists on disk):
    expect(legendaryActionCost(STORM_CALL)).toBe(2);
    // No delegate leg reachable: own save_dc > 0 self-resolves, and with delegates_to
    // absent legendaryDelegateAction returns null — the master's 12d10/ledger/AoE lane
    // can never run (MonsterCardModal numeric-self-resolve seam, ma1952 pattern).
    expect(STORM_CALL.delegates_to).toBeUndefined();
    expect(legendaryDelegateAction(THUNDERBIRD, STORM_CALL)).toBeNull();
  });

  it('no save_effect/range/uses/advisory/recharge — no condition rider, shapeless-inline lane, header owns economy, recharge decoupled (§165/§211)', () => {
    expect(STORM_CALL.save_effect).toBeUndefined();
    expect(extractConditionsFromSaveEffect(STORM_CALL.save_effect)).toEqual([]); // no condition payload on either face
    expect(STORM_CALL.range).toBeUndefined();
    expect(STORM_CALL.uses).toBeUndefined();
    expect(STORM_CALL.advisory).toBeUndefined();
    // RECHARGE DECOUPLING: gate is null on Storm Call even with Thunderstrike SPENT —
    // the press never consults, refuses on, or consumes the master's recharge key.
    expect(STORM_CALL.recharge).toBeUndefined();
    expect(rechargeUsageOf(STORM_CALL)).toBeNull();
    expect(monsterRechargeGate(STORM_CALL, { Thunderstrike: { recharged: false, threshold: 5 } })).toBeNull();
  });

  it('master Thunderstrike stays byte-untouched (MA-2017 recharge twin intact)', () => {
    expect(STRIKE.save_dc).toBe(24);
    expect(STRIKE.save_type).toBe('Dexterity');
    expect(STRIKE.damage_dice_primary).toBe('12d10');
    expect(STRIKE.damage_type_primary).toBe('Lightning');
    expect(STRIKE.recharge).toBe('5-6');
    expect(STRIKE.dc_success).toBeUndefined(); // half-on-success RAW-correct on the master — pin its ABSENCE
    expect(rechargeUsageOf(STRIKE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(STRIKE)).toBe('Thunderstrike');
    expect(monsterRechargeGate(STRIKE, { Thunderstrike: { recharged: false, threshold: 5 } }).available).toBe(false);
  });
});

// ── Live-lane unit: saveProcessing NPC-inline branch driven from the disk row's OWN
// bytes (MA-2021 harness mirror, MA-1997 lineage): formula transports as
// autoDamageFormula "6d8" (rollExpression input pinned — never the master's 12d10),
// fail pays FULL Σ6d8, dc_success:"none" success pays ZERO (finalDamage 0).
const runtimeStore = {};

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
  loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Thunderbird 1' }),
  getCurrentCombatRound: () => 2,
  getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 999 - finalDamage }));
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
const TB_NAME = 'Thunderbird 1';

// Deterministic 6d8 pool summing 30 (RAW avg 27).
const MOCK_DAMAGE = { total: 30, rolls: [6, 6, 6, 5, 4, 3], modifier: 0 };

async function rollNpcInline({ targetName, effectiveD20, bonus }) {
  return processSaveRoll({
    rollType: 'save',
    target: { name: targetName, type: 'npc' }, // EB-joined NPC → processNpcSave inline lane
    characterName: targetName,
    campaignName,
    context: {
      attackerName: TB_NAME,
      targetName,
      actionName: STORM_CALL.name,
      saveDc: STORM_CALL.save_dc,
      saveType: STORM_CALL.save_type,
      dcSuccess: STORM_CALL.dc_success, // 'none' straight from disk
      autoDamageFormula: STORM_CALL.damage_dice_primary,
      autoDamageDamageType: STORM_CALL.damage_type_primary,
      saveConditions: extractConditionsFromSaveEffect(STORM_CALL.save_effect),
      effectiveD20,
      effectiveBonus: 0,
    },
    bonus,
    r1: effectiveD20,
    r2: effectiveD20,
    logEntry: vi.fn(),
    setPopupHtml: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  rollExpression.mockReturnValue(MOCK_DAMAGE);
});

describe('MA-2022 live-lane unit: own-fields save — rollExpression pinned to disk formula 6d8', () => {
  it('failed save (raw +0, nat 5 < DC 24, structural fail face): rolls 6d8 (NOT 12d10) and pays FULL pool', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 1', effectiveD20: 5, bonus: 0 });
    expect(saveSuccess).toBe(false);

    const formulas = rollExpression.mock.calls.map(c => c[0]);
    expect(formulas).toContain('6d8');
    expect(formulas).not.toContain('12d10'); // master pool never reachable

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(30); // fail-only: full Σ6d8

    // No condition rider on either face
    expect(runtimeStore['Bandit 1.activeConditions']).toBeUndefined();
  });

  it('successful save (+30 wb rig, deterministic face): dc_success none pays ZERO (finalDamage 0)', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 19, bonus: 30 });
    expect(saveSuccess).toBe(true);

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(0); // none, NOT half (§63 half-leak closed)

    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
  });
});
