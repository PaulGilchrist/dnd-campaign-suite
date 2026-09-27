// @improved-by-ai
// MA-1363: Quaggoth Claw — conditional_damage:{dice:"2d6",damage_type:"Slashing",
// condition:"bloodied"} authored on monsters.json actions[1] so the HIT popup offers
// the "or 13 (3d6 + 3) Slashing if Bloodied" variant via the live MA-0007 GM-
// adjudication seam (additive: base Done still pays 1d6 + 3; grant rolls its own
// 2d6 leg; 1d6+3 + 2d6 = 3d6+3 face total). No auto-bloodied eval (§70 residual;
// threshold machinery exists in CreatureHp.jsx:67). Locks: data byte-shape mirrors
// the modifier-less MA-0756 galeb-duhr / MA-0805 giant-elk twins (keys dice/
// damage_type/condition, no modifier; conditional_damage after damage_type_primary,
// last key per MA-0822 placement); offer label carries the condition text
// ("Bloodied: +2d6 Slashing?") while every charge row label stays byte-identical
// (MA-0885/MA-0822/MA-1174/MA-1175 pins); grant rolls 2d6 + logs; crit accept
// doubles the clause dice (rollExpressionDoubled); decline logs base-only.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 7, rolls: [3, 4], modifier: 0, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 14, rolls: [3, 4, 3, 4], modifier: 0, formula })),
  rollD20: vi.fn(() => 16),
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
import { buildChargeBonusOffer, buildHitConditionClause } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const QUAGGOTH = monsters.find((m) => m.index === 'quaggoth');
const CLAW = QUAGGOTH.actions.find((a) => a.name === 'Claw');
const GALEB_SLAM = monsters.find((m) => m.index === 'galeb-duhr').actions.find((a) => a.name === 'Avalanche Slam');
const ELK_RAM = monsters.find((m) => m.index === 'giant-elk').actions.find((a) => a.name === 'Ram');

const CREATURES = [
  { name: 'Quaggoth 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(CLAW, 'Claw');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Claw',
    rolls: [16],
    bonus: 5,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Claw', formula: '1d6 + 3', damageType: 'Slashing', source: 'Quaggoth 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderClaw(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Quaggoth', actions: QUAGGOTH.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Quaggoth 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Quaggoth 1' })} />);
}

function clickClawLink() {
  const clawRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Claw/.test(a.textContent.trim()));
  const chip = Array.from(clawRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+5');
  expect(chip, 'Expected Claw +5 dice link').toBeTruthy();
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

describe('MA-1363 monsters.json data lock: Quaggoth Claw Bloodied variant', () => {
  it('authors conditional_damage on Claw with the MA-0007 keys (dice/damage_type/condition, no modifier)', () => {
    expect(CLAW.attack_bonus).toBe(5);
    expect(CLAW.damage_dice_primary).toBe('1d6 + 3');
    expect(CLAW.damage_type_primary).toBe('Slashing');
    const cd = CLAW.conditional_damage;
    expect(cd).toBeTruthy();
    expect(cd.dice).toBe('2d6');
    expect(cd.damage_type).toBe('Slashing');
    expect(cd.condition).toBe('bloodied');
    expect('modifier' in cd).toBe(false);
    expect(Object.keys(cd)).toEqual(Object.keys(GALEB_SLAM.conditional_damage));
    expect(Object.keys(cd)).toEqual(Object.keys(ELK_RAM.conditional_damage));
  });

  it('places conditional_damage after damage_type_primary, last key (MA-0822 twin placement)', () => {
    const keys = Object.keys(CLAW);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
  });

  it('keeps the Bloodied variant clause in the description prose (RAW anchor)', () => {
    expect(CLAW.description).toMatch(/or 13 \(3d6 \+ 3\) Slashing damage if the quaggoth is <strong>Bloodied<\/strong>/);
  });

  it('carries no hit_conditions clause (Bloodied rides conditional_damage only)', () => {
    expect(CLAW.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(CLAW)).toBeNull();
  });
});

describe('MA-1363 buildChargeBonusOffer label generalization', () => {
  it('builds the Bloodied clause offer with formula "2d6" and a condition-text label', () => {
    const offer = buildChargeBonusOffer(CLAW, 'Claw');
    expect(offer).toMatchObject({ dice: '2d6', modifier: 0, damageType: 'Slashing', condition: 'bloodied', formula: '2d6', attackName: 'Claw' });
    expect(offer.label).toBe('Bloodied: +2d6 Slashing?');
    expect(offer.label).not.toMatch(/Charge/i);
  });

  it('keeps every existing charge-row label byte-identical (MA-0007/MA-0885/MA-0822/MA-1174/MA-1175 pins)', () => {
    const talons = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0];
    expect(buildChargeBonusOffer(talons, 'Talons').label).toBe('30+ ft Charge: +3d4+2 Slashing?');
    const goatRam = monsters.find((m) => m.index === 'goat').actions.find((a) => a.name === 'Ram');
    expect(buildChargeBonusOffer(goatRam, 'Ram').label).toBe('20+ ft Charge: +1d4 Bludgeoning?');
    const seahorseRam = monsters.find((m) => m.index === 'giant-seahorse').actions.find((a) => a.name === 'Ram');
    expect(buildChargeBonusOffer(seahorseRam, 'Ram').label).toBe('20+ ft Charge: +2d8+2 Bludgeoning?');
    const baphometGore = monsters.find((m) => m.name === 'Minotaur of Baphomet').actions.find((a) => a.name === 'Gore');
    expect(buildChargeBonusOffer(baphometGore, 'Gore').label).toBe('Charge: +3d6 Piercing?');
    const skeletonGore = monsters.find((m) => m.name === 'Minotaur Skeleton').actions.find((a) => a.name === 'Gore');
    expect(buildChargeBonusOffer(skeletonGore, 'Gore').label).toBe('Charge: +2d8 Piercing?');
  });

  it('returns null when the action has no conditional_damage', () => {
    expect(buildChargeBonusOffer({ name: 'Multiattack', attack_bonus: 5 }, 'Multiattack')).toBeNull();
  });
});

describe('MA-1363 Quaggoth Claw HIT popup offer + grant/decline', () => {
  it('forwards the Bloodied conditional offer to the attack roll context', () => {
    renderClaw();
    clickClawLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d6', modifier: 0, damageType: 'Slashing', condition: 'bloodied' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('renders the Bloodied offer button in the HIT popup', () => {
    renderClaw(hitPopupHtml());
    const popup = document.querySelector('[data-testid="popup-stub"]');
    expect(popup.textContent).toContain('Bloodied: +2d6 Slashing?');
  });

  it('accept: rolls 2d6, applies its own damage, logs the grant (base+bonus legs)', async () => {
    renderClaw(hitPopupHtml());
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d6');
    expect(call.context.damageType).toBe('Slashing');
    expect(rollExpression).toHaveBeenCalledWith('2d6');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('(bloodied)');
    expect(grant.description).toContain('+7 Slashing (2d6)');
  });

  it('crit accept doubles the clause dice ("2d6*2")', async () => {
    renderClaw(hitPopupHtml({ isCrit: true }));
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('2d6');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d6');
    expect(call.total).toBe(14);
  });

  it('decline: logs the refusal with zero bonus roll (base only)', async () => {
    renderClaw(hitPopupHtml());
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
