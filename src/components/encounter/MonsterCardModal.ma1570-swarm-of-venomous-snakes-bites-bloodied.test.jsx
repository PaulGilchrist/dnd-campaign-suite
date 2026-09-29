// @improved-by-ai
// MA-1570: Swarm of Venomous Snakes "Bites" — inert prose Bloodied variant
// fixed on monsters.json swarm-of-venomous-snakes actions[0] via
// conditional_damage riding the live MA-0007 GM-adjudication seam
// (buildChargeBonusOffer arms on cd?.dice). DUAL-POOL twin: the row keeps its
// LIVE damage_dice_secondary "3d6" Poison combo rider (MA-0427/§516
// combined_damage_roll) UNTOUCHED — the Bloodied variant applies to PRIMARY
// only, exactly like the MA-0647 drow-mage Staff first-versatile-with-live-
// secondary precedent, on the MA-1552/MA-1562 swarm-family bloodied lane.
// Byte-shape mirrors the modifier-bearing MA-0485/MA-1555/MA-1562/MA-1569
// twins (separate numeric modifier key, NEVER embedded "+" in dice — §MA-1555).
// Placement: conditional_damage AFTER the damage_dice_secondary/damage_type_
// secondary pair (giant-elk Ram / mimic Bite multi-key ordering precedent).
// Seam is ADDITIVE (MA-1160/§MA-1555): accept pays bonus leg + base primary
// + poison rider intact; RAW full-variant replacement caveat is the accepted
// family residual (§70).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 8, rolls: [4], modifier: 4, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 12, rolls: [4, 4], modifier: 4, formula })),
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
import { buildChargeBonusOffer, attackRowMissingToHit } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const SNAKES = monsters.find((m) => m.index === 'swarm-of-venomous-snakes');
const BITES = SNAKES.actions.find((a) => a.name === 'Bites');
const STIRGES = monsters.find((m) => m.index === 'swarm-of-stirges').actions.find((a) => a.name === 'Swarm of Proboscises');
const PIRANHAS_BITES = monsters.find((m) => m.index === 'swarm-of-piranhas').actions.find((a) => a.name === 'Bites');
const BAT_BITES = monsters.find((m) => m.index === 'swarm-of-bats').actions.find((a) => a.name === 'Bites');
const CLAWS = monsters.find((m) => m.index === 'swarm-of-crawling-claws').actions.find((a) => a.name === 'Swarm of Grasping Hands');
const CENTIPEDES_BITES = monsters.find((m) => m.index === 'swarm-of-centipedes').actions.find((a) => a.name === 'Bites');
const MIMIC_BITE = monsters.find((m) => m.index === 'mimic').actions.find((a) => a.name === 'Bite');
const ELK_RAM = monsters.find((m) => m.index === 'giant-elk').actions.find((a) => a.name === 'Ram');
const STAFF = monsters.find((m) => m.index === 'drow-mage').actions.find((a) => a.name === 'Staff');

const CREATURES = [
  { name: 'Swarm of Venomous Snakes 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(BITES, 'Bites');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Bites',
    rolls: [18],
    bonus: 6,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Bites', formula: '1d8 + 4', damageType: 'Piercing', source: 'Swarm of Venomous Snakes 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderSnakes(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Swarm of Venomous Snakes', size: 'Medium', type: 'swarm', actions: SNAKES.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Venomous Snakes 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Venomous Snakes 1' })} />);
}

function clickBitesLink() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Bites/.test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+6');
  expect(chip, 'Expected Bites +6 dice link').toBeTruthy();
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

