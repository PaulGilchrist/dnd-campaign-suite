// @improved-by-ai
// MA-0325: Azer Warhammer advertised two-handed 1d10+3 variant (monsters.json
// damage_dice_two_handed) — GM-adjudicated choice on the monster attack HIT
// popup (MA-0007 offer-on-result shape, ALTERNATIVE primary dice).
// Locks: azer row authors the variant; offer forwarded to rollAttack context;
// two-handed pick swaps the Done auto-damage formula to 1d10 + 3 (fire
// secondary unchanged) and logs; one-handed pick keeps 1d8 + 3 and logs;
// resolved decisions cannot re-fire; one-handed rows are byte-inert.
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

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 10, rolls: [7], modifier: 3, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 17, rolls: [7, 7], modifier: 3, formula })),
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
import { buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const AZER_WARHAMMER_ACTION = {
  name: 'Warhammer',
  description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage, or 8 (1d10 + 3) bludgeoning damage if used with two hands to make a melee attack, plus 3 (1d6) fire damage.',
  attack_bonus: 5,
  reach: '5 ft.',
  damage_dice_primary: '1d8 + 3',
  damage_dice_two_handed: '1d10 + 3',
  damage_type_primary: 'bludgeoning',
  damage_dice_secondary: '1d6',
  damage_type_secondary: 'fire',
};

const CREATURES = [
  { name: 'Azer 1', targetName: 'AberrantSorcerer' },
  { name: 'AberrantSorcerer', type: 'player' },
];

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
  const m = makeMonster({ name: 'Azer', actions: [AZER_WARHAMMER_ACTION] });
  damageUtils.__setFindCreatureReturn({ name: 'Azer 1', targetName: 'AberrantSorcerer', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Azer 1' })} />);
}

function clickChipLink(text = '+5') {
  const links = document.querySelectorAll('.mc-dice-link');
  const link = Array.from(links).find((el) => el.textContent.trim() === text);
  expect(link, `Expected ${text} dice link`).toBeTruthy();
  fireEvent.click(link);
}

function clickButton(label) {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === label);
  expect(btn, `Expected "${label}" button`).toBeTruthy();
  fireEvent.click(btn);
}

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

async function doneWith(autoDamage) {
  const options = useLoggedDiceRoll.__getOptions();
  await options.autoDamageRoll(autoDamage, false);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0325 data lock (monsters.json)', () => {
  it('the Azer Warhammer row authors damage_dice_two_handed "1d10 + 3"', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const azer = monsters.find((m) => m.name === 'Azer');
    const warhammer = azer.actions[0];
    expect(warhammer.name).toBe('Warhammer');
    expect(warhammer.damage_dice_primary).toBe('1d8 + 3');
    expect(warhammer.damage_dice_two_handed).toBe('1d10 + 3');
    expect(warhammer.damage_dice_secondary).toBe('1d6');
    expect(warhammer.damage_type_secondary).toBe('fire');
  });
});

describe('MA-0325 buildTwoHandedVariantOffer', () => {
  it('builds the offer from damage_dice_two_handed metadata', () => {
    const offer = buildTwoHandedVariantOffer(AZER_WARHAMMER_ACTION, 'Warhammer');
    expect(offer).toMatchObject({ formula: '1d10 + 3', baseFormula: '1d8 + 3', damageType: 'bludgeoning', attackName: 'Warhammer' });
    expect(offer.label).toContain('1d10 + 3');
  });

  it('returns null for one-handed rows (byte-inert guardrail)', () => {
    expect(buildTwoHandedVariantOffer({ name: 'Club', attack_bonus: 4, damage_dice_primary: '1d4 + 2' }, 'Club')).toBeNull();
    expect(buildTwoHandedVariantOffer({ name: 'Hammer', attack_bonus: 5, damage_dice_primary: '1d10 + 3', damage_dice_two_handed: '1d10 + 3' }, 'Hammer')).toBeNull();
    expect(buildTwoHandedVariantOffer(undefined, 'Club')).toBeNull();
  });
});

