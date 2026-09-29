// @improved-by-ai
// MA-1565: Swarm of Rats Bites — conditional_damage:{dice:"1d4",damage_type:"Piercing",
// condition:"Bloodied"} authored on monsters.json swarm-of-rats actions[0] so the HIT popup
// offers the "or 2 (1d4) Piercing damage if the swarm is Bloodied" variant via the live
// MA-0007 GM-adjudication seam (additive: base Done still pays 2d4; grant rolls its own
// 1d4 leg). No auto-bloodied eval (§70 residual); offer shows even healthy (MA-1363
// static-state recipe). Byte-twin of MA-1552 swarm-of-bats: prose-only clause was
// FAIL(a)/DATA (buildChargeBonusOffer arms on cd.dice only — Helpers:666). Locks: data
// byte-shape mirrors the bats twin (keys dice/damage_type/condition, no modifier; capitalized
// "Piercing"; conditional_damage after damage_type_primary, last key); offer label carries the
// condition text ("Bloodied: +1d4 Piercing?"); grant rolls 1d4 + logs; crit accept doubles the
// clause dice; decline logs base-only; swarm siblings (bats/centipedes) byte-locked.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 7, rolls: [3, 4], modifier: 0, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 14, rolls: [3, 4, 3, 4], modifier: 0, formula })),
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
import { buildChargeBonusOffer, buildHitConditionClause } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SWARM = monsters.find((m) => m.index === 'swarm-of-rats');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');
const QUAGGOTH_CLAW = monsters.find((m) => m.index === 'quaggoth').actions.find((a) => a.name === 'Claw');
const GOAT_RAM = monsters.find((m) => m.index === 'goat').actions.find((a) => a.name === 'Ram');
const BATS_BITES = monsters.find((m) => m.index === 'swarm-of-bats').actions.find((a) => a.name === 'Bites');
const CENTIPEDES_BITES = monsters.find((m) => m.index === 'swarm-of-centipedes').actions.find((a) => a.name === 'Bites');

const CREATURES = [
  { name: 'Swarm of Rats 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(BITES, 'Bites');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Bites',
    rolls: [18],
    bonus: 2,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Bites', formula: '2d4', damageType: 'Piercing', source: 'Swarm of Rats 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderBites(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Swarm of Rats', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Rats 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Rats 1' })} />);
}

function clickBitesLink() {
  const bitesRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
  const chip = Array.from(bitesRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+2');
  expect(chip, 'Expected Bites +2 dice link').toBeTruthy();
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

describe('MA-1565 monsters.json data lock: Swarm of Rats Bites Bloodied variant', () => {
  it('authors conditional_damage on Bites with the MA-0007 keys (dice/damage_type/condition, no modifier)', () => {
    expect(SWARM.actions[0].name).toBe('Bites');
    expect(BITES.attack_bonus).toBe(2);
    expect(BITES.damage_dice_primary).toBe('2d4');
    expect(BITES.damage_type_primary).toBe('Piercing');
    const cd = BITES.conditional_damage;
    expect(cd).toEqual({ dice: '1d4', damage_type: 'Piercing', condition: 'Bloodied' });
    expect('modifier' in cd).toBe(false);
    expect(Object.keys(cd)).toEqual(Object.keys(QUAGGOTH_CLAW.conditional_damage));
    expect(Object.keys(cd)).toEqual(Object.keys(GOAT_RAM.conditional_damage));
  });

  it('is a byte-twin of the MA-1552 swarm-of-bats conditional_damage shape', () => {
    expect(BITES.conditional_damage).toEqual(BATS_BITES.conditional_damage);
    expect(BITES.description).toMatch(/or 2 \(1d4\) Piercing damage if the swarm is Bloodied/);
  });

  it('places conditional_damage after damage_type_primary, last key (MA-0822 twin placement)', () => {
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
  });

  it('carries no hit_conditions clause (Bloodied rides conditional_damage only)', () => {
    expect(BITES.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BITES)).toBeNull();
  });
});

describe('MA-1565 sibling lock: swarm twins untouched', () => {
  it('keeps swarm-of-bats Bites byte-identical (MA-1552 row)', () => {
    expect(BATS_BITES.attack_bonus).toBe(4);
    expect(BATS_BITES.damage_dice_primary).toBe('2d4');
    expect(BATS_BITES.damage_type_primary).toBe('Piercing');
    expect(BATS_BITES.conditional_damage).toEqual({ dice: '1d4', damage_type: 'Piercing', condition: 'Bloodied' });
  });

  it('keeps swarm-of-centipedes Bites byte-identical (MA-1554 row)', () => {
    expect(CENTIPEDES_BITES.attack_bonus).toBe(3);
    expect(CENTIPEDES_BITES.damage_dice_primary).toBe('4d4');
    expect(CENTIPEDES_BITES.conditional_damage).toEqual({ dice: '2d4', damage_type: 'piercing', condition: 'half HP or fewer' });
    expect(buildChargeBonusOffer(CENTIPEDES_BITES, 'Bites').label).toBe('Half HP or fewer: +2d4 piercing?');
  });
});

describe('MA-1565 buildChargeBonusOffer label', () => {
  it('builds the Bloodied clause offer with formula "1d4" and a condition-text label', () => {
    const offer = buildChargeBonusOffer(BITES, 'Bites');
    expect(offer).toMatchObject({ dice: '1d4', modifier: 0, damageType: 'Piercing', condition: 'Bloodied', formula: '1d4', attackName: 'Bites' });
    expect(offer.label).toBe('Bloodied: +1d4 Piercing?');
    expect(offer.label).not.toMatch(/Charge/i);
  });

  it('keeps every existing charge-row label byte-identical (MA-0007/MA-0885/MA-1363 pins)', () => {
    const talons = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0];
    expect(buildChargeBonusOffer(talons, 'Talons').label).toBe('30+ ft Charge: +3d4+2 Slashing?');
    expect(buildChargeBonusOffer(GOAT_RAM, 'Ram').label).toBe('20+ ft Charge: +1d4 Bludgeoning?');
    expect(buildChargeBonusOffer(QUAGGOTH_CLAW, 'Claw').label).toBe('Bloodied: +2d6 Slashing?');
  });
});

describe('MA-1565 Swarm of Rats Bites HIT popup offer + grant/decline', () => {
  it('forwards the Bloodied conditional offer to the attack roll context', () => {
    renderBites();
    clickBitesLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '1d4', modifier: 0, damageType: 'Piercing', condition: 'Bloodied' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('renders the Bloodied offer button in the HIT popup', () => {
    renderBites(hitPopupHtml());
    const popup = document.querySelector('[data-testid="popup-stub"]');
    expect(popup.textContent).toContain('Bloodied: +1d4 Piercing?');
  });

  it('accept: rolls 1d4, applies its own damage, logs the grant (base+bonus legs)', async () => {
    renderBites(hitPopupHtml());
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d4');
    expect(call.context.damageType).toBe('Piercing');
    expect(rollExpression).toHaveBeenCalledWith('1d4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('(Bloodied)');
    expect(grant.description).toContain('+7 Piercing (1d4)');
  });

  it('crit accept doubles the clause dice ("1d4*2")', async () => {
    renderBites(hitPopupHtml({ isCrit: true }));
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d4');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d4');
    expect(call.total).toBe(14);
  });

  it('decline: logs the refusal with zero bonus roll (base only)', async () => {
    renderBites(hitPopupHtml());
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
