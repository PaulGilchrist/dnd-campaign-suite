// @improved-by-ai
// MA-1569: Swarm of Stirges "Swarm of Proboscises" — three inert prose riders fixed on
// monsters.json actions[0]: (1) Bloodied 8 (1d10 + 3) Piercing variant rides the live
// MA-0007/MA-1363 GM-adjudication seam via conditional_damage (buildChargeBonusOffer arms
// on cd?.dice — Helpers:666; modifier-bearing MA-0485/MA-1555 byte-shape — separate
// numeric modifier key, NEVER embedded "+" in dice); (2) Medium-or-smaller hit → Grappled
// (escape DC 13) rides the LIVE MA-0909/MA-0930 hit_conditions+escape_dc lane
// (buildHitConditionClause → applyHitClauseConditions, handlePlainDamage.js:553; size
// gate is Large-or-smaller §1116 — Medium Bandit passes); (3) hit_target_effect:"attached"
// rides the MA-1531 stirge sibling lane (applyHitClauseTargetEffect te + attachedBy +
// grant log). Consumers COEXIST: maybeApplyHitClause runs conditions at :841 THEN
// targetEffect at :854 — grapple lands LIVE and the attached te stamps alongside; the
// turn-end 2d6 Necrotic bleed tick stays §87/§70 zero-consumer GM-advisory carried by
// the registry description + grant log (no new turn_end_grapple_damage consumer invented).
// Seam is ADDITIVE (MA-1552/1555): base Done still pays 2d10 + 3; accept rolls its own
// 1d10 + 3 bonus leg — RAW full-variant replacement caveat accepted family-wide.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 10, rolls: [7], modifier: 3, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 17, rolls: [7, 7], modifier: 3, formula })),
  rollD20: vi.fn(() => 18),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
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

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => {
    const offer = props.popupHtml?.chargeBonusOffer;
    return (
      <div data-testid="popup-stub">
        {offer && <span>{offer.label}</span>}
        <button onClick={() => props.onChargeBonus?.()}>charge-grant</button>
        <button onClick={() => props.onChargeBonusDecline?.()}>charge-decline</button>
      </div>
    );
  },
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildChargeBonusOffer, buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SWARM = monsters.find((m) => m.index === 'swarm-of-stirges');
const PROBOSCISES = SWARM.actions.find((a) => a.name === 'Swarm of Proboscises');
const STIRGE = monsters.find((m) => m.index === 'stirge');
const STIRGE_PROBOSCIS = STIRGE.actions.find((a) => a.name === 'Proboscis');
const CLAWS = monsters.find((m) => m.index === 'swarm-of-crawling-claws').actions[0];
const BAT_BITES = monsters.find((m) => m.index === 'swarm-of-bats').actions[0];
const RAT_BITES = monsters.find((m) => m.index === 'swarm-of-rats').actions[0];
const BEARD = monsters.find((m) => m.index === 'bearded-devil').actions.find((a) => a.name === 'Beard');

const CREATURES = [
  { name: 'Swarm of Stirges 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(PROBOSCISES, 'Swarm of Proboscises');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Swarm of Proboscises',
    rolls: [18],
    bonus: 5,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Swarm of Proboscises', formula: '2d10 + 3', damageType: 'Piercing', source: 'Swarm of Stirges 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderStirges(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Swarm of Stirges', size: 'Medium', type: 'swarm', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Stirges 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Stirges 1' })} />);
}

function clickProboscisesLink() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Swarm of Proboscises/.test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
  expect(chip, 'Expected Swarm of Proboscises +5 dice link').toBeTruthy();
  fireEvent.click(chip);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

