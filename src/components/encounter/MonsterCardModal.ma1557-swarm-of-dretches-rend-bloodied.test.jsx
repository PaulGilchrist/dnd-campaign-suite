// @improved-by-ai
// MA-1557: Swarm of Dretches "Rend" — inert prose Bloodied variant
// fixed on monsters.json actions[1] via conditional_damage riding the live
// MA-0007 GM-adjudication seam (buildChargeBonusOffer arms on cd?.dice).
// Byte-shape mirrors the modifier-bearing MA-0485 Chimera / MA-1555
// Crawling Claws twins (separate numeric modifier key; NEVER embedded in
// the dice string) — dice/modifier split per §MA-1555 pitfall. Seam is
// ADDITIVE (MA-1160): base Done still pays 3d6 + 2; accept rolls its own
// 3d4 + 2 bonus leg — RAW full-variant replacement caveat accepted exactly
// like swarm-family twins MA-1552/MA-1553/MA-1554/MA-1555.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 11, rolls: [3, 6], modifier: 2, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 22, rolls: [3, 6, 3, 6], modifier: 2, formula })),
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

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SWARM = monsters.find((m) => m.index === 'swarm-of-dretches');
const REND = SWARM.actions.find((a) => a.name === 'Rend');
const CHIMERA_BITE = monsters.find((m) => m.index === 'chimera').actions.find((a) => a.name === 'Bite');
const QUAGGOTH_CLAW = monsters.find((m) => m.index === 'quaggoth').actions.find((a) => a.name === 'Claw');
const BAT_BITES = monsters.find((m) => m.index === 'swarm-of-bats').actions.find((a) => a.name === 'Bites');
const CLAWS = monsters.find((m) => m.index === 'swarm-of-crawling-claws').actions.find((a) => a.name === 'Swarm of Grasping Hands');

const CREATURES = [
  { name: 'Swarm of Dretches 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium or Small' },
];

function hitPopupHtml(overrides = {}) {
  const offer = buildChargeBonusOffer(REND, 'Rend');
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Rend',
    rolls: [18],
    bonus: 4,
    targetName: 'Bandit 1',
    targetAc: 12,
    hit: true,
    autoDamage: { name: 'Rend', formula: '3d6 + 2', damageType: 'Slashing', source: 'Swarm of Dretches 1' },
    chargeBonusOffer: offer,
    ...overrides,
  };
}

function renderDretches(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Swarm of Dretches', size: 'Large', type: 'fiend', actions: SWARM.actions });
  damageUtils.__setFindCreatureReturn({ name: 'Swarm of Dretches 1', targetName: 'Bandit 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Swarm of Dretches 1' })} />);
}

function clickRendLink() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Rend/.test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
  expect(chip, 'Expected Rend +4 dice link').toBeTruthy();
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

