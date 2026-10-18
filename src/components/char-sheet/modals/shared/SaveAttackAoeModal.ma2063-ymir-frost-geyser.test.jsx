// @maintained-by-ai
// MA-2063: Ymir "Frost Geyser (Costs 2 Actions)" picker-lane consumer unit — the
// full-struct fix (save_dc/save_type/damage dice+type/range/save_effect + the honest
// appended "Success: half damage." clause) on the LIVE Radius picker seam.
// Pre-fix the row was prose-only (delegates_to:null, zero numeric fields): the MA-1883
// cost lane honestly SPENT 2 uses, then resolveLegendaryRowMechanic dead-ended at
// MonsterCardModal.jsx:776 console.error — zero popup, zero save, zero damage, zero
// Restrained (MA-1974 silent-burn, 2-wide). Post-fix, driven from the disk row's OWN
// bytes through the picker props:
//   picker shape: sphereRadiusFeet parses the description token "20 ft. radius" →
//     Radius-20 GM-placed; range "90 ft." never mis-shapes as an emanation.
//   mixed-confirm face per family canon (#200-#221): one picker, two bandits —
//     FAIL (full-word saveBonuses.dexterity:-19 → any nat ≤1 < DC 24):
//       full 4d8 Cold (Σ=18 mock) AND Restrained granted (activeConditions + meta +
//       `condition applied` grant log; RAW names no duration so the MA-0063 default
//       copy "1 minute…" is the honest §70 residual — fail-only lane, MA-2059 twin).
//     SUCCESS (+30 → any nat ≥31): half damage floor(18/2)=9 — the half-default IS
//       the RAW "Success: half damage." (dc_success UNSET); zero Restrained grant.
//     The ±fold pins make both faces deterministic regardless of RNG draw order; the
//     [0.01,0.01,0.99,0.99] seam (2 raw d20s per save) is the belt.
// costs-2 rides the NAME parse (MA-1883): exactly 2 spent; a 1-remaining pool refuses
// insufficient-cost honestly. Gate vocabulary (turn/own-turn/exhausted) is pinned by
// the monsterLegendaryUses.test.js/ma1579/ma1883 service lanes — not re-pinned here.
// Glacier Wave (MA-2059 twin) row bytes are owned by monsterRecharge.ma2059 —
// not re-pinned here.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

import { extractConditionsFromSaveEffect } from '../../../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../../../services/encounters/monsterAbilityUses.js';
import { legendaryActionCost, legendaryDelegateAction, legendaryExpendGate, legendaryHeaderAction } from '../../../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  // Deterministic 4d8 pool: Σ=18 — the RAW average printed in the row prose.
  rollExpression: vi.fn((f) => (f ? { total: 18, rolls: [6, 4, 4, 4], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 18, rolls: [], modifier: 0 } : null)),
}));
vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({ resolveScaling: vi.fn(() => null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; }),
  };
});
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: runtime.getRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success ? (dcSuccess === 'half' ? Math.floor(raw / 2) : 0) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success ? (dcSuccess === 'half' ? Math.floor(raw / 2) : 0) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const roster = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: roster.current })),
  setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => null) }));
