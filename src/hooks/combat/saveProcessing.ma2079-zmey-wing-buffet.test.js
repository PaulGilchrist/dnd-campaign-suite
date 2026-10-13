// MA-2079: Zmey Gorynych legendary_actions[3] "Wing Buffet (Costs 2 Actions)" shipped
// `delegates_to:"Triple Fire Breath (Recharge 5-6)"` with NO own save/damage fields —
// the gated press spent 2 legendary uses honestly (MA-1883 name-parse) then routed
// through the MASTER's payload wholesale: picker opened "90-ft Cone … 11d8 Fire …
// DC 23" (live pre-fix fingerprint; child prose says 60-foot Cone / RAW 2d8), roll
// button + ledger carried the master name ("Triple Fire Breath (Recharge 5-6)",
// live repro 45 raw, Bandit hpΔ −45), MA-2022 thunderbird storm-call hijack twin.
// Fix is DATA-only (MA-2022 storm-call pattern): drop delegates_to, author OWN
// fields save_dc 23 / save_type Dexterity / damage_dice_primary "2d8" /
// damage_type_primary "Fire". dc_success stays UNSET — RAW "Success: Half damage"
// is the engine half-default (MA-2045 twin; NOT fail-only, so NOT dc_success:"none").
// Range stays ABSENT — picker shape parses from the CHILD description's "60-foot Cone"
// (MA-2033 picker-lane prose shape). Numeric save child self-suppresses its Expend
// chip (§204/§507); costs-2 rides the NAME parse; recharge decoupled:
// rechargeUsageOf reads ONLY the pressed row's flat recharge (monsterRecharge.js:35)
// → gate null → press never consults the master's key. Master Triple Fire Breath is
// byte-untouched (its missing recharge:"5-6" field is MA-2081 queue — absence pinned
// here as pending, NOT authored here). §384: stale delegate sibling-pin inverted in the
// MA-2078 dust-storm twin same pass.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { rechargeUsageOf, monsterRechargeGate, rechargeActionKey } from '../../services/encounters/monsterRecharge.js';
import { legendaryDelegateAction, legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ZMEY = monsters.find((m) => m.index === 'zmey-gorynych');
const WING = ZMEY.legendary_actions[3];
const BREATH = ZMEY.actions.find((a) => a.name === 'Triple Fire Breath (Recharge 5-6)');

describe('MA-2079 disk fingerprint: Zmey Wing Buffet self-resolving save row', () => {
  it('row identity + description stay RAW byte-identical (§383 anchor innocence)', () => {
    expect(ZMEY.name).toBe('Zmey Gorynych');
    expect(WING.name).toBe('Wing Buffet (Costs 2 Actions)');
    expect(WING.description).toBe('Zmey Gorynych beats his wings in a wide arc, exhaling fire in a 60-foot Cone. Each creature in the area must succeed on a DC 23 Dexterity saving throw or take 11 (2d8) Fire damage.');
    expect(WING.description).toContain('60-foot Cone'); // picker-lane prose shape source (MA-2033)
    expect(WING.description).not.toContain('90'); // master's 90-ft shape never leaked into the child
  });

  it('own save fields authored: DC 23 Dexterity, 2d8 Fire — dc_success ABSENT (half-default, RAW half-on-success)', () => {
    expect(WING.save_dc).toBe(23);
    expect(WING.save_type).toBe('Dexterity');
    expect(WING.damage_dice_primary).toBe('2d8');
    expect(WING.damage_type_primary).toBe('Fire');
    expect(WING.dc_success).toBeUndefined(); // RAW half on success = engine default (MA-2045 unset pattern)
  });

  it('delegates_to is GONE — the master 11d8/90-ft/ledger/AoE hijack is dead (§204/§225)', () => {
    expect(WING.delegates_to).toBeUndefined();
    expect(legendaryDelegateAction(ZMEY, WING)).toBeNull(); // no delegate leg reachable
    // Byte-duplicate of legendaryRowHasNumericMechanic (MonsterCardModal.jsx:744,
    // ma2022 pattern): own save_dc > 0 self-resolves — :895 delegate lane never runs.
    const numericSelfResolve = (action) => {
      if (action.attack_bonus != null || Number(action.save_dc) > 0) return true;
      return false; // pre-fix zero-own-fields fingerprint (MA-2045 refinement axis)
    };
    expect(numericSelfResolve(WING)).toBe(true);
    const entersDelegateLeg = !numericSelfResolve(WING) && Boolean(WING.delegates_to);
    expect(entersDelegateLeg).toBe(false);
  });

  it('costs-2 rides the NAME parse (MA-1883 live): press spends exactly 2', () => {
    expect(legendaryActionCost(WING)).toBe(2);
  });

  it('no save_effect/range/uses/advisory/recharge — no condition rider, prose-shape picker lane, header owns economy, recharge decoupled (§165/§211)', () => {
    expect(WING.save_effect).toBeUndefined();
    expect(extractConditionsFromSaveEffect(WING.save_effect)).toEqual([]); // no condition payload on either face
    expect(WING.range).toBeUndefined(); // shape parsed from CHILD description "60-foot Cone"
    expect(WING.uses).toBeUndefined();
    expect(WING.advisory).toBeUndefined();
    // RECHARGE DECOUPLING: gate is null on Wing Buffet even with the master key
    // SPENT — the press never consults, refuses on, or consumes it.
    expect(WING.recharge).toBeUndefined();
    expect(rechargeUsageOf(WING)).toBeNull();
    expect(monsterRechargeGate(WING, { 'Triple Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
  });

  it('master Triple Fire Breath fixed by MA-2081 same-pass: recharge:"5-6" authored, 11d8 core byte-kept', () => {
    expect(BREATH.save_dc).toBe(23);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('11d8');
    expect(BREATH.damage_type_primary).toBe('Fire');
    expect(BREATH.description).toBe('Dexterity Saving Throw: DC 23, each creature in a 90-foot Cone. Failure: 49 (11d8) Fire damage. Success: Half damage.');
    expect(BREATH.dc_success).toBeUndefined(); // master "Success: Half" half-default pinned as-is
    expect(BREATH.recharge).toBe('5-6'); // §384 inverted: MA-2081 authored the flat field (was pending name-only)
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 }); // gate now LIVE on the master row
    expect(rechargeActionKey(BREATH)).toBe('Triple Fire Breath');
  });
});

// ── Live-lane unit: saveProcessing NPC-inline branch driven from the disk row's OWN
// bytes (ma2022 harness mirror, MA-1997 lineage): formula transports as
// damage_dice_primary "2d8" (rollExpression input pinned — NEVER the master's 11d8),
// fail pays FULL Σ2d8, dc_success UNSET half-default pays floor(Σ/2) on success.
const runtimeStore = {};
const addEntryLogs = [];

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
  addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
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

function saveContextFromRow({ targetName, effectiveD20 }) {
  return {
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
  };
}

async function rollNpcInline({ targetName, effectiveD20, bonus }) {
  return processSaveRoll({
    rollType: 'save',
    target: { name: targetName, type: 'npc' }, // EB-joined NPC → processNpcSave inline lane
    characterName: targetName,
    campaignName,
    context: saveContextFromRow({ targetName, effectiveD20 }),
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
  addEntryLogs.length = 0;
  rollExpression.mockReturnValue(MOCK_DAMAGE);
});

describe('MA-2079 live-lane unit: own-fields save — rollExpression pinned to disk formula 2d8, never 11d8', () => {
  it('failed save (Bandit dex +1, even nat 20 = 21 < DC 23 — structural fail): rolls 2d8 (NOT 11d8) and pays FULL pool', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 1', effectiveD20: 20, bonus: 1 });
    expect(saveSuccess).toBe(false); // 21 < 23 — raw +1 caps below DC structurally

    const formulas = rollExpression.mock.calls.map(c => c[0]);
    expect(formulas).toContain('2d8');
    expect(formulas).not.toContain('11d8'); // master pool never reachable

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(13); // full Σ2d8 (≤16 face)

    // No condition rider on either face
    expect(runtimeStore['Bandit 1.activeConditions']).toBeUndefined();
  });

  it('successful save (+30 rig, deterministic face): half-default pays floor(13/2)=6', async () => {
    const { saveSuccess } = await rollNpcInline({ targetName: 'Bandit 2', effectiveD20: 19, bonus: 30 });
    expect(saveSuccess).toBe(true);

    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget.mock.calls[0][2]).toBe(6); // half-default (dc_success UNSET)

    expect(runtimeStore['Bandit 2.activeConditions']).toBeUndefined();
  });
});