describe('MA-1557 monsters.json data lock: Swarm of Dretches Rend Bloodied fix', () => {
  it('row identity + core legs byte-unchanged: +4, 5 ft., 3d6 + 2 Slashing', () => {
    expect(REND.attack_bonus).toBe(4);
    expect(REND.reach).toBe('5 ft.');
    expect(REND.damage_dice_primary).toBe('3d6 + 2');
    expect(REND.damage_type_primary).toBe('Slashing');
    expect(REND.description).toBe(
      'Melee Attack Roll: +4, reach 5 ft. Hit: 12 (3d6 + 2) Slashing damage, or 9 (3d4 + 2) Slashing damage if the swarm is Bloodied.'
    );
  });

  it('authors Bloodied conditional_damage in the modifier-bearing MA-0485 byte-shape (separate modifier key)', () => {
    const cd = REND.conditional_damage;
    expect(cd).toEqual({ dice: '3d4', modifier: 2, damage_type: 'Slashing', condition: 'Bloodied' });
    expect(cd.dice).not.toMatch(/\+/);
    expect(Object.keys(cd)).toEqual(Object.keys(CHIMERA_BITE.conditional_damage));
  });

  it('key placement: conditional_damage after damage_type_primary, last key (family byte-shape)', () => {
    const keys = Object.keys(REND);
    expect(keys.indexOf('conditional_damage')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('conditional_damage');
  });

  it('no escape clock, no hit_target_effect, no hit_conditions, no hit_choice chooser authored', () => {
    expect(REND.escape_dc).toBeUndefined();
    expect(REND.hit_target_effect).toBeUndefined();
    expect(REND.hit_conditions).toBeUndefined();
    expect(REND.hit_choice).toBeUndefined();
  });

  it('untouched siblings stay untouched: Multiattack plain, ravens inert; rats fixed MA-1565', () => {
    expect(SWARM.actions[0].name).toBe('Multiattack');
    expect(SWARM.actions[0].conditional_damage).toBeUndefined();
    expect(monsters.find((m) => m.index === 'swarm-of-rats').actions[0].conditional_damage).toEqual({ dice: '1d4', damage_type: 'Piercing', condition: 'Bloodied' });
    expect(monsters.find((m) => m.index === 'swarm-of-ravens').actions[0].conditional_damage).toBeUndefined();
  });
});

describe('MA-1557 buildChargeBonusOffer label', () => {
  it('builds the Bloodied variant offer with formula "3d4 + 2" and a condition-text label', () => {
    const offer = buildChargeBonusOffer(REND, 'Rend');
    expect(offer).toMatchObject({ dice: '3d4', modifier: 2, damageType: 'Slashing', condition: 'Bloodied', formula: '3d4 + 2', attackName: 'Rend' });
    expect(offer.label).toBe('Bloodied: +3d4+2 Slashing?');
    expect(offer.label).not.toMatch(/Charge/i);
  });

  it('keeps every existing charge-row label byte-identical (MA-0007/MA-0885/MA-1363/MA-1552/MA-1555 pins)', () => {
    const talons = monsters.find((m) => m.name === 'Aarakocra Skirmisher').actions[0];
    expect(buildChargeBonusOffer(talons, 'Talons').label).toBe('30+ ft Charge: +3d4+2 Slashing?');
    const goatRam = monsters.find((m) => m.index === 'goat').actions.find((a) => a.name === 'Ram');
    expect(buildChargeBonusOffer(goatRam, 'Ram').label).toBe('20+ ft Charge: +1d4 Bludgeoning?');
    expect(buildChargeBonusOffer(QUAGGOTH_CLAW, 'Claw').label).toBe('Bloodied: +2d6 Slashing?');
    expect(buildChargeBonusOffer(BAT_BITES, 'Bites').label).toBe('Bloodied: +1d4 Piercing?');
    expect(buildChargeBonusOffer(CLAWS, 'Swarm of Grasping Hands').label).toBe('Bloodied: +2d8+2 Necrotic?');
  });
});

describe('MA-1557 Swarm of Dretches Rend HIT popup offer + grant/decline', () => {
  it('forwards the Bloodied offer to the attack roll context', () => {
    renderDretches();
    clickRendLink();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].chargeBonusOffer).toMatchObject({ dice: '3d4', modifier: 2, damageType: 'Slashing', condition: 'Bloodied' });
    expect(attackRowMissingToHit(REND)).toBe(false);
  });

  it('renders the Bloodied offer button in the HIT popup', () => {
    renderDretches(hitPopupHtml());
    const popup = document.querySelector('[data-testid="popup-stub"]');
    expect(popup.textContent).toContain('Bloodied: +3d4+2 Slashing?');
  });

  it('accept: rolls 3d4 + 2, applies its own bonus leg, logs the grant (additive seam)', async () => {
    renderDretches(hitPopupHtml());
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('3d4 + 2');
    expect(call.context.damageType).toBe('Slashing');
    expect(rollExpression).toHaveBeenCalledWith('3d4 + 2');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant).toBeTruthy();
    expect(grant.description).toContain('(Bloodied)');
    expect(grant.description).toContain('+11 Slashing (3d4 + 2)');
  });

  it('crit accept doubles the clause formula ("3d4 + 2*2")', async () => {
    renderDretches(hitPopupHtml({ isCrit: true }));
    clickButton('charge-grant');
    await vi.waitFor(() => {
      expect(rollDamage).toHaveBeenCalled();
    });
    expect(rollExpressionDoubled).toHaveBeenCalledWith('3d4 + 2');
    expect(rollExpression).not.toHaveBeenCalled();
    const call = rollDamage.mock.calls[0][0];
    expect(call.formula).toBe('3d4 + 2');
    expect(call.total).toBe(22);
  });

  it('decline: logs the refusal with zero bonus roll (base only)', async () => {
    renderDretches(hitPopupHtml());
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