function clickButton(text) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === text);
  fireEvent.click(btn);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-1569 monsters.json data lock: Swarm of Proboscises triple-rider fix', () => {
  it('row identity + core legs byte-unchanged: +5, 5 ft., 2d10 + 3 Piercing', () => {
    expect(SWARM.actions[0].name).toBe('Swarm of Proboscises');
    expect(PROBOSCISES.attack_bonus).toBe(5);
    expect(PROBOSCISES.reach).toBe('5 ft.');
    expect(PROBOSCISES.damage_dice_primary).toBe('2d10 + 3');
    expect(PROBOSCISES.damage_type_primary).toBe('Piercing');
    expect(PROBOSCISES.description).toBe(
      "Melee Attack Roll: +5, reach 5 ft. Hit: 14 (2d10 + 3) Piercing damage, or 8 (1d10 + 3) Piercing damage if the swarm is Bloodied. If the target is a Medium or smaller creature in the swarm's space, the target has the Grappled condition (escape DC 13). Until the grapple ends, the target takes 7 (2d6) Necrotic damage at the end of each of its turns."
    );
  });

  it('authors Bloodied conditional_damage in the modifier-bearing MA-0485/MA-1555 byte-shape (separate modifier key, no "+" in dice)', () => {
    const cd = PROBOSCISES.conditional_damage;
    expect(cd).toEqual({ dice: '1d10', modifier: 3, damage_type: 'Piercing', condition: 'Bloodied' });
    expect(cd.dice).not.toMatch(/\+/);
    expect(Object.keys(cd)).toEqual(['dice', 'modifier', 'damage_type', 'condition']);
    expect(Object.keys(cd)).toEqual(Object.keys(CLAWS.conditional_damage));
  });

  it('authors hit_conditions ["grappled"] + escape_dc 13 (MA-0909/MA-0930 live grapple lane)', () => {
    expect(PROBOSCISES.hit_conditions).toEqual(['grappled']);
    expect(PROBOSCISES.escape_dc).toBe(13);
  });

  it('authors hit_target_effect "attached" (MA-1531 stirge sibling te stamp)', () => {
    expect(PROBOSCISES.hit_target_effect).toBe('attached');
  });

  it('key placement: conditional_damage after damage_type_primary, grapple pair + attached trailing', () => {
    const keys = Object.keys(PROBOSCISES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.slice(-4)).toEqual(['conditional_damage', 'hit_conditions', 'escape_dc', 'hit_target_effect']);
  });

  it('no hit_choice chooser, no wrong-slot save_effect decoy (§410)', () => {
    expect(PROBOSCISES.hit_choice).toBeUndefined();
    expect(PROBOSCISES.save_effect).toBeUndefined();
    expect(PROBOSCISES.save_dc).toBeUndefined();
  });

  it('siblings byte-locked: bats/rats Bloodied variants, claws variant+prone, stirge attached-only, beard coexistence precedent', () => {
    expect(BAT_BITES.conditional_damage).toEqual({ dice: '1d4', damage_type: 'Piercing', condition: 'Bloodied' });
    expect(RAT_BITES.conditional_damage).toEqual({ dice: '1d4', damage_type: 'Piercing', condition: 'Bloodied' });
    expect(CLAWS.conditional_damage).toEqual({ dice: '2d8', modifier: 2, damage_type: 'Necrotic', condition: 'Bloodied' });
    expect(CLAWS.hit_conditions).toEqual(['prone']);
    expect(CLAWS.escape_dc).toBeUndefined();
    expect(CLAWS.hit_target_effect).toBeUndefined();
    expect(STIRGE_PROBOSCIS.hit_target_effect).toBe('attached');
    expect(STIRGE_PROBOSCIS.hit_conditions).toBeUndefined();
    expect(STIRGE_PROBOSCIS.conditional_damage).toBeUndefined();
    expect(BEARD.hit_conditions).toEqual(['poisoned']);
    expect(BEARD.hit_target_effect).toBe('no_healing');
  });
});

