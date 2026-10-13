// MA-2063: Ymir "Frost Geyser (Costs 2 Actions)" picker-lane consumer unit — the
// full-struct fix (save_dc/save_type/damage dice+type/range/save_effect + the honest
// appended "Success: half damage." clause) on the LIVE Radius picker seam.
// Pre-fix the row was prose-only (delegates_to:null, zero numeric fields): the MA-1883
// cost lane honestly SPENT 2 uses, then resolveLegendaryRowMechanic dead-ended at
// MonsterCardModal.jsx:776 console.error — zero popup, zero save, zero damage, zero
// Restrained (MA-1974 silent-burn, 2-wide). Post-fix, driven from the disk row's OWN
// bytes (MA-2059 Glacier Wave byte-twin on the same monster):
//   picker shape: breathAoeShape sphereRadiusFeet parses the description token
//     "20 ft. radius" → Radius-20, rangeGateFt null (GM positions the origin;
//     the authored range "90 ft." is emanation-inert — picker NOT mis-shaped).
//   FAIL face (full-word saveBonuses.dexterity:-19 → any nat ≤1 < DC 24):
//     full 4d8 Cold AND restrained granted (activeConditions + meta +
//     `condition applied` grant log).
//   SUCCESS face (+30 → any nat ≥31): half damage floor(Σ/2), NO restrained
//     (fail-only lane, MA-2059 twin) — half-default IS the RAW "Success: half damage."
//   costs-2 rides the NAME parse (MA-1883): gate spends exactly 2, and at a 1-remaining
//   pool refuses insufficient-cost honestly (boundary gates run FIRST, 'turn' intact).
// dc_success UNSET transports the half-default; RAW names no Restrained duration, so
// the picker's MA-0063 default duration copy ("1 minute; repeats the save…") is the
// honest §70 residual (save_effect authors no until-clause — extractConditionDurationNote null).
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
const WAVE = YMIR.actions.find(a => a.name.startsWith('Glacier Wave'));

// Pre-fix disk description bytes — the fix APPENDS the half clause and alters none.
const ORIGINAL_DESCRIPTION = 'A pillar of ice erupts at a point within 90 ft. Each creature in a 20 ft. radius must succeed on a DC 24 Dexterity saving throw or take 18 (4d8) Cold damage and be Restrained.';

// Byte-duplicates of MonsterCardModal.jsx seams (unexported lanes stay byte-duped,
// ma1952/ma2022 pattern): sphereRadiusFeet (:55), emanationRadiusFeet (:67),
// legendaryRowHasNumericMechanic (:744), resolveBlockSaveDcSuccess half-default (:286).
const sphereRadiusFeet = (description) => {
  if (/\bcylinder\b/i.test(description)) return null;
  const m = description.match(/(\d+(?:\.\d+)?)\s*[- ]?(?:foot|feet|ft\.?)?[- ]?radius\b/i);
  return m ? Number(m[1]) : null;
};
const emanationRadiusFeet = (range) => {
  const m = String(range || '').match(/^(\d+(?:\.\d+)?)\s*[- ]?(?:foot|feet|ft\.?)?[- ]?emanation\b/i);
  return m ? Number(m[1]) : null;
};
const numericSelfResolve = (action) =>
  action.attack_bonus != null || Number(action.save_dc) > 0;

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

