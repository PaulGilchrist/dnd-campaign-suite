// @maintained-by-ai
// MA-0325: Azer Warhammer advertised two-handed 1d10+3 variant (monsters.json
// damage_dice_two_handed) — GM-adjudicated choice on the monster attack HIT
// popup (MA-0007 offer-on-result shape, ALTERNATIVE primary dice). This lane
// pins the MODAL seam only: Azer disk row data lock; exact offer forwarding at
// the chip press (armed row forwards the 5-key offer verbatim, one-handed rows
// forward null); chooser resolution at the modal handler (two-handed swaps Done
// auto-damage to 1d10 + 3 with the fire secondary untouched, one-handed keeps
// 1d8 + 3, each pick logs exactly once and cannot re-fire); unpicked Done rolls
// the base and logs the one-handed default once; crit doubles the chosen
// formula. Offer shape/byte-inert builder + select-log bytes are owned by
// MonsterCardHelpers.two-handed.test.js (owner lane :8-11, immovable —
// offer-shape :25-36, byte-inert :38-45, select-log :47-61); popup chooser
// gating + resolved notice by char-sheet/DiceRollResult.two-handed.test.jsx;
// generic autoDamageRoll seam args/crit/secondary transport by
// MonsterCardModal.auto-damage-roll.test.jsx — never re-pin those here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersJson from '../../../public/data/monsters.json';

const AZER_OFFER = {
  formula: '1d10 + 3',
  baseFormula: '1d8 + 3',
  damageType: 'bludgeoning',
  label: 'Two-Handed: 1d10 + 3 bludgeoning?',
  attackName: 'Warhammer',
};

// Only rollExpression/rollExpressionDoubled reach the modal (rollD20 is dead:
// rollAttack rides the mocked hook; sanitize's consumer AttackResultPopup is
// stubbed below).
vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 10, rolls: [7], modifier: 3, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 17, rolls: [7, 7], modifier: 3, formula })),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  const _options = [];
  const mockHook = vi.fn((name, campaign, options) => {
    _options.push(options);
    return {
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    };
  });
  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
    __getOptions: () => _options[_options.length - 1],
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

// Isolation only (consumed at press/render, never the lane under test).
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

// Stub the popup chain (real chooser gating is covered in
// DiceRollResult.two-handed.test.jsx) so handler behavior can be driven.
vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => {
    const offer = props.popupHtml?.twoHandedVariantOffer;
    return (
      <div data-testid="popup-stub">
        {offer && <span>{offer.label}</span>}
        <button onClick={() => props.onTwoHandedVariant?.('two-handed')}>two-handed</button>
        <button onClick={() => props.onTwoHandedVariant?.('one-handed')}>one-handed</button>
      </div>
    );
  },
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';

const { _setPopupHtml } = useLoggedDiceRoll;
const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;

const monsterList = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
const diskRow = (monsterName, actionName) =>
  monsterList.find((m) => m.name === monsterName).actions.find((a) => a.name === actionName);

function hitPopupHtml(overrides = {}) {
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Warhammer',
    rolls: [16],
    bonus: 5,
    targetName: 'AberrantSorcerer',
    targetAc: 9,
    hit: true,
    autoDamage: {
      name: 'Warhammer',
      formula: '1d8 + 3',
      damageType: 'Bludgeoning',
      secondaryFormula: '1d6',
      secondaryDamageType: 'Fire',
      twoHandedVariantOffer: AZER_OFFER,
      twoHandedChoice: 'one-handed-default',
      source: 'Azer 1',
    },
    twoHandedVariantOffer: AZER_OFFER,
    ...overrides,
  };
}

function renderAzer(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Azer', actions: [diskRow('Azer', 'Warhammer')] });
  damageUtils.__setFindCreatureReturn({ name: 'Azer 1', targetName: 'AberrantSorcerer', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Azer 1', targetName: 'AberrantSorcerer' }, { name: 'AberrantSorcerer', type: 'player' }], creatureName: 'Azer 1' })} />);
}

function clickChipLink(text) {
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === text);
  expect(link, `Expected ${text} dice link`).toBeTruthy();
  fireEvent.click(link);
}

function clickButton(label) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === label);
  expect(btn, `Expected "${label}" button`).toBeTruthy();
  fireEvent.click(btn);
}

function variantLogs(automationType) {
  return addEntry.mock.calls.map((c) => c[1]).filter((e) => e && e.automationType === automationType);
}

async function doneWith(autoDamage, isCrit = false) {
  await useLoggedDiceRoll.__getOptions().autoDamageRoll(autoDamage, isCrit);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0325 data lock (monsters.json Azer Warhammer)', () => {
  it('authors the two-handed variant beside the primary, fire secondary intact', () => {
    const row = diskRow('Azer', 'Warhammer');
    expect(row.attack_bonus).toBe(5);
    expect(row.damage_dice_primary).toBe('1d8 + 3');
    expect(row.damage_dice_two_handed).toBe('1d10 + 3');
    expect(row.damage_type_primary).toBe('bludgeoning');
    expect(row.damage_dice_secondary).toBe('1d6');
    expect(row.damage_type_secondary).toBe('fire');
    expect(row.description).toContain('if used with two hands to make a melee attack');
  });
});