describe('MA-0325 offer forwarding', () => {
  it('forwards twoHandedVariantOffer to the attack roll context', () => {
    renderAzer();
    clickChipLink();
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.twoHandedVariantOffer).toMatchObject({ formula: '1d10 + 3', baseFormula: '1d8 + 3' });
  });

  it('forwards null offer for one-handed rows', () => {
    const m = makeMonster({ name: 'Goblin', actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.', damage_dice_primary: '1d4 + 2', damage_type_primary: 'bludgeoning' }] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', targetName: null, conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin' }] })} />);
    clickChipLink('+4');
    expect(rollAttack.mock.calls[0][2].twoHandedVariantOffer).toBeNull();
  });
});

describe('MA-0325 chooser resolution on HIT popup', () => {
  it('two-handed pick: swaps Done auto-damage to 1d10 + 3 (secondary untouched), logs, marks resolved', async () => {
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
    const pick = findLogEntry('two_handed_variant_selected');
    expect(pick).toBeTruthy();
    expect(pick.description).toContain('TWO-HANDED');
    expect(pick.description).toContain('1d10 + 3');
    expect(findLogEntry('one_handed_variant_selected')).toBeFalsy();
  });

  it('one-handed pick: auto-damage stays 1d8 + 3, logs the choice once, marks resolved', async () => {
    renderAzer(hitPopupHtml());
    clickButton('one-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBe('one-handed');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d8 + 3');
    expect(popup.autoDamage.twoHandedChoice).toBe('one-handed');
    const pick = findLogEntry('one_handed_variant_selected');
    expect(pick).toBeTruthy();
    expect(pick.description).toContain('1d8 + 3');
    expect(findLogEntry('two_handed_variant_selected')).toBeFalsy();
    await doneWith({ ...popup.autoDamage });
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d8 + 3');
    expect(addEntry.mock.calls.map((c) => c[1]).filter((e) => e && e.automationType === 'one_handed_variant_selected')).toHaveLength(1);
  });

  it('a resolved decision cannot re-fire the chooser', async () => {
    renderAzer(hitPopupHtml({ twoHandedVariantResolved: 'two-handed' }));
    clickButton('two-handed');
    await new Promise((r) => setTimeout(r, 0));
    expect(findLogEntry('two_handed_variant_selected')).toBeFalsy();
    expect(useLoggedDiceRoll.__getPopupHtml().autoDamage.formula).toBe('1d8 + 3');
  });

  it('does nothing when the popup has no two-handed offer', async () => {
    renderAzer(hitPopupHtml({ twoHandedVariantOffer: null }));
    clickButton('two-handed');
    await new Promise((r) => setTimeout(r, 0));
    expect(addEntry).not.toHaveBeenCalled();
    expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBeFalsy();
  });
});

describe('MA-0325 Done auto-damage resolution', () => {
  it('unpicked Done applies the one-handed base and logs the default choice', async () => {
    renderAzer(hitPopupHtml());
    await doneWith({ ...hitPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d8 + 3');
    expect(rollDamage).toHaveBeenCalled();
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d8 + 3');
    const dflt = findLogEntry('one_handed_variant_selected');
    expect(dflt).toBeTruthy();
    expect(dflt.description).toContain('default');
  });

  it('two-handed pick then Done rolls 1d10 + 3 exactly once with no default log', async () => {
    renderAzer(hitPopupHtml());
    clickButton('two-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBe('two-handed');
    });
    await doneWith({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d10 + 3');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d10 + 3');
    expect(findLogEntry('two_handed_variant_selected')).toBeTruthy();
    expect(findLogEntry('one_handed_variant_selected')).toBeFalsy();
  });

  it('crit doubles the chosen two-handed formula via the existing seam', async () => {
    renderAzer(hitPopupHtml());
    clickButton('two-handed');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().twoHandedVariantResolved).toBe('two-handed');
    });
    const options = useLoggedDiceRoll.__getOptions();
    await options.autoDamageRoll({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage }, true);
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d10 + 3');
  });

  it('one-handed rows resolve byte-inert: no chooser logs', async () => {
    renderAzer(hitPopupHtml({ twoHandedVariantOffer: null }));
    const autoDamage = { name: 'Warhammer', formula: '1d8 + 3', damageType: 'Bludgeoning', source: 'Azer 1' };
    await doneWith(autoDamage);
    expect(rollExpression).toHaveBeenCalledWith('1d8 + 3');
    expect(findLogEntry('one_handed_variant_selected')).toBeFalsy();
    expect(findLogEntry('two_handed_variant_selected')).toBeFalsy();
  });
});
