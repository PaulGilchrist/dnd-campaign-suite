// @maintained-by-ai
// MA-1569: Swarm of Stirges "Swarm of Proboscises" — three inert prose riders fixed on
// monsters.json actions[0]: (1) Bloodied 8 (1d10 + 3) Piercing variant rides the live
// MA-0007/MA-1363 GM-adjudication seam via conditional_damage (buildChargeBonusOffer arms
// on cd?.dice — Helpers:687; modifier-bearing MA-0485/MA-1555 byte-shape — separate
// numeric modifier key, NEVER embedded "+" in dice); (2) Medium-or-smaller hit → Grappled
// (escape DC 13) rides the LIVE MA-0909/MA-0930 hit_conditions+escape_dc lane
// (buildHitConditionClause → applyHitClauseConditions, handlePlainDamage.js:553; size
// gate is Large-or-smaller §1116 — Medium Bandit passes); (3) hit_target_effect:"attached"
// rides the MA-1531 stirge sibling lane — consumers COEXIST: maybeApplyHitClause runs
// conditions THEN targetEffect (handlePlainDamage.js:841→854), so grapple lands LIVE and
// the attached te stamp rides alongside. Seam is ADDITIVE (MA-1552/MA-1555): base Done
// still pays 2d10 + 3; accept rolls its own 1d10 + 3 bonus leg — RAW full-variant
// replacement caveat accepted family-wide.
// Trim pass (2026-10-18), two seams, one press each — mirrors the maintained ma1552/ma1555
// template, with this family's ONLY triple-payload row as the distinct seam:
//   1. Disk-row bytes: FULL-row toEqual (base legs + cd modifier-bearing shape + grappled
//      + escape_dc 13 + attached + description prose, byte-exact) + tail key placement +
//      registry lane-link (getEffectDefinition resolves the row's te; full registry pin
//      owned by targetEffectDefinitions.test.js:668-681) + lone-stirge inert guard
//      (triple riders never leaked onto the MA-1531 stirge row).
//   2. ONE click→rollAttack ctx press (MonsterCardModal.jsx:1407): full 7-key offer
//      identity ("Bloodied: +1d10+3 Piercing?") AND full hitClause toEqual — the family's
//      ONLY row carrying all three lanes in one ctx (offer + grapple auto-grant + escapeDc
//      + attached te); every swarm twin ships a subset (bats/rats offer-only, claws
//      offer+prone).
// Cut (owner MonsterCardModal.charge-bonus.test.jsx owns the machine :210-250):
// grant, crit accept, decline — generic mechanics twins of owner Talons bytes;
// popup offer-render — popup chrome owned by common/AttackResultPopup.ma1363 :105-120;
// direct buildChargeBonusOffer/buildHitConditionClause tests — subsumed by the ctx
// offer/hitClause toEqual; attackRowMissingToHit truth table owned by ma0286 :89-113;
// charge-row label loop cut (talons charge-bonus :51). Sibling row loops cut — each row
// byte-pinned by its own owner: bats ma1552, rats ma1565, claws/grasping-hands ma1555,
// stirge+attached landing handlePlainDamage.hitClause.test.js :113/:272. Grapple/te
// landing on the victim (condition write + attachedBy + grant log) owned by the same
// hitClause owner lane — never re-pinned at the modal.
// Dead-mock purge per ma1552 baseline: diceRoller stub (rollAttack mocked, no roller fires
// without the cut grant tests), AttackResultPopup stub (popup never renders — popupHtml
// null), never-fired hook members (minimal shape renders per ma1160/ma1363).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

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
const SWARM = monsters.find((m) => m.index === 'swarm-of-stirges');
const PROBOSCISES = SWARM.actions.find((a) => a.name === 'Swarm of Proboscises');
const STIRGE_PROBOSCIS = monsters.find((m) => m.index === 'stirge').actions.find((a) => a.name === 'Proboscis');

