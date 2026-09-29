// @improved-by-ai
// MA-1554: Swarm of Centipedes Bites — conditional_damage:{dice:"2d4",damage_type:"piercing",
// condition:"half HP or fewer"} authored on monsters.json swarm-of-centipedes actions[0] so the
// HIT popup offers the "or 5 (2d4) piercing damage if the swarm has half of its hit points or
// fewer" variant via the live MA-0007 GM-adjudication seam (additive: base Done still pays
// 4d4; grant rolls its own 2d4 leg). No auto-half-HP eval (§70 residual); offer shows even
// healthy (MA-1363 static-state recipe). Data twin of MA-1553 swarm-of-beetles (byte-twin row,
// lowercase piercing kept): prose-only clause was FAIL(a)/DATA (buildChargeBonusOffer arms on
// cd.dice only — Helpers:664). The KO clause ("reduced to 0 hit points ... stable but poisoned
// for 1 hour ... paralyzed while poisoned in this way") is GM-adjudicated ADVISORY by design:
// 0-HP-state wording with no structured field and no consumer app-wide — NOT mechanized here
// (no fake ko/state fields authored on the row; see suite adjudication for MA-1554).
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
const SWARM = monsters.find((m) => m.index === 'swarm-of-centipedes');
const BITES = SWARM.actions.find((a) => a.name === 'Bites');
const SWARM_BEETLES_BITES = monsters.find((m) => m.index === 'swarm-of-beetles').actions.find((a) => a.name === 'Bites');
const SWARM_BATS_BITES = monsters.find((m) => m.index === 'swarm-of-bats').actions.find((a) => a.name === 'Bites');
const QUAGGOTH_CLAW = monsters.find((m) => m.index === 'quaggoth').actions.find((a) => a.name === 'Claw');
const GOAT_RAM = monsters.find((m) => m.index === 'goat').actions.find((a) => a.name === 'Ram');

const CREATURES = [
  { name: 'Swarm of Centipedes 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(BITES, 'Bites');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Bites',
    rolls: [18],
    bonus: 3,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Bites', formula: '4d4', damageType: 'piercing', source: 'Swarm of Centipedes 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderBites(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Swarm of Centipedes', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Centipedes 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Centipedes 1' })} />);
}

function clickBitesLink() {
  const bitesRow = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
  const chip = Array.from(bitesRow.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+3');
  expect(chip, 'Expected Bites +3 dice link').toBeTruthy();
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

describe('MA-1554 monsters.json data lock: Swarm of Centipedes Bites half-HP variant', () => {
  it('authors conditional_damage on Bites with the MA-0007 keys (dice/damage_type/condition, no modifier)', () => {
    expect(SWARM.actions[0].name).toBe('Bites');
    expect(BITES.attack_bonus).toBe(3);
    expect(BITES.damage_dice_primary).toBe('4d4');
    expect(BITES.damage_type_primary).toBe('piercing');
    const cd = BITES.conditional_damage;
    expect(cd).toEqual({ dice: '2d4', damage_type: 'piercing', condition: 'half HP or fewer' });
    expect('modifier' in cd).toBe(false);
    expect(Object.keys(cd)).toEqual(Object.keys(SWARM_BEETLES_BITES.conditional_damage));
    expect(Object.keys(cd)).toEqual(Object.keys(QUAGGOTH_CLAW.conditional_damage));
    expect(Object.keys(cd)).toEqual(Object.keys(GOAT_RAM.conditional_damage));
  });

  it('places conditional_damage after damage_type_primary, last key (MA-0822 twin placement)', () => {
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBeGreaterThan(keys.indexOf('damage_type_primary'));
    expect(keys.indexOf('conditional_damage')).toBe(keys.length - 1);
  });

  it('keeps the half-HP variant clause in the description prose (RAW anchor)', () => {
    expect(BITES.description).toMatch(/or 5 \(2d4\) piercing damage if the swarm has half of its hit points or fewer/);
  });

  it('leaves the KO poison/paralyze clause prose-only (GM-adjudicated ADVISORY, not mechanized)', () => {
    expect(BITES.description).toMatch(/reduced to 0 hit points by a swarm of centipedes is stable but poisoned for 1 hour/);
    expect(BITES.description).toMatch(/paralyzed while poisoned in this way/);
    expect(BITES.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BITES)).toBeNull();
    expect(Object.keys(BITES)).toEqual(Object.keys(SWARM_BEETLES_BITES));
    expect(BITES.conditional_damage.condition).toBe('half HP or fewer');
  });
});

describe('MA-1554 buildChargeBonusOffer label', () => {
  it('builds the half-HP clause offer with formula "2d4" and a first-capitalized condition-text label', () => {
    const offer = buildChargeBonusOffer(BITES, 'Bites');
    expect(offer).toMatchObject({ dice: '2d4', modifier: 0, damageType: 'piercing', condition: 'half HP or fewer', formula: '2d4', attackName: 'Bites' });
    expect(offer.label).toBe('Half HP or fewer: +2d4 piercing?');
    expect(offer.label).not.toMatch(/Charge/i);
  });

  it('keeps every existing charge-row label byte-identical (MA-0007/MA-0885/MA-1363/MA-1552/MA-1553 pins)', () => {
    const talons = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0];
    expect(buildChargeBonusOffer(talons, 'Talons').label).toBe('30+ ft Charge: +3d4+2 Slashing?');
    expect(buildChargeBonusOffer(GOAT_RAM, 'Ram').label).toBe('20+ ft Charge: +1d4 Bludgeoning?');
    expect(buildChargeBonusOffer(QUAGGOTH_CLAW, 'Claw').label).toBe('Bloodied: +2d6 Slashing?');
    expect(buildChargeBonusOffer(SWARM_BATS_BITES, 'Bites').label).toBe('Bloodied: +1d4 Piercing?');
    expect(buildChargeBonusOffer(SWARM_BEETLES_BITES, 'Bites').label).toBe('Half HP or fewer: +2d4 piercing?');
  });
});

describe('MA-1554 Swarm of Centipedes Bites HIT popup offer + grant/decline', () => {
  it('forwards the half-HP conditional offer to the attack roll context', () => {
    renderBites();
    clickBitesLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '2d4', modifier: 0, damageType: 'piercing', condition: 'half HP or fewer' });
    expect(rollAttack.mock.calls[0][2].hitClause).toBeNull();
  });

  it('renders the half-HP offer button in the HIT popup', () => {
    renderBites(hitPopupHtml());
    const popup = document.querySelector('[data-testid="popup-stub"]');
    expect(popup.textContent).toContain('Half HP or fewer: +2d4 piercing?');
  });

  it('accept: rolls 2d4, applies its own damage, logs the grant (base+bonus legs)', async () => {
    renderBites(hitPopupHtml());
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d4');
    expect(call.context.damageType).toBe('piercing');
    expect(rollExpression).toHaveBeenCalledWith('2d4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('(half HP or fewer)');
    expect(grant.description).toContain('+7 piercing (2d4)');
  });

  it('crit accept doubles the clause dice ("2d4*2")', async () => {
    renderBites(hitPopupHtml({ isCrit: true }));
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('2d4');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('2d4');
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