describe('MA-2063 disk fingerprint: struct authored on the row, prose preserved', () => {
  it('row identity + delegates_to:null pinned + all numeric/save fields authored', () => {
    expect(GEYSER.name).toBe('Frost Geyser (Costs 2 Actions)');
    expect(GEYSER.delegates_to).toBeNull(); // numeric child never delegates (§895 predicate precedes)
    expect(GEYSER.save_dc).toBe(24);
    expect(GEYSER.save_type).toBe('Dexterity');
    expect(GEYSER.damage_dice_primary).toBe('4d8');
    expect(GEYSER.damage_type_primary).toBe('Cold');
    expect(GEYSER.range).toBe('90 ft.');
    expect(GEYSER.save_effect).toBe('The target has the Restrained condition.');
  });

  it('description bytes PRESERVED — only the honest "Success: half damage." clause appended', () => {
    expect(GEYSER.description).toBe(`${ORIGINAL_DESCRIPTION} Success: half damage.`);
    expect(GEYSER.description.startsWith(ORIGINAL_DESCRIPTION)).toBe(true);
  });

  it('dc_success UNSET — half-default IS the RAW success leg (§63/MV-20)', () => {
    expect(GEYSER.dc_success).toBeUndefined();
    expect(Number(GEYSER.save_dc) > 0 ? (GEYSER.dc_success ?? 'half') : null).toBe('half');
  });

  it('save_effect word-scan → [restrained] (§111: conditions ride save_effect ONLY)', () => {
    expect(extractConditionsFromSaveEffect(GEYSER.save_effect)).toEqual(['restrained']);
    expect(extractConditionDurationNote(GEYSER.save_effect)).toBeNull(); // RAW names no duration — MA-0063 default copy is the honest residual
  });

  it('no uses/advisory/recharge/hit_conditions/ability_check bait — header owns economy, recharge stays Glacier Wave\'s', () => {
    expect(GEYSER.uses).toBeUndefined();
    expect(GEYSER.advisory).toBeUndefined();
    expect(GEYSER.recharge).toBeUndefined();
    expect(GEYSER.hit_conditions).toBeUndefined();
    expect(GEYSER.attack_bonus).toBeUndefined();
  });

  it('numeric child SELF-RESOLVES — delegate leg :895 unreachable (predicate true AND delegates_to null)', () => {
    expect(numericSelfResolve(GEYSER)).toBe(true);
    const entersDelegateLeg = !numericSelfResolve(GEYSER) && Boolean(GEYSER.delegates_to);
    expect(entersDelegateLeg).toBe(false);
    expect(legendaryDelegateAction(YMIR, GEYSER)).toBeNull(); // null key never resolves a master
    // extractDamageDiceFromDescription (:934) returns existingDamageDice FIRST → "4d8" byte,
    // NOT the pre-fix prose miss (no Hit:/Failure:/Success: prefix pre-append).
  });

  it('picker shape: "20 ft. radius" prose token → Radius-20 GM-placed; range "90 ft." never mis-shapes', () => {
    expect(sphereRadiusFeet(GEYSER.description)).toBe(20);
    expect(emanationRadiusFeet(GEYSER.range)).toBeNull(); // not an emanation range — radiusAoeFallback never fires on range bytes
  });

  it('costs-2 rides the NAME parse (MA-1883): exactly 2 spent; 1-left pool refuses insufficient-cost', () => {
    expect(legendaryActionCost(GEYSER)).toBe(2);
    const full = legendaryExpendGate({ header: HEADER, storedUses: { max: 3, used: 0 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Ymir 1', latch: null, cost: legendaryActionCost(GEYSER) });
    expect(full).toEqual({ allowed: true, remaining: 3, max: 3 });
    const dry = legendaryExpendGate({ header: HEADER, storedUses: { max: 3, used: 2 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Ymir 1', latch: null, cost: legendaryActionCost(GEYSER) });
    expect(dry.allowed).toBe(false);
    expect(dry.reason).toBe('insufficient-cost');
    expect(dry.cost).toBe(2);
    // boundary gates run FIRST — same-boundary refire keeps its honest 'turn' vocabulary
    const latched = legendaryExpendGate({ header: HEADER, storedUses: { max: 3, used: 1 }, round: 2, activeCreatureName: 'Bandit 1', monsterName: 'Ymir 1', latch: { round: 2, activeCreature: 'Bandit 1' }, cost: legendaryActionCost(GEYSER) });
    expect(latched.allowed).toBe(false);
    expect(latched.reason).toBe('turn');
    // own-turn gate intact
    expect(legendaryExpendGate({ header: HEADER, storedUses: { max: 3, used: 0 }, round: 2, activeCreatureName: 'Ymir 1', monsterName: 'Ymir 1', latch: null, cost: 2 }).reason).toBe('own-turn');
  });

  it('siblings byte-inert: uses:3 header, Club/Stomp delegates, Glacier Wave MA-2059 twin', () => {
    expect(legendaryHeaderAction(YMIR)).toBe(HEADER);
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(CLUB.delegates_to).toBe('Glacier Club');
    expect(STOMP.delegates_to).toBe('Stomp');
    expect(WAVE.recharge).toBe('5-6');
    expect(WAVE.save_dc).toBe(26);
    expect(WAVE.damage_dice_primary).toBe('14d10');
    expect(WAVE.save_effect).toBe('The target has the Restrained condition until the end of its next turn.');
    expect(YMIR.legendary_actions.length).toBe(4);
  });
});

describe('MA-2063 picker fail face: full 4d8 Cold AND Restrained lands together (was 2-wide silent burn)', () => {
  it('failed DEX save (dexterity:-19, deterministic): full 18 Cold + restrained activeConditions + meta + grant log', async () => {
    roster.current = roster.current.filter(c => c.name === 'Ymir 1' || c.name === 'Bandit 1');
    spyRandom([0.01, 0.01, 0.5, 0.5]);
    renderGeyser();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    expect(document.querySelector('.sp-header').textContent).toMatch(/20-ft Radius/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/Dexterity/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/DC 24/);
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/On a failed save, target takes 4d8 Cold damage\./);
    expect(copy).toMatch(/On a successful save, target takes half damage\./);
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalled());
    const failCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 1');
    expect(failCall).toBeTruthy();
    expect(failCall[2]).toBe(18); // fail face: no halve
    expect(failCall[3]).toEqual(expect.arrayContaining(['Cold']));

    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['restrained']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].restrained).toEqual(
      expect.objectContaining({ source: 'Ymir 1', dc: 24 }));
    const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied' && /Bandit 1/.test(String(e.description)));
    expect(condLog).toBeTruthy();
    expect(condLog.condition).toBe('Restrained');
    expect(condLog.description).toMatch(/failed the Dexterity save \(DC 24\)/);
    expect(condLog.description).toMatch(/1 minute/); // MA-0063 default duration copy — RAW authors no duration (§70 residual)
  });
});

describe('MA-2063 picker success face: half damage floor, zero Restrained grant (fail-only lane)', () => {
  it('saved (dexterity:+30, deterministic): floor(18/2)=9 applied, no restrained, no grant log', async () => {
    roster.current = roster.current.filter(c => c.name === 'Ymir 1' || c.name === 'Bandit 2');
    spyRandom([0.9, 0.9, 0.5, 0.5]);
    renderGeyser();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(document.querySelector('.abjure-result-success')).toBeTruthy());
    expect(document.querySelector('.abjure-results-list').textContent).toMatch(/Saved — takes .*damage \(rolled .*halved\)/);
    const saveCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 2');
    expect(saveCall).toBeTruthy();
    expect(saveCall[2]).toBe(9); // floor(18/2) — half-default matches RAW "Success: half damage."
    expect(runtime.store['Bandit 2.activeConditions']).toBeUndefined();
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
  });
});