// Exact disk row, byte-for-byte — full-row toEqual locks every rider at once:
// base legs, the modifier-bearing MA-0485/MA-1555 cd shape (separate numeric modifier
// key, dice never carries '+'), the MA-0909/MA-0930 grapple pair, the MA-1531 attached
// te, and the RAW prose (all three fixed sentences, incl. the 2d6 bleed tick kept as
// §87/§70 GM-advisory — no turn-end consumer invented). Absence of hit_choice /
// save_effect / save_dc decoys (§410) is locked by the toEqual exhaustiveness.
const FULL_ROW = {
  name: 'Swarm of Proboscises',
  description: "Melee Attack Roll: +5, reach 5 ft. Hit: 14 (2d10 + 3) Piercing damage, or 8 (1d10 + 3) Piercing damage if the swarm is Bloodied. If the target is a Medium or smaller creature in the swarm's space, the target has the Grappled condition (escape DC 13). Until the grapple ends, the target takes 7 (2d6) Necrotic damage at the end of each of its turns.",
  attack_bonus: 5,
  reach: '5 ft.',
  damage_dice_primary: '2d10 + 3',
  damage_type_primary: 'Piercing',
  conditional_damage: { dice: '1d10', modifier: 3, damage_type: 'Piercing', condition: 'Bloodied' },
  hit_conditions: ['grappled'],
  escape_dc: 13,
  hit_target_effect: 'attached',
};

// Exact buildChargeBonusOffer(PROBOSCISES, 'Swarm of Proboscises') output FROM the disk
// row — full 7-key identity, modifier-bearing formula ('1d10 + 3') and condition-text
// label chrome ("Bloodied: +1d10+3 Piercing?", MA-1363 generalization + modifier token).
const PROBOSCISES_OFFER = {
  dice: '1d10',
  modifier: 3,
  damageType: 'Piercing',
  condition: 'Bloodied',
  formula: '1d10 + 3',
  label: 'Bloodied: +1d10+3 Piercing?',
  attackName: 'Swarm of Proboscises',
};

// Exact buildHitConditionClause(PROBOSCISES) output — the family's ONLY triple-lane
// clause: grappled auto-grant + escapeDc 13 + attached te coexist in ONE payload
// (maybeApplyHitClause: conditions at :841, then targetEffect at :854). Landing on the
// victim owned by handlePlainDamage.hitClause.test.js (:113/:272 attached stamp lane).
const PROBOSCISES_CLAUSE = {
  conditions: ['grappled'],
  escapeDc: 13,
  attackName: 'Swarm of Proboscises',
  targetEffect: 'attached',
};

const CREATURES = [
  { name: 'Swarm of Stirges 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function renderStirges() {
  _setPopupHtml(null);
  const m = makeMonster({ name: 'Swarm of Stirges', size: 'Medium', type: 'swarm', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Stirges 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Stirges 1' })} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1569 monsters.json data lock: Swarm of Proboscises triple-rider fix', () => {
  it('authors the full byte-exact row: Bloodied cd + grappled/escape_dc 13 + attached te with RAW prose anchors and tail key placement', () => {
    expect(SWARM.actions.map((a) => a.name)).toEqual(['Swarm of Proboscises']);
    expect(PROBOSCISES).toEqual(FULL_ROW);
    // Key placement: cd immediately after damage_type_primary; grapple pair + attached trail it.
    const keys = Object.keys(PROBOSCISES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.slice(-4)).toEqual(['conditional_damage', 'hit_conditions', 'escape_dc', 'hit_target_effect']);
    // Lane-link: the row's te resolves in the MA-1531 registry (full pin owned by
    // targetEffectDefinitions.test.js:668-681) — attached is a real consumer lane.
    expect(getEffectDefinition(PROBOSCISES.hit_target_effect).label).toBe('Attached');
    // Lone-stirge inert guard: the triple riders are swarm-row-only — the MA-1531
    // stirge row stays targetEffect-only (landing pinned at hitClause.test.js:272).
    expect(STIRGE_PROBOSCIS.hit_target_effect).toBe('attached');
    expect(STIRGE_PROBOSCIS.conditional_damage).toBeUndefined();
    expect(STIRGE_PROBOSCIS.hit_conditions).toBeUndefined();
    expect(STIRGE_PROBOSCIS.escape_dc).toBeUndefined();
  });
});

describe('MA-1569 Swarm of Proboscises click→ctx forward (MonsterCardModal.jsx:1407)', () => {
  it('clicking the +5 chip forwards the full disk offer AND the family\'s only triple-lane hitClause (grappled + escapeDc 13 + attached)', () => {
    renderStirges();
    const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Swarm of Proboscises/.test(a.textContent.trim()));
    const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
    expect(chip, 'Expected Swarm of Proboscises +5 dice link').toBeTruthy();
    fireEvent.click(chip);
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toEqual(PROBOSCISES_OFFER);
    expect(ctx.hitClause).toEqual(PROBOSCISES_CLAUSE);
  });
});
