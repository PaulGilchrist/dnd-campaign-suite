// @improved-by-ai
// MA-0436: Bugbear Javelin "melee or ranged" dual-mode (monsters.json
// damage_dice_ranged + range "30/120") — GM-adjudicated damage-dice choice on
// the monster attack HIT popup (MA-0325 two-handed mirror, MA-0007
// offer-on-result shape). Locks: bugbear row authors the variant dice + band;
// parser builds the offer and arms ONLY on melee-or-ranged rows; offer
// forwarded to rollAttack context; ranged pick swaps the Done auto-damage
// formula to 1d6 + 2 and logs the mode + band advisory; melee pick and
// unpicked Done keep 2d6 + 2 and log; resolved decisions cannot re-fire;
// rows without the fields are byte-inert. MA-0439 extends the same locks to
// the Bugbear Chief twin row (+5, 2d6 + 3 <-> 1d6 + 3, "30/120").
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersJson from '../../../public/data/monsters.json';

const JAVELIN_OFFER = {
  formula: '1d6 + 2',
  baseFormula: '2d6 + 2',
  damageType: 'Piercing',
  label: 'Ranged: 1d6 + 2 Piercing?',
  attackName: 'Javelin',
  range: '30/120',
  normalFt: 30,
  longFt: 120,
};

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 5, rolls: [3], modifier: 2, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 10, rolls: [3, 3], modifier: 2, formula })),
  rollD20: vi.fn(() => 19),
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
// DiceRollResult.ranged-variant.test.jsx) so handler behavior can be driven.
vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => {
    const offer = props.popupHtml?.rangedVariantOffer;
    return (
      <div data-testid="popup-stub">
        {offer && <span>{offer.label}</span>}
        <button onClick={() => props.onRangedVariant?.('ranged')}>ranged</button>
        <button onClick={() => props.onRangedVariant?.('melee')}>melee</button>
      </div>
    );
  },
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildRangedVariantOffer, parseRangedBand } from './MonsterCardHelpers.js';

