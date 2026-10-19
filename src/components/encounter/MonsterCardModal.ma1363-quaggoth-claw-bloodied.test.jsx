// @maintained-by-ai
// MA-1363: Quaggoth Claw — modifier-less conditional_damage:{dice:"2d6",damage_type:
// "Slashing",condition:"bloodied"} authored on monsters.json actions[1]: HIT popup offers
// "Bloodied: +2d6 Slashing?" via the MA-0007 GM-adjudication seam (additive: base Done
// still pays 1d6 + 3; grant rolls its own 2d6 leg; 1d6+3 + 2d6 = 3d6+3 RAW face total).
// No auto-bloodied eval (§70 residual; threshold machinery in CreatureHp.jsx:67).
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1160
// template (run2#680):
//   1. Disk-row bytes: full cd-object toEqual identity (no modifier = modifier-0 additive
//      delta, subsuming the old twin-key comparisons — galeb-duhr/giant-elk shapes owned
//      by ma0756/ma0805) + last-key placement (MA-0822) + RAW prose anchor.
//   2. ONE click→rollAttack ctx press (:1407): full 7-key offer identity incl. the
//      byte-distinct bloodied label chrome ("Bloodied: +2d6 Slashing?" — no feet-token
//      head, MA-1363 label generalization; popup display owned by
//      common/AttackResultPopup.ma1363 :105-120) + hitClause toBeNull (bloodied is a
//      pre-condition the GM adjudicates, never an auto-grant hit_conditions rider).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :190-261):
// forward-face :228 (superseded by the stronger full-identity press here), grant :242,
// crit :259, decline :272 — generic mechanics twins of owner Talons bytes. Charge-row
// label loop cut: every row byte-pinned by its own owner (talons charge-bonus :51,
// goat ma0885 :124, seahorse ma0822 :121, baphomet ma1174 :120, skeleton ma1175 :121).
// Dead-mock purge per-lane (bisected :drop→red): diceRoller + rollD20 (rollAttack
// mocked, no roller fires without the cut grant tests), AttackResultPopup stub (popup
// never renders — popupHtml null), never-fired hook members (minimal shape renders per
// ma1160/owner baseline).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
    })),
    _rollAttack,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0 })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const { _rollAttack: rollAttack, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const QUAGGOTH = monsters.find((m) => m.index === 'quaggoth');
const CLAW = QUAGGOTH.actions.find((a) => a.name === 'Claw');

// Exact buildChargeBonusOffer(CLAW, 'Claw') output FROM the disk row — full identity,
// incl. the modifier-0 formula ('2d6', never '2d6 + 0') and MA-1363 static-condition
// label chrome ("Bloodied: +2d6 Slashing?", no feet-token head).
const QUAGGOTH_OFFER = {
  dice: '2d6',
  modifier: 0,
  damageType: 'Slashing',
  condition: 'bloodied',
  formula: '2d6',
  label: 'Bloodied: +2d6 Slashing?',
  attackName: 'Claw',
};

const CREATURES = [
  { name: 'Quaggoth 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderClaw() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Quaggoth', actions: QUAGGOTH.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Quaggoth 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Quaggoth 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1363 monsters.json data lock: Quaggoth Claw Bloodied variant', () => {
  it('authors the modifier-less additive Bloodied clause with last-key placement and RAW prose anchor', () => {
    expect(CLAW.attack_bonus).toBe(5);
    expect(CLAW.damage_dice_primary).toBe('1d6 + 3');
    expect(CLAW.damage_type_primary).toBe('Slashing');
    // Full cd identity — absence of a modifier key marks the modifier-less additive
    // convention (resolver pays base + clause; MA-0756/MA-0805 twin family).
    expect(CLAW.conditional_damage).toEqual({
      dice: '2d6',
      damage_type: 'Slashing',
      condition: 'bloodied',
    });
    const keys = Object.keys(CLAW);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
    expect(CLAW.description).toMatch(/or 13 \(3d6 \+ 3\) Slashing damage if the quaggoth is <strong>Bloodied<\/strong>/);
  });
});

describe('MA-1363 Claw click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +5 chip forwards the full disk offer + null hitClause (bloodied is a pre-condition, never auto-granted)', () => {
    renderClaw();
    const clawRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Claw/.test(a.textContent.trim()));
    const chip = Array.from(clawRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
    expect(chip, 'Expected Claw +5 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(QUAGGOTH_OFFER);
    expect(ctx.hitClause).toBeNull();
  });
});