describe('MA-1569 buildChargeBonusOffer label', () => {
  it('builds the Bloodied variant offer with formula "1d10 + 3" and a condition-text label', () => {
    const offer = buildChargeBonusOffer(PROBOSCISES, 'Swarm of Proboscises');
    expect(offer).toMatchObject({ dice: '1d10', modifier: 3, damageType: 'Piercing', condition: 'Bloodied', formula: '1d10 + 3', attackName: 'Swarm of Proboscises' });
    expect(offer.label).toBe('Bloodied: +1d10+3 Piercing?');
    expect(offer.label).not.toMatch(/Charge/i);
  });

  it('keeps existing swarm + charge-row labels byte-identical (MA-1552/MA-1555/MA-0007/MA-1363 pins)', () => {
    expect(buildChargeBonusOffer(BAT_BITES, 'Bites').label).toBe('Bloodied: +1d4 Piercing?');
    expect(buildChargeBonusOffer(CLAWS, 'Swarm of Grasping Hands').label).toBe('Bloodied: +2d8+2 Necrotic?');
    const talons = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0];
    expect(buildChargeBonusOffer(talons, 'Talons').label).toBe('30+ ft Charge: +3d4+2 Slashing?');
  });

  it('stirge + bats/rats unarmed lanes stay offer-less exactly as before (no fabricated cd)', () => {
    expect(buildChargeBonusOffer(STIRGE_PROBOSCIS, 'Proboscis')).toBeNull();
    expect(buildChargeBonusOffer(RAT_BITES, 'Bites').formula).toBe('1d4');
  });
});

describe('MA-1569 buildHitConditionClause: grapple + attached coexist', () => {
  it('arms BOTH riders on one clause: grappled/escapeDc 13 + attached te (no lane suppresses the other)', () => {
    expect(buildHitConditionClause(PROBOSCISES)).toEqual({
      conditions: ['grappled'],
      escapeDc: 13,
      attackName: 'Swarm of Proboscises',
      targetEffect: 'attached',
    });
  });

  it('stirge sibling stays targetEffect-only (MA-1531 byte-shape intact)', () => {
    expect(buildHitConditionClause(STIRGE_PROBOSCIS)).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Proboscis',
      targetEffect: 'attached',
    });
  });
});

describe('MA-1569 Swarm of Proboscises HIT popup: chip forwards both lanes + offer adjudication', () => {
  it('forwards BOTH riders to the attack roll context: charge offer + grappled/attached hitClause', () => {
    renderStirges();
    clickProboscisesLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(attackRowMissingToHit(PROBOSCISES)).toBe(false);
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '1d10', modifier: 3, damageType: 'Piercing', condition: 'Bloodied' });
    expect(rollAttack.mock.calls[0][2].hitClause).toEqual({
      conditions: ['grappled'],
      escapeDc: 13,
      attackName: 'Swarm of Proboscises',
      targetEffect: 'attached',
    });
  });

  it('renders the Bloodied offer button in the HIT popup', () => {
    renderStirges(hitPopupHtml());
    const popup = document.querySelector('[data-testid="popup-stub"]');
    expect(popup.textContent).toContain('Bloodied: +1d10+3 Piercing?');
  });

  it('accept: rolls 1d10 + 3, applies its own bonus leg, logs the grant (additive seam)', async () => {
    renderStirges(hitPopupHtml());
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d10 + 3');
    expect(call.context.damageType).toBe('Piercing');
    expect(rollExpression).toHaveBeenCalledWith('1d10 + 3');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('(Bloodied)');
    expect(grant.description).toContain('+10 Piercing (1d10 + 3)');
  });

  it('crit accept doubles the clause formula', async () => {
    renderStirges(hitPopupHtml({ isCrit: true }));
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d10 + 3');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d10 + 3');
    expect(call.total).toBe(17);
  });

  it('healthy decline: logs the refusal with zero bonus roll (base exact)', async () => {
    renderStirges(hitPopupHtml());
    clickButton('charge-decline');
    await vi.waitFor(() => {
      const decline = findLogEntry('conditional_damage_declined');
      expect(decline).toBeTruthy();
      expect(decline.description).toContain('base damage only');
    });
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(findLogEntry('conditional_damage_granted')).toBeFalsy();
  });
});