vi.mock('../../../../services/automation/common/damageRollback.js', () => ({ storeSpellLastAttack: vi.fn(), addTargetResult: vi.fn() }));
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));
vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
}));
const seenTargets = vi.hoisted(() => ({ current: [] }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-desc">{description}</div>
        <div className="sp-note-copy">{note}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';

const YMIR = monstersData.find(m => m.index === 'ymir');
const GEYSER = YMIR.legendary_actions[3];
const HEADER = YMIR.legendary_actions[0];
const CLUB = YMIR.legendary_actions[1];
const STOMP = YMIR.legendary_actions[2];

// Pre-fix disk description bytes — the fix APPENDS the half clause and alters none.
const ORIGINAL_DESCRIPTION = 'A pillar of ice erupts at a point within 90 ft. Each creature in a 20 ft. radius must succeed on a DC 24 Dexterity saving throw or take 18 (4d8) Cold damage and be Restrained.';

// Byte-duplicate of MonsterCardModal.jsx sphereRadiusFeet (:55) / emanationRadiusFeet
// (:67) — unexported lanes stay byte-duped, ma1952/ma2022 pattern.
const sphereRadiusFeet = (description) => {
  if (/\bcylinder\b/i.test(description)) return null;
  const m = description.match(/(\d+(?:\.\d+)?)\s*[- ]?(?:foot|feet|ft\.?)?[- ]?radius\b/i);
  return m ? Number(m[1]) : null;
};
const emanationRadiusFeet = (range) => {
  const m = String(range || '').match(/^(\d+(?:\.\d+)?)\s*[- ]?(?:foot|feet|ft\.?)?[- ]?emanation\b/i);
  return m ? Number(m[1]) : null;
};

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderGeyser(props = {}) {
  return render(
    <SaveAttackAoeModal
      action={GEYSER}
      playerStats={{ name: 'Ymir 1' }}
      campaignName="test-campaign"
      range={90}
      damage={GEYSER.damage_dice_primary}
      damageType={GEYSER.damage_type_primary}
      saveType={GEYSER.save_type}
      saveDc={GEYSER.save_dc}
      dcSuccess={GEYSER.dc_success ?? 'half'} // half-default transported (MA-2059 twin)
      titleOverride="20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Ymir 1']}
      rangeGateFt={null}
      saveConditions={extractConditionsFromSaveEffect(GEYSER.save_effect)}
      conditionDurationNote={extractConditionDurationNote(GEYSER.save_effect)}
      storeLastAttack={false}
      onClose={vi.fn()}
      {...props}
    />
  );
}

const grantLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.action === 'applied');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  roster.current = [
    { name: 'Ymir 1', type: 'npc', currentHp: 615, maxHp: 615, saveBonuses: {}, resistances: [], immunities: ['Cold'] },
    // FULL-WORD picker fold key (§163/MA-2033): -19 = any nat ≤ 1 < DC 24 (fail face); +30 = any nat ≥ 31 (success face).
    { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { dexterity: -19 }, resistances: [], immunities: [] },
    { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { dexterity: 30 }, resistances: [], immunities: [] },
  ];
});