describe('MA-1570 monsters.json data lock: Swarm of Venomous Snakes Bites Bloodied fix', () => {
  it('row identity + core legs byte-unchanged: +6, 5 ft., 1d8 + 4 Piercing, 3d6 Poison', () => {
    expect(SNAKES.actions.length).toBe(1);
    expect(BITES.attack_bonus).toBe(6);
    expect(BITES.reach).toBe('5 ft.');
    expect(BITES.damage_dice_primary).toBe('1d8 + 4');
    expect(BITES.damage_type_primary).toBe('Piercing');
    expect(BITES.description).toBe(
      'Melee Attack Roll: +6, reach 5 ft. Hit: 8 (1d8 + 4) Piercing damage\u2014or 6 (1d4 + 4) Piercing damage if the swarm is Bloodied\u2014plus 10 (3d6) Poison damage.'
    );
  });

  it('authors Bloodied conditional_damage in the modifier-bearing MA-0485/MA-1555 byte-shape (separate modifier key, no "+" in dice)', () => {
    const cd = BITES.conditional_damage;
    expect(cd).toEqual({ dice: '1d4', modifier: 4, damage_type: 'Piercing', condition: 'Bloodied' });
    expect(cd.dice).not.toMatch(/\+/);
    expect(Object.keys(cd)).toEqual(Object.keys(STIRGES.conditional_damage));
    expect(Object.keys(cd)).toEqual(Object.keys(PIRANHAS_BITES.conditional_damage));
  });

  it('key placement: conditional_damage AFTER the live secondary pair, last key (giant-elk Ram / mimic Bite multi-key ordering precedent)', () => {
    const keys = Object.keys(BITES);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
    expect(keys.indexOf('damage_type_secondary')).toBe(keys.indexOf('damage_dice_secondary') + 1);
  });

  it('poison rider byte-locked UNTOUCHED: 3d6 Poison rides unchanged (MA-0427/§516 dual-pool, MA-0647 twin)', () => {
    expect(BITES.damage_dice_secondary).toBe('3d6');
    expect(BITES.damage_type_secondary).toBe('Poison');
    expect(BITES.flat_damage_secondary).toBeUndefined();
    expect(BITES.secondary_condition).toBeUndefined();
  });

  it('no escape clock, no hit_target_effect, no hit_conditions, no hit_choice, no two-handed chooser authored', () => {
    expect(BITES.escape_dc).toBeUndefined();
    expect(BITES.hit_target_effect).toBeUndefined();
    expect(BITES.hit_conditions).toBeUndefined();
    expect(BITES.hit_choice).toBeUndefined();
    expect(BITES.damage_dice_two_handed).toBeUndefined();
  });

  it('fix touches ONLY this row: unique byte anchor count==1, siblings byte-locked', () => {
    const anchor = '"description": "Melee Attack Roll: +6, reach 5 ft. Hit: 8 (1d8 + 4) Piercing damage\u2014or 6 (1d4 + 4) Piercing damage if the swarm is Bloodied\u2014plus 10 (3d6) Poison damage.",';
    expect(RAW.split(anchor).length - 1).toBe(1);
    expect(STIRGES.conditional_damage).toEqual({ dice: '1d10', modifier: 3, damage_type: 'Piercing', condition: 'Bloodied' });
    expect(PIRANHAS_BITES.conditional_damage).toEqual({ dice: '1d4', modifier: 3, damage_type: 'Piercing', condition: 'Bloodied' });
    expect(BAT_BITES.conditional_damage).toEqual({ dice: '1d4', damage_type: 'Piercing', condition: 'Bloodied' });
    expect(CLAWS.conditional_damage).toEqual({ dice: '2d8', modifier: 2, damage_type: 'Necrotic', condition: 'Bloodied' });
    expect(CENTIPEDES_BITES.conditional_damage).toEqual({ dice: '2d4', damage_type: 'piercing', condition: 'half HP or fewer' });
    expect(MIMIC_BITE.conditional_damage).toEqual({ dice: '1d8', modifier: 0, damage_type: 'Piercing', condition: 'the target is Grappled by the mimic' });
    expect(ELK_RAM.conditional_damage).toEqual({ dice: '2d4', damage_type: 'Bludgeoning', condition: 'moved 20+ feet straight toward target immediately before the hit' });
    expect(STAFF.conditional_damage).toBeUndefined();
    expect(STAFF.damage_dice_secondary).toBe('1d6');
    expect(STAFF.damage_type_secondary).toBe('poison');
  });
});

