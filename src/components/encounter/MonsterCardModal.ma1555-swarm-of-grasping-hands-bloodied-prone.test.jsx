// @maintained-by-ai
// MA-1555: Swarm of Crawling Claws "Swarm of Grasping Hands" — two inert prose riders
// fixed on monsters.json actions[0]: (1) Bloodied 11 (2d8 + 2) Necrotic variant rides the
// live MA-0007 GM-adjudication seam via conditional_damage (buildChargeBonusOffer arms on
// cd?.dice — Helpers:687), byte-shape mirrors the modifier-bearing MA-0485 Chimera twin
// (separate numeric modifier key; NEVER embedded in the dice string); (2) Medium-or-smaller
// → Prone rider rides the MA-1541/MA-1534 hit_conditions lane (buildHitConditionClause →
// applyHitClauseConditions, handlePlainDamage.js:553). Seam is ADDITIVE (MA-1160): base
// Done still pays 4d8 + 2; grant rolls its own 2d8 + 2 bonus leg — RAW full-variant
// replacement caveat accepted exactly like swarm-family twins MA-1552/1553/1554.
// Consumer size gate is Large-or-smaller (§1116): Medium Bandit passes; no size-cap field
// exists on the hit_conditions lane (hit_pull size_limit is pull-lane-only) — plain prone.
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1552/ma1553
// template, with this family's ONLY hit_conditions row as the distinct payload:
//   1. Disk-row bytes: full cd-object toEqual identity incl. the modifier-bearing shape
//      (modifier:2 separate key — the swarm family's only modifier twin; cd key order
//      pinned inline instead of a foreign-row comparison vs chimera) + base legs +
//      key placement (cd after damage_type_primary, hit_conditions LAST) + RAW prose
//      regexes for both distinct sentences (Bloodied variant + Prone rider).
//      escape_dc/hit_target_effect absence pinned by owner
//      handlePlainDamage.ma1555-swarm-prone-rider.test.js :143 (same row, same lane).
//   2. ONE click→rollAttack ctx press (MonsterCardModal.jsx:1407): full 7-key offer
//      identity incl. this monster's distinct label chrome ("Bloodied: +2d8+2 Necrotic?" —
//      modifier-bearing clause renders +2 in the label, unlike the modifier-less swarm
//      twins) AND full hitClause toEqual — NOT the family's toBeNull: this is the only
//      swarm row carrying a two-condition payload (offer + auto-grant prone rider).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of owner Talons bytes;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363 :105-120;
// direct buildChargeBonusOffer/buildHitConditionClause label tests — subsumed by the
// ctx offer/hitClause toEqual. Charge-row label loop cut: every row byte-pinned by its
// own owner (talons charge-bonus :51, goat ma0885 :124, quaggoth ma1363 :158,
// bats ma1552, beetles ma1553). Sibling swarm row loop cut: rats/ravens owned by
// ma1565/ma1566. attackRowMissingToHit truth table owned by ma0286 helper owner.
// Prone landing on the victim (condition write + provenance + log) owned by
// handlePlainDamage.ma1555-swarm-prone-rider.test.js :160.
// Dead-mock purge per ma1552 baseline: diceRoller stub (rollAttack mocked, no roller fires
// without the cut grant tests), AttackResultPopup stub (popup never renders — popupHtml null),
// never-fired hook members (minimal shape renders per ma1160/ma1363).
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-crawling-claws');
const GRASPING = SWARM.actions.find((a) => a.name === 'Swarm of Grasping Hands');

// Exact buildChargeBonusOffer(GRASPING, 'Swarm of Grasping Hands') output FROM the disk
// row — full identity, incl. the modifier-bearing formula ('2d8 + 2', MA-0485 shape) and
// the condition-text label chrome ("Bloodied: +2d8+2 Necrotic?", no feet-token head,
// MA-1363 label generalization with the +2 modifier token — swarm-family distinct).
const GRASPING_OFFER = {
  dice: '2d8',
  modifier: 2,
  damageType: 'Necrotic',
  condition: 'Bloodied',
  formula: '2d8 + 2',
  label: 'Bloodied: +2d8+2 Necrotic?',
  attackName: 'Swarm of Grasping Hands',
};

// Exact buildHitConditionClause(GRASPING) output — the family's ONLY non-null hitClause:
// plain prone auto-grant, no escape DC, no targetEffect (MA-1541 pure hit_conditions lane).
const PRONE_CLAUSE = {
  conditions: ['prone'],
  escapeDc: null,
  attackName: 'Swarm of Grasping Hands',
  targetEffect: null,
};

const CREATURES = [
  { name: 'Swarm of Crawling Claws 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function renderGrasping() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Crawling Claws', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Crawling Claws 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Crawling Claws 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1555 monsters.json data lock: Swarm of Grasping Hands dual-rider fix', () => {
  it('authors the modifier-bearing Bloodied cd + prone hit_conditions with RAW prose anchors and key placement', () => {
    expect(GRASPING.attack_bonus).toBe(4);
    expect(GRASPING.reach).toBe('5 ft.');
    expect(GRASPING.damage_dice_primary).toBe('4d8 + 2');
    expect(GRASPING.damage_type_primary).toBe('Necrotic');
    // Full cd identity — the modifier-bearing MA-0485 byte-shape (separate numeric
    // modifier key, dice string never carries '+'), unlike the modifier-less swarm twins.
    expect(GRASPING.conditional_damage).toEqual({
      dice: '2d8',
      modifier: 2,
      damage_type: 'Necrotic',
      condition: 'Bloodied',
    });
    expect(Object.keys(GRASPING.conditional_damage)).toEqual(['dice', 'modifier', 'damage_type', 'condition']);
    // Key placement: cd immediately after damage_type_primary; hit_conditions LAST.
    const keys = Object.keys(GRASPING);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');
    // Distinct seam: the family's ONLY hit_conditions row — plain prone auto-grant.
    expect(GRASPING.hit_conditions).toEqual(['prone']);
    // RAW prose anchors for both fixed riders.
    expect(GRASPING.description).toMatch(/or 11 \(2d8 \+ 2\) Necrotic damage if the swarm is Bloodied/);
    expect(GRASPING.description).toMatch(/If the target is a Medium or smaller creature, it has the Prone condition\./);
  });
});

describe('MA-1555 Grasping Hands click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +4 chip forwards the full disk offer AND the prone hitClause (the family\'s only two-condition row)', () => {
    renderGrasping();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Swarm of Grasping Hands/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
    expect(chip, 'Expected Swarm of Grasping Hands +4 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(GRASPING_OFFER);
    // NOT toBeNull like the Bloodied-only swarm twins — prone lands via handlePlainDamage
    // (own lane test, not re-pinned here).
    expect(ctx.hitClause).toEqual(PRONE_CLAUSE);
  });
});