describe('MA-2063 disk fingerprint: full struct authored on the row, prose preserved', () => {
  it('row identity, save core, appended half-clause, absent bait, Radius-20 shape, no delegate master', () => {
    expect(GEYSER.name).toBe('Frost Geyser (Costs 2 Actions)');
    expect(GEYSER.save_dc).toBe(24);
    expect(GEYSER.save_type).toBe('Dexterity');
    expect(GEYSER.damage_dice_primary).toBe('4d8');
    expect(GEYSER.damage_type_primary).toBe('Cold');
    expect(GEYSER.range).toBe('90 ft.');
    expect(GEYSER.save_effect).toBe('The target has the Restrained condition.');
    // Numeric child SELF-RESOLVES (§895 predicate precedes delegate leg):
    expect(GEYSER.delegates_to).toBeNull();
    expect(legendaryDelegateAction(YMIR, GEYSER)).toBeNull(); // null key never resolves a master
    // The fix APPENDS the honest half clause — pre-fix prose bytes untouched.
    expect(GEYSER.description).toBe(`${ORIGINAL_DESCRIPTION} Success: half damage.`);
    expect(GEYSER.dc_success).toBeUndefined(); // half-default IS the RAW success leg (§63/MV-20) — behavioral half pinned below
    // header owns economy, recharge stays Glacier Wave's (monsterRecharge.ma2059 lane):
    expect(GEYSER.uses).toBeUndefined();
    expect(GEYSER.advisory).toBeUndefined();
    expect(GEYSER.recharge).toBeUndefined();
    expect(GEYSER.hit_conditions).toBeUndefined();
    expect(GEYSER.attack_bonus).toBeUndefined();
    // picker shape: "20 ft. radius" prose token → Radius-20 GM-placed; range never mis-shapes.
    expect(sphereRadiusFeet(GEYSER.description)).toBe(20);
    expect(emanationRadiusFeet(GEYSER.range)).toBeNull();
  });

  it('economy: header owns uses:3; costs-2 rides the NAME parse; 1-left pool refuses insufficient-cost; siblings inert', () => {
    expect(legendaryHeaderAction(YMIR)).toBe(HEADER);
    expect(HEADER.uses).toBe(3);
    expect(YMIR.legendary_actions.length).toBe(4);
    expect(legendaryActionCost(GEYSER)).toBe(2);
    const full = legendaryExpendGate({ header: HEADER, storedUses: { max: 3, used: 0 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Ymir 1', latch: null, cost: legendaryActionCost(GEYSER) });
    expect(full).toEqual({ allowed: true, remaining: 3, max: 3 });
    const dry = legendaryExpendGate({ header: HEADER, storedUses: { max: 3, used: 2 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Ymir 1', latch: null, cost: legendaryActionCost(GEYSER) });
    expect(dry.allowed).toBe(false);
    expect(dry.reason).toBe('insufficient-cost');
    expect(dry.cost).toBe(2); // 1-remaining < cost-2 — honest refusal, never a 1-credit partial
    // Club/Stomp stay delegates (this row is the only numeric child):
    expect(CLUB.delegates_to).toBe('Glacier Club');
    expect(STOMP.delegates_to).toBe('Stomp');
  });
});

describe('MA-2063 picker mixed-confirm: FAIL face lands full 18 Cold AND Restrained together (was 2-wide silent burn); SAVE face halves only', () => {
  it('pre-confirm inert; one picker, two bandits: Bandit 1 (-19) takes 18 + restrained + default-duration grant log; Bandit 2 (+30) takes floor(18/2)=9, zero grant', async () => {
    spyRandom([0.01, 0.01, 0.99, 0.99]); // canon seam: 2 raw d20s per save; ±fold pins make faces order-proof
    renderGeyser();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    expect(seenTargets.current.map(t => t.name)).toEqual(['Bandit 1', 'Bandit 2']); // GM-placed Radius-20 still lists both, Ymir excluded
    expect(document.querySelector('.sp-header').textContent).toMatch(/20-ft Radius/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/Dexterity/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/DC 24/);
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/On a failed save, target takes 4d8 Cold damage\./);
    expect(copy).toMatch(/On a successful save, target takes half damage\./); // dc_success UNSET → half-default IS RAW
    // Pre-confirm inertness: nothing rolled, no damage, no conditions, no grant log.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(grantLogs()).toHaveLength(0);
    expect(Object.keys(runtime.store).filter(k => /activeCondition/.test(k))).toHaveLength(0);

    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(applyDamageToTarget.mock.calls.filter(c => c[1] === 'Bandit 1' || c[1] === 'Bandit 2')).toHaveLength(2));

    const failCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 1');
    expect(failCall[2]).toBe(18); // fail face: no halve
    expect(failCall[3]).toEqual(expect.arrayContaining(['Cold']));
    const saveCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 2');
    expect(saveCall[2]).toBe(9); // floor(18/2) — half-default matches RAW "Success: half damage."

    // Results UI shows BOTH faces per-target in one panel.
    const results = document.querySelector('.abjure-results-list').textContent;
    expect(results).toMatch(/Failed/);
    expect(results).toMatch(/Saved — takes .*damage \(rolled .*halved\)/);

    // Restrained is fail-ONLY: exactly one grant, on Bandit 1, never Bandit 2.
    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['restrained']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].restrained).toEqual(
      expect.objectContaining({ source: 'Ymir 1', dc: 24 }));
    expect(runtime.store['Bandit 2.activeConditions']).toBeUndefined();
    expect(runtime.store['Bandit 2.activeConditionMeta']).toBeUndefined();
    const grants = grantLogs();
    expect(grants).toHaveLength(1); // non-vacuous: not zero, not a duplicate
    expect(grants[0].characterName).toBe('Bandit 1');
    expect(grants[0].condition).toBe('Restrained');
    expect(grants[0].description).toMatch(/failed the Dexterity save \(DC 24\)/);
    expect(grants[0].description).toMatch(/1 minute/); // MA-0063 default duration copy — RAW authors no duration (§70 residual)
  });
});
