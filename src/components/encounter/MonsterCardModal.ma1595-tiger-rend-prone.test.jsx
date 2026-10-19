// @maintained-by-ai
// MA-1595: Tiger "Rend" — prose carries "If the target is a Large or smaller creature,
// it has the Prone condition" but the row shipped WITHOUT hit_conditions, so
// buildHitConditionClause returned null and the rider was structurally inert (MA-1555
// Swarm-of-Grasping-Hands / MA-1541 Thunderbolt prose-only lane). One-field DATA fix:
// hit_conditions:["prone"] after damage_type_primary (MA-1534 Boulder byte-shape). Size
// gate stays the family-wide Large-or-smaller consumer gate (§1116): "Large or smaller"
// RAW matches byte-identically here; NO size_gate field invented (zero consumers).
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained
// ma1555/ma1569/ma1573 modal template:
//   1. Disk-row bytes: FULL-row toEqual (base legs + hit_conditions tail + RAW prose,
//      byte-exact; exhaustiveness also locks the ABSENCE of save/escape_dc/
//      hit_target_effect/hit_choice/size_gate decoys) + exact key placement + same-monster
//      inert guard (Nimble Escape bonus action stays clause-less two-key bytes — this
//      monster's own rows, foreign siblings never re-pinned here).
//   2. ONE click→rollAttack ctx press (MonsterCardModal.jsx:1156/:1180/:1407): the Rend
//      +5 chip forwards the plain prone auto-grant hitClause alongside the verbatim
//      '2d6 + 3' auto-damage formula; chargeBonusOffer stays null — a plain-prone row
//      never arms the conditional-damage offer lane.
// Cut (owner cites): prone landing on the victim (condition write + provenance meta with
// no escape DC + "Rend (escape DC —)" condition-applied log + already-prone dedupe) —
// owned by handlePlainDamage.hitClause.test.js (:304 provenance grant, :366 clause-absent
// miss flow, :393 dedupe; wolf/winter-wolf prone rows :280-281 byte-shape-identical) and
// handlePlainDamage.ma1555-swarm-prone-rider.test.js:160 (prone-only landing twin);
// direct buildHitConditionClause unit test — subsumed by the ctx hitClause toEqual;
// attackRowMissingToHit truth table — ma0286 :89-113; foreign sibling row bytes —
// grasping-hands ma1555, boulder ma1534, winter-wolf ma1723 each byte-pinned by owner.
// Cross-file rec: tiger is ABSENT from hitClause.test.js HIT_CLAUSE_ROWS (:224-282) —
// add ['tiger','Rend',5,'2d6 + 3','Slashing',['prone'],null,null] there.
// Dead-mock purge per ma1552 baseline: diceRoller stub (rollAttack mocked, no roller
// fires), AttackResultPopup stub (popup never renders — popupHtml stays null), never-fired
// hook members (minimal shape renders per ma1160/ma1363). Bisect 2026-10-18: dropping
// useLoggedDiceRoll or damageUtils => RED (press-critical); sanitize/logService/
// conditionEffects/rangeValidation/mapsService/useRuntimeState stay green solo but stay
// mocked per the maintained-family hermetic baseline (unmocked = real fetch/log side
// effects in jsdom) — identical suite in maintained ma1555/ma1569/ma1573.
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
const TIGER = monsters.find((m) => m.index === 'tiger');
const REND = TIGER.actions.find((a) => a.name === 'Rend');
const NIMBLE = TIGER.bonus_actions.find((a) => a.name === 'Nimble Escape');

// Exact disk row, byte-for-byte — full-row toEqual locks every rider at once: base legs
// (+5, reach 5 ft., 2d6 + 3 Slashing), the MA-1541/MA-1534 hit_conditions tail, and the
// RAW prose with the fixed Prone sentence. Exhaustiveness also locks the ABSENCE of
// save_dc/save_type/save_effect/escape_dc/hit_target_effect/hit_choice decoys and of any
// invented size_gate field (§1116: Large-or-smaller stays the consumer-side gate).
const FULL_ROW = {
  name: 'Rend',
  description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.',
  attack_bonus: 5,
  reach: '5 ft.',
  damage_dice_primary: '2d6 + 3',
  damage_type_primary: 'Slashing',
  hit_conditions: ['prone'],
};

// Exact buildHitConditionClause(REND) output relayed into the roll ctx — plain prone
// auto-grant, no escape DC, no targetEffect (MA-1541 pure hit_conditions lane). Landing
// on the victim owned by handlePlainDamage.hitClause.test.js / ma1555-swarm-prone-rider.
const PRONE_CLAUSE = {
  conditions: ['prone'],
  escapeDc: null,
  attackName: 'Rend',
  targetEffect: null,
};

const CREATURES = [
  { name: 'Tiger 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderTiger() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Tiger', size: 'Large', actions: TIGER.actions, bonus_actions: TIGER.bonus_actions });
  damageUtils.__setFindCreatureReturn({ name: 'Tiger 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Tiger 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1595 monsters.json data lock: Tiger Rend hit_conditions fix', () => {
  it('authors the full byte-exact row: hit_conditions ["prone"] as the sole tail key after damage_type_primary, same-monster rider guard', () => {
    expect(TIGER.actions.map((a) => a.name)).toEqual(['Rend']);
    expect(REND).toEqual(FULL_ROW);
    // Key placement: hit_conditions immediately after damage_type_primary (MA-1534 shape).
    expect(Object.keys(REND)).toEqual(['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions']);
    // RAW prose anchor for the fixed rider (Large-or-smaller §1116 byte-match).
    expect(REND.description).toMatch(/If the target is a Large or smaller creature, it has the Prone condition\./);
    // Same-monster inert guard: the rider is Rend-row-only — the Nimble Escape bonus
    // action stays its two-key base row, never a fake hit-rider.
    expect(NIMBLE).toEqual({ name: 'Nimble Escape', description: 'The tiger takes the Disengage or Hide action.' });
    expect(NIMBLE.hit_conditions).toBeUndefined();
    expect(NIMBLE.attack_bonus).toBeUndefined();
  });
});

describe('MA-1595 Rend chip→ctx forward (MonsterCardModal.jsx:1156/:1180/:1407)', () => {
  it('clicking the single +5 chip forwards the plain prone auto-grant hitClause with 2d6 + 3 auto-damage and NO charge offer', () => {
    const { container } = renderTiger();
    const row = Array.from(container.querySelectorAll('.mc-action')).find((a) => /^Rend\b/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
    expect(chip, 'Expected Rend +5 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.hitClause).toEqual(PRONE_CLAUSE);
    expect(ctx.autoDamageFormula).toBe('2d6 + 3');
    // Plain-prone row: conditional_damage lane never arms — offer stays null.
    expect(ctx.chargeBonusOffer).toBeNull();
  });
});