const { _rollAttack: rollAttack, _rollDamage: rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const BUGBEAR_JAVELIN_ACTION = {
  name: 'Javelin',
  description: 'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 9 (2d6 + 2) piercing damage in melee or 5 (1d6 + 2) piercing damage at range.',
  attack_bonus: 4,
  reach: '5 ft.',
  range: '30/120',
  damage_dice_primary: '2d6 + 2',
  damage_dice_ranged: '1d6 + 2',
  damage_type_primary: 'Piercing',
};

// MA-0439: Bugbear Chief twin row (attack_bonus 5, 2d6 + 3 <-> 1d6 + 3)
const BUGBEAR_CHIEF_JAVELIN_ACTION = {
  name: 'Javelin',
  description: 'Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 10 (2d6 + 3) piercing damage in melee or 6 (1d6 + 3) piercing damage at range.',
  attack_bonus: 5,
  reach: '5 ft.',
  range: '30/120',
  damage_dice_primary: '2d6 + 3',
  damage_dice_ranged: '1d6 + 3',
  damage_type_primary: 'Piercing',
};

const CHIEF_JAVELIN_OFFER = {
  formula: '1d6 + 3',
  baseFormula: '2d6 + 3',
  damageType: 'Piercing',
  label: 'Ranged: 1d6 + 3 Piercing?',
  attackName: 'Javelin',
  range: '30/120',
  normalFt: 30,
  longFt: 120,
};

const CREATURES = [
  { name: 'Bugbear 1', targetName: 'AasimarTest' },
  { name: 'AasimarTest', type: 'player' },
];

function hitPopupHtml(overrides = {}) {
  return {
    type: 'd20',
    rollType: 'attack',
    name: 'Javelin',
    rolls: [19],
    bonus: 4,
    targetName: 'AasimarTest',
    targetAc: 12,
    hit: true,
    autoDamage: {
      name: 'Javelin',
      formula: '2d6 + 2',
      damageType: 'Piercing',
      rangedVariantOffer: JAVELIN_OFFER,
      rangedChoice: 'melee-default',
      source: 'Bugbear 1',
    },
    rangedVariantOffer: JAVELIN_OFFER,
    ...overrides,
  };
}

function renderBugbear(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Bugbear', actions: [BUGBEAR_JAVELIN_ACTION] });
  damageUtils.__setFindCreatureReturn({ name: 'Bugbear 1', targetName: 'AasimarTest', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Bugbear 1' })} />);
}

function chiefHitPopupHtml(overrides = {}) {
  return hitPopupHtml({
    bonus: 5,
    autoDamage: {
      name: 'Javelin',
      formula: '2d6 + 3',
      damageType: 'Piercing',
      rangedVariantOffer: CHIEF_JAVELIN_OFFER,
      rangedChoice: 'melee-default',
      source: 'Bugbear Chief 1',
    },
    rangedVariantOffer: CHIEF_JAVELIN_OFFER,
    ...overrides,
  });
}

function renderChief(popupHtml = null) {
  _setPopupHtml(popupHtml);
  const m = makeMonster({ name: 'Bugbear Chief', actions: [BUGBEAR_CHIEF_JAVELIN_ACTION] });
  damageUtils.__setFindCreatureReturn({ name: 'Bugbear Chief 1', targetName: 'AasimarTest', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Bugbear Chief 1', targetName: 'AasimarTest' }, { name: 'AasimarTest', type: 'player' }], creatureName: 'Bugbear Chief 1' })} />);
}

function clickChipLink(text = '+4') {
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

describe('MA-0436 data lock (monsters.json)', () => {
  it('the Bugbear Javelin row authors damage_dice_ranged "1d6 + 2" + range "30/120"', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const bugbear = monsters.find((m) => m.name === 'Bugbear');
    const javelin = bugbear.actions.find((a) => a.name === 'Javelin');
    expect(javelin.damage_dice_primary).toBe('2d6 + 2');
    expect(javelin.damage_dice_ranged).toBe('1d6 + 2');
    expect(javelin.range).toBe('30/120');
    expect(javelin.reach).toBe('5 ft.');
  });

  // MA-0439: Bugbear Chief twin row byte-mirrors the MA-0436 shape.
  it('the Bugbear Chief Javelin row authors damage_dice_ranged "1d6 + 3" + range "30/120"', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const chief = monsters.find((m) => m.name === 'Bugbear Chief');
    const javelin = chief.actions.find((a) => a.name === 'Javelin');
    expect(javelin.attack_bonus).toBe(5);
    expect(javelin.damage_dice_primary).toBe('2d6 + 3');
    expect(javelin.damage_dice_ranged).toBe('1d6 + 3');
    expect(javelin.range).toBe('30/120');
    expect(javelin.reach).toBe('5 ft.');
  });
});

describe('MA-0436 parseRangedBand + buildRangedVariantOffer', () => {
  it('parses the "30/120" band', () => {
    expect(parseRangedBand('30/120')).toEqual({ normalFt: 30, longFt: 120 });
    expect(parseRangedBand('5 ft.')).toBeNull();
    expect(parseRangedBand(null)).toBeNull();
  });

  it('builds the offer from ranged variant metadata', () => {
    const offer = buildRangedVariantOffer(BUGBEAR_JAVELIN_ACTION, 'Javelin');
    expect(offer).toMatchObject({ formula: '1d6 + 2', baseFormula: '2d6 + 2', damageType: 'Piercing', attackName: 'Javelin', normalFt: 30, longFt: 120 });
    expect(offer.label).toContain('1d6 + 2');
  });

  it('builds the Bugbear Chief offer from its authored ranged variant metadata (MA-0439)', () => {
    const offer = buildRangedVariantOffer(BUGBEAR_CHIEF_JAVELIN_ACTION, 'Javelin');
    expect(offer).toMatchObject({ formula: '1d6 + 3', baseFormula: '2d6 + 3', damageType: 'Piercing', attackName: 'Javelin', range: '30/120', normalFt: 30, longFt: 120 });
    expect(offer.label).toBe('Ranged: 1d6 + 3 Piercing?');
  });

  it('returns null unless the row is an authored melee-or-ranged variant (byte-inert guardrail)', () => {
    expect(buildRangedVariantOffer({ name: 'Morningstar', attack_bonus: 4, reach: '5 ft.', damage_dice_primary: '2d8 + 2' }, 'Morningstar')).toBeNull();
    expect(buildRangedVariantOffer({ name: 'Javelin', damage_dice_primary: '2d6 + 2', damage_dice_ranged: '2d6 + 2', description: 'Melee or Ranged Weapon Attack.' }, 'Javelin')).toBeNull();
    expect(buildRangedVariantOffer({ name: 'Rock', damage_dice_primary: '2d6 + 5', damage_dice_ranged: '1d6 + 5', description: 'Ranged Weapon Attack: +8 to hit.' }, 'Rock')).toBeNull();
    expect(buildRangedVariantOffer(undefined, 'Javelin')).toBeNull();
  });
});

// MA-0529: Cult Fanatic Dagger — dice-identical dual-mode twin of MA-0436.
// RAW 20/60 band with "1d4 + 2" in BOTH modes: the authored band alone arms
// the chooser (mode CHOICE is the enforced part; band advisory rides the
// ranged-select log). Identical dice WITHOUT a band stay inert.
describe('MA-0529 cult-fanatic identical-dice ranged band lock', () => {
  const CULT_FANATIC_DAGGER = {
    name: 'Dagger',
    description: 'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one creature. Hit: 4 (1d4 + 2) piercing damage.',
    attack_bonus: 4,
    reach: '5 ft.',
    range: '20/60',
    damage_dice_primary: '1d4 + 2',
    damage_dice_ranged: '1d4 + 2',
    damage_type_primary: 'Piercing',
  };

  it('the Cult Fanatic Dagger row authors range "20/60" + damage_dice_ranged "1d4 + 2"', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const fanatic = monsters.find((m) => m.name === 'Cult Fanatic');
    const dagger = fanatic.actions[1];
    expect(dagger.name).toBe('Dagger');
    expect(dagger.range).toBe('20/60');
    expect(dagger.damage_dice_primary).toBe('1d4 + 2');
    expect(dagger.damage_dice_ranged).toBe('1d4 + 2');
  });

  it('parseRangedBand parses the "20/60" band', () => {
    expect(parseRangedBand('20/60')).toEqual({ normalFt: 20, longFt: 60 });
  });

  it('arms the offer on identical dice when the band is authored (formula === baseFormula)', () => {
    const offer = buildRangedVariantOffer(CULT_FANATIC_DAGGER, 'Dagger');
    expect(offer).toMatchObject({ formula: '1d4 + 2', baseFormula: '1d4 + 2', damageType: 'Piercing', attackName: 'Dagger', range: '20/60', normalFt: 20, longFt: 60 });
    expect(offer.label).toBe('Ranged: 1d4 + 2 Piercing?');
  });

  it('stays byte-inert for identical dice WITHOUT an authored band; band alone arms', () => {
    const noBand = { ...CULT_FANATIC_DAGGER };
    delete noBand.range;
    expect(buildRangedVariantOffer(noBand, 'Dagger')).toBeNull();
    const bandOnly = { ...CULT_FANATIC_DAGGER };
    delete bandOnly.damage_dice_ranged;
    expect(buildRangedVariantOffer(bandOnly, 'Dagger')).toMatchObject({ formula: '1d4 + 2', normalFt: 20 });
  });
});

describe('MA-0436 offer forwarding', () => {
  it('forwards rangedVariantOffer to the attack roll context', () => {
    renderBugbear();
    clickChipLink();
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.rangedVariantOffer).toMatchObject({ formula: '1d6 + 2', baseFormula: '2d6 + 2', normalFt: 30, longFt: 120 });
  });

  it('forwards null offer for melee-only rows', () => {
    const m = makeMonster({ name: 'Goblin', actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Weapon Attack.', reach: '5 ft.', damage_dice_primary: '1d4 + 2', damage_type_primary: 'bludgeoning' }] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', targetName: null, conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin' }] })} />);
    clickChipLink('+4');
    expect(rollAttack.mock.calls[0][2].rangedVariantOffer).toBeNull();
  });
});

describe('MA-0436 chooser resolution on HIT popup', () => {
  it('ranged pick: swaps Done auto-damage to 1d6 + 2, logs mode + band advisory, marks resolved', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d6 + 2');
    expect(popup.autoDamage.rangedChoice).toBe('ranged');
    const pick = findLogEntry('ranged_variant_selected');
    expect(pick).toBeTruthy();
    expect(pick.description).toContain('RANGED');
    expect(pick.description).toContain('1d6 + 2');
    expect(pick.description).toContain('advisory');
    expect(findLogEntry('melee_variant_selected')).toBeFalsy();
  });

  it('melee pick: auto-damage stays 2d6 + 2, logs the choice once, marks resolved', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('melee');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('melee');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('2d6 + 2');
    expect(popup.autoDamage.rangedChoice).toBe('melee');
    const pick = findLogEntry('melee_variant_selected');
    expect(pick).toBeTruthy();
    expect(pick.description).toContain('2d6 + 2');
    expect(findLogEntry('ranged_variant_selected')).toBeFalsy();
    await doneWith({ ...popup.autoDamage });
    expect(rollDamage.mock.calls[0][0].formula).toBe('2d6 + 2');
    expect(addEntry.mock.calls.map((c) => c[1]).filter((e) => e && e.automationType === 'melee_variant_selected')).toHaveLength(1);
  });

  it('a resolved decision cannot re-fire the chooser', async () => {
    renderBugbear(hitPopupHtml({ rangedVariantResolved: 'ranged' }));
    clickButton('ranged');
    await new Promise((r) => setTimeout(r, 0));
    expect(findLogEntry('ranged_variant_selected')).toBeFalsy();
    expect(useLoggedDiceRoll.__getPopupHtml().autoDamage.formula).toBe('2d6 + 2');
  });

  it('does nothing when the popup has no ranged variant offer', async () => {
    renderBugbear(hitPopupHtml({ rangedVariantOffer: null }));
    clickButton('ranged');
    await new Promise((r) => setTimeout(r, 0));
    expect(addEntry).not.toHaveBeenCalled();
    expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBeFalsy();
  });
});

describe('MA-0436 Done auto-damage resolution', () => {
  it('unpicked Done applies the melee base 2d6 + 2 and logs the melee default', async () => {
    renderBugbear(hitPopupHtml());
    await doneWith({ ...hitPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('2d6 + 2');
    expect(rollDamage.mock.calls[0][0].formula).toBe('2d6 + 2');
    const dflt = findLogEntry('melee_variant_selected');
    expect(dflt).toBeTruthy();
    expect(dflt.description).toContain('default');
  });

  it('ranged pick then Done rolls 1d6 + 2 exactly once with no default log', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    await doneWith({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d6 + 2');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d6 + 2');
    expect(findLogEntry('ranged_variant_selected')).toBeTruthy();
    expect(findLogEntry('melee_variant_selected')).toBeFalsy();
  });

  it('crit doubles the chosen ranged formula via the existing seam', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    const options = useLoggedDiceRoll.__getOptions();
    await options.autoDamageRoll({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage }, true);
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d6 + 2');
  });

  it('melee-only rows resolve byte-inert: no chooser logs', async () => {
    renderBugbear(hitPopupHtml({ rangedVariantOffer: null }));
    const autoDamage = { name: 'Javelin', formula: '2d6 + 2', damageType: 'Piercing', source: 'Bugbear 1' };
    await doneWith(autoDamage);
    expect(rollExpression).toHaveBeenCalledWith('2d6 + 2');
    expect(findLogEntry('melee_variant_selected')).toBeFalsy();
    expect(findLogEntry('ranged_variant_selected')).toBeFalsy();
  });
});

describe('MA-0439 Bugbear Chief dual-mode resolution on HIT popup', () => {
  it('forwards the Chief rangedVariantOffer to the attack roll context', () => {
    renderChief();
    clickChipLink('+5');
    expect(rollAttack).toHaveBeenCalled();
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.rangedVariantOffer).toMatchObject({ formula: '1d6 + 3', baseFormula: '2d6 + 3', normalFt: 30, longFt: 120 });
  });

  it('ranged pick: swaps Done auto-damage to 1d6 + 3, logs mode + band advisory, marks resolved', async () => {
    renderChief(chiefHitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d6 + 3');
    expect(popup.autoDamage.rangedChoice).toBe('ranged');
    const pick = findLogEntry('ranged_variant_selected');
    expect(pick).toBeTruthy();
    expect(pick.description).toContain('RANGED');
    expect(pick.description).toContain('1d6 + 3');
    expect(pick.description).toContain('advisory');
    expect(findLogEntry('melee_variant_selected')).toBeFalsy();
  });

  it('ranged pick then Done rolls 1d6 + 3 exactly once with no default log', async () => {
    renderChief(chiefHitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    await doneWith({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d6 + 3');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d6 + 3');
    expect(findLogEntry('ranged_variant_selected')).toBeTruthy();
    expect(findLogEntry('melee_variant_selected')).toBeFalsy();
  });

  it('unpicked Done applies the melee base 2d6 + 3 and logs the melee default', async () => {
    renderChief(chiefHitPopupHtml());
    await doneWith({ ...chiefHitPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('2d6 + 3');
    expect(rollDamage.mock.calls[0][0].formula).toBe('2d6 + 3');
    const dflt = findLogEntry('melee_variant_selected');
    expect(dflt).toBeTruthy();
    expect(dflt.description).toContain('default');
    expect(dflt.description).toContain('2d6 + 3');
  });
});