describe('MA-0325 offer forwarding at the chip press', () => {
  // Chip render folded into press: clicking the dice chip is what proves the
  // chip armed; rollAttack args pinned BY NAME with the exact forwarded offer.
  it.each([
    ['Azer', 'Azer 1', 'Warhammer', '+5', 5, AZER_OFFER],
    ['Goblin', 'Goblin', 'Club', '+4', 4, null],
  ])('%s chip press forwards the exact twoHandedVariantOffer (%s row)', (name, instance, attackName, chip, bonus, expectedOffer) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    _setPopupHtml(null);
    const action = name === 'Azer'
      ? diskRow('Azer', 'Warhammer')
      : { name: 'Club', attack_bonus: 4, description: 'Melee Weapon Attack.', reach: '5 ft.', damage_dice_primary: '1d4 + 2', damage_type_primary: 'bludgeoning' };
    const m = makeMonster({ name, actions: [action] });
    damageUtils.__setFindCreatureReturn({ name: instance, targetName: attackName === 'Warhammer' ? 'AberrantSorcerer' : null, conditions: [] });
    const creatures = attackName === 'Warhammer'
      ? [{ name: instance, targetName: 'AberrantSorcerer' }, { name: 'AberrantSorcerer', type: 'player' }]
      : [{ name: instance }];
    render(<MonsterCardModal {...makeProps(m, { creatures, creatureName: instance })} />);
    clickChipLink(chip);
    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [rolledName, rolledBonus, ctx] = rollAttack.mock.calls[0];
    expect(rolledName).toBe(attackName);
    expect(rolledBonus).toBe(bonus);
    expect(ctx.twoHandedVariantOffer).toEqual(expectedOffer);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe('MA-0325 chooser resolution + Done auto-damage', () => {
  it('two-handed pick swaps Done auto-damage to 1d10 + 3 (fire secondary untouched), logs once, Done rolls the swapped formula', async () => {
    renderAzer(hitPopupHtml());
    clickButton('two-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBe('two-handed');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d10 + 3');
    expect(popup.autoDamage.twoHandedChoice).toBe('two-handed');
    expect(popup.autoDamage.secondaryFormula).toBe('1d6');
    expect(popup.autoDamage.secondaryDamageType).toBe('Fire');
    const pickLogs = variantLogs('two_handed_variant_selected');
    expect(pickLogs).toHaveLength(1);
    expect(pickLogs[0].description).toContain('1d10 + 3');
    expect(variantLogs('one_handed_variant_selected')).toHaveLength(0);
    await doneWith({ ...popup.autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d10 + 3');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollDamage.mock.calls).toHaveLength(1);
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d10 + 3');
    expect(variantLogs('two_handed_variant_selected')).toHaveLength(1);
    expect(variantLogs('one_handed_variant_selected')).toHaveLength(0);
  });

  it('one-handed pick keeps 1d8 + 3, logs the choice once, and Done does not re-log the default', async () => {
    renderAzer(hitPopupHtml());
    clickButton('one-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBe('one-handed');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d8 + 3');
    expect(popup.autoDamage.twoHandedChoice).toBe('one-handed');
    expect(popup.autoDamage.secondaryFormula).toBe('1d6');
    const pickLogs = variantLogs('one_handed_variant_selected');
    expect(pickLogs).toHaveLength(1);
    expect(pickLogs[0].description).toContain('1d8 + 3');
    expect(variantLogs('two_handed_variant_selected')).toHaveLength(0);
    await doneWith({ ...popup.autoDamage });
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d8 + 3');
    expect(variantLogs('one_handed_variant_selected')).toHaveLength(1);
  });

  // Resolver guards (MonsterCardModal resolveTwoHandedVariantSelection early
  // return): a resolved popup cannot re-fire, an offer-less popup no-ops.
  it.each([
    ['an already-resolved popup', hitPopupHtml({ twoHandedVariantResolved: 'two-handed' })],
    ['a popup with no two-handed offer', hitPopupHtml({ twoHandedVariantOffer: null })],
  ])('clicking %s does nothing', async (_case, popupHtml) => {
    renderAzer(popupHtml);
    clickButton('two-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().autoDamage.formula).toBe('1d8 + 3');
    });
    expect(variantLogs('two_handed_variant_selected')).toHaveLength(0);
    expect(variantLogs('one_handed_variant_selected')).toHaveLength(0);
  });

  it('unpicked Done applies the one-handed base and logs the default once; offer-less auto-damage stays inert', async () => {
    renderAzer(hitPopupHtml());
    await doneWith({ ...hitPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d8 + 3');
    const defaultLogs = variantLogs('one_handed_variant_selected');
    expect(defaultLogs).toHaveLength(1);
    expect(defaultLogs[0].description).toContain('default');
    expect(defaultLogs[0].description).toContain('1d8 + 3');
    expect(variantLogs('two_handed_variant_selected')).toHaveLength(0);
    await doneWith({ name: 'Warhammer', formula: '1d8 + 3', damageType: 'Bludgeoning', source: 'Azer 1' });
    expect(rollDamage.mock.calls).toHaveLength(2);
    expect(variantLogs('one_handed_variant_selected')).toHaveLength(1);
    expect(variantLogs('two_handed_variant_selected')).toHaveLength(0);
  });

  it('crit doubles the chosen two-handed formula via the existing Done seam', async () => {
    renderAzer(hitPopupHtml());
    clickButton('two-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBe('two-handed');
    });
    await doneWith({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage }, true);
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d10 + 3');
    expect(rollExpression).not.toHaveBeenCalled();
  });
});