describe('MA-1570 buildChargeBonusOffer label', () => {
  it('builds the Bloodied variant offer with formula "1d4 + 4" and a condition-text label', () => {
    const offer = buildChargeBonusOffer(BITES, 'Bites');
    expect(offer).toMatchObject({ dice: '1d4', modifier: 4, damageType: 'Piercing', condition: 'Bloodied', formula: '1d4 + 4', attackName: 'Bites' });
    expect(offer.label).toBe('Bloodied: +1d4+4 Piercing?');
    expect(offer.label).not.toMatch(/Charge/i);
  });

  it('keeps every swarm-family twin label byte-identical (MA-1552/MA-1555/MA-1562/MA-1569 pins)', () => {
    expect(buildChargeBonusOffer(BAT_BITES, 'Bites').label).toBe('Bloodied: +1d4 Piercing?');
    expect(buildChargeBonusOffer(PIRANHAS_BITES, 'Bites').label).toBe('Bloodied: +1d4+3 Piercing?');
    expect(buildChargeBonusOffer(CLAWS, 'Swarm of Grasping Hands').label).toBe('Bloodied: +2d8+2 Necrotic?');
    expect(buildChargeBonusOffer(STIRGES, 'Swarm of Proboscises').label).toBe('Bloodied: +1d10+3 Piercing?');
  });
});

describe('MA-1570 Swarm of Venomous Snakes Bites HIT popup offer + grant/decline', () => {
  it('forwards the Bloodied offer AND the live poison rider to the attack roll context (variant = primary-only, secondary rides)', () => {
    renderSnakes();
    clickBitesLink();
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.chargeBonusOffer).toMatchObject({ dice: '1d4', modifier: 4, formula: '1d4 + 4', damageType: 'Piercing', condition: 'Bloodied' });
    expect(ctx.autoDamageFormula).toBe('1d8 + 4');
    expect(ctx.damageType).toBe('Piercing');
    expect(ctx.autoDamageSecondaryFormula).toBe('3d6');
    expect(ctx.autoDamageSecondaryDamageType).toBe('Poison');
    expect(attackRowMissingToHit(BITES)).toBe(false);
  });

  it('renders the Bloodied offer button in the HIT popup', () => {
    renderSnakes(hitPopupHtml());
    const popup = document.querySelector('[data-testid="popup-stub"]');
    expect(popup.textContent).toContain('Bloodied: +1d4+4 Piercing?');
  });

  it('accept: rolls 1d4 + 4, applies its own bonus leg, logs the grant (additive seam, poison rides on base Done)', async () => {
    renderSnakes(hitPopupHtml());
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d4 + 4');
    expect(call.context.damageType).toBe('Piercing');
    expect(rollExpression).toHaveBeenCalledWith('1d4 + 4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('(Bloodied)');
    expect(grant.description).toContain('+8 Piercing (1d4 + 4)');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('granted');
    });
  });

  it('crit accept doubles the clause formula ("1d4 + 4*2")', async () => {
    renderSnakes(hitPopupHtml({ isCrit: true }));
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d4 + 4');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('1d4 + 4');
    expect(call.total).toBe(12);
  });

  it('decline: logs the refusal with zero bonus roll (base + poison rider only)', async () => {
    renderSnakes(hitPopupHtml());
    clickButton('charge-decline');
    await vi.waitFor(() => {
      const decline = findLogEntry('conditional_damage_declined');
      expect(decline).toBeTruthy();
      expect(decline.description).toContain('base damage only');
    });
    expect(rollDamage).not.toHaveBeenCalled();
    expect(rollExpression).not.toHaveBeenCalled();
    expect(findLogEntry('conditional_damage_granted')).toBeFalsy();
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().chargeBonusResolved).toBe('declined');
    });
  });
});
