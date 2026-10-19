// @maintained-by-ai
// MA-0436: Bugbear Javelin "melee or ranged" dual-mode (monsters.json
// damage_dice_ranged + range "30/120") — GM-adjudicated damage-dice choice on
// the monster attack HIT popup (MA-0325 two-handed mirror, MA-0007
// offer-on-result shape). Lanes: Bugbear/Chief twin rows (MA-0439),
// dice-identical band rows — Cult Fanatic Dagger (MA-0529), Demilich Necrotic
// Burst (MA-0589) — and pure-ranged band rows — Cyclops / Cyclops Sentry Rock
// (MA-0539/MA-0547) — ride the same seam and stay in the tables below.
// Popup chooser UI + raw-id click contract → char-sheet/
// DiceRollResult.ranged-variant.test.jsx. Band-indivisible range adjudication
// → services/rules/combat/rangeValidation.test.js. This lane pins: disk row
// data locks; the helper parse/arm/inert tables (sole owner here); offer
// forwarding at the chip press; ranged/melee resolution, unpicked Done default,
// crit fold, and the resolver guardrails — all at the modal seam.
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

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 5, rolls: [3], modifier: 2, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 10, rolls: [3, 3], modifier: 2, formula })),
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

// Isolation only (consumed at press/render, never the lane under test):
// range gate stays neutral, mapsService resolves null so the ranged-pick
// band note takes its no-map-position advisory branch.
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
import { buildRangedVariantOffer, parseRangedBand, buildRangedBandAdvisory } from './MonsterCardHelpers.js';

const { _setPopupHtml } = useLoggedDiceRoll;
const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;

const monsterList = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
const diskRow = (monsterName, actionName) =>
  monsterList.find((m) => m.name === monsterName).actions.find((a) => a.name === actionName);

const BUGBEAR_JAVELIN_ACTION = diskRow('Bugbear', 'Javelin');

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
  return render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Bugbear 1', targetName: 'AasimarTest' }, { name: 'AasimarTest', type: 'player' }], creatureName: 'Bugbear 1' })} />);
}

function clickChipLink(text = '+4') {
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

// Data locks for every row this lane adjudicates (MA-0436/0439/0529/0539/
// MA-0547/MA-0589): exact BY NAME bytes incl. the suffix-normalized Sentry
// range (MA-0547) and the Cyclops '4dl0' typo guard.
describe('MA-0436 family disk data locks', () => {
  it.each([
    { monster: 'Bugbear', action: 'Javelin', attack_bonus: 4, damage_dice_primary: '2d6 + 2', damage_dice_ranged: '1d6 + 2', range: '30/120', reach: '5 ft.', descriptionIncludes: null, descriptionExcludes: null },
    { monster: 'Bugbear Chief', action: 'Javelin', attack_bonus: 5, damage_dice_primary: '2d6 + 3', damage_dice_ranged: '1d6 + 3', range: '30/120', reach: '5 ft.', descriptionIncludes: null, descriptionExcludes: null },
    { monster: 'Cult Fanatic', action: 'Dagger', attack_bonus: 4, damage_dice_primary: '1d4 + 2', damage_dice_ranged: '1d4 + 2', range: '20/60', reach: '5 ft.', descriptionIncludes: null, descriptionExcludes: null },
    { monster: 'Cyclops', action: 'Rock', attack_bonus: 9, damage_dice_primary: '4d10 + 6', damage_dice_ranged: undefined, range: '30/120', reach: undefined, descriptionIncludes: null, descriptionExcludes: '4dl0' },
    { monster: 'Cyclops Sentry', action: 'Rock', attack_bonus: 9, damage_dice_primary: '3d10 + 6', damage_dice_ranged: undefined, range: '30/120', reach: undefined, descriptionIncludes: 'range 30/120 ft.', descriptionExcludes: null },
    { monster: 'Demilich', action: 'Necrotic Burst', attack_bonus: 11, damage_dice_primary: '7d6', damage_dice_ranged: '7d6', range: '5/120', reach: '5 ft.', descriptionIncludes: 'reach 5 ft. or range 120 ft.', descriptionExcludes: null },
  ])('$monster $action authors its authored-shape bytes', ({ monster, action, attack_bonus, damage_dice_primary, damage_dice_ranged, range, reach, descriptionIncludes, descriptionExcludes }) => {
    const row = diskRow(monster, action);
    expect(row.attack_bonus, `${monster} ${action} attack_bonus`).toBe(attack_bonus);
    expect(row.damage_dice_primary, `${monster} ${action} damage_dice_primary`).toBe(damage_dice_primary);
    expect(row.damage_dice_ranged, `${monster} ${action} damage_dice_ranged`).toBe(damage_dice_ranged);
    expect(row.range, `${monster} ${action} range`).toBe(range);
    expect(row.reach, `${monster} ${action} reach`).toBe(reach);
    if (descriptionIncludes) expect(row.description, `${monster} ${action} description`).toContain(descriptionIncludes);
    if (descriptionExcludes) expect(row.description, `${monster} ${action} description`).not.toContain(descriptionExcludes);
  });
});

describe('MA-0436 parseRangedBand', () => {
  it('parses authored "N/M" bands to the byte and rejects every non-band form (MA-0547 suffix-intolerant by design)', () => {
    expect(parseRangedBand('30/120')).toEqual({ normalFt: 30, longFt: 120 });
    expect(parseRangedBand('20/60')).toEqual({ normalFt: 20, longFt: 60 });
    expect(parseRangedBand('5/120')).toEqual({ normalFt: 5, longFt: 120 });
    for (const bad of ['5 ft.', '60 ft.', '30/120 ft.', '30-foot Emanation', null, undefined]) {
      expect(parseRangedBand(bad), `parseRangedBand(${String(bad)})`).toBeNull();
    }
  });
});

describe('MA-0436 buildRangedVariantOffer arming', () => {
  // Exact full-object pins: the 8-key offer shape with machine-read label
  // bytes ('Ranged: <formula> <type>?') — the modal forwards it verbatim.
  it.each([
    ['Bugbear Javelin', diskRow('Bugbear', 'Javelin'), JAVELIN_OFFER],
    ['Bugbear Chief Javelin (MA-0439)', diskRow('Bugbear Chief', 'Javelin'), CHIEF_JAVELIN_OFFER],
    // MA-0529/MA-0589: dice-identical rows arm with formula === baseFormula.
    ['Cult Fanatic Dagger (MA-0529)', diskRow('Cult Fanatic', 'Dagger'), { formula: '1d4 + 2', baseFormula: '1d4 + 2', damageType: 'Piercing', label: 'Ranged: 1d4 + 2 Piercing?', attackName: 'Dagger', range: '20/60', normalFt: 20, longFt: 60 }],
    ['Demilich Necrotic Burst (MA-0589)', diskRow('Demilich', 'Necrotic Burst'), { formula: '7d6', baseFormula: '7d6', damageType: 'Necrotic', label: 'Ranged: 7d6 Necrotic?', attackName: 'Necrotic Burst', range: '5/120', normalFt: 5, longFt: 120 }],
  ])('builds the exact offer for %s', (_case, action, expected) => {
    expect(buildRangedVariantOffer(action, action.name)).toEqual(expected);
  });

  // MA-0529 ratchet: a band alone (no damage_dice_ranged) still arms on
  // melee-or-ranged prose — formula falls back to the base dice.
  it('arms on an authored band alone (no variant dice) by falling back to base formula', () => {
    const action = { ...diskRow('Cult Fanatic', 'Dagger') };
    delete action.damage_dice_ranged;
    expect(buildRangedVariantOffer(action, 'Dagger')).toEqual({ formula: '1d4 + 2', baseFormula: '1d4 + 2', damageType: 'Piercing', label: 'Ranged: 1d4 + 2 Piercing?', attackName: 'Dagger', range: '20/60', normalFt: 20, longFt: 60 });
  });

  it('stays byte-inert (null) unless the row is an authored melee-or-ranged variant', () => {
    const noBandIdentical = { ...diskRow('Cult Fanatic', 'Dagger') };
    delete noBandIdentical.range;
    const inertRows = [
      [{ name: 'Morningstar', attack_bonus: 4, reach: '5 ft.', damage_dice_primary: '2d8 + 2', description: 'Melee Weapon Attack.' }, 'melee-only row'],
      [noBandIdentical, 'identical dice without an authored band (MA-0529)'],
      [diskRow('Cyclops', 'Rock'), 'pure-ranged row never arms a melee chooser (MA-0539)'],
      [{ name: 'Rock', damage_dice_primary: '2d6 + 5', damage_dice_ranged: '1d6 + 5', description: 'Ranged Weapon Attack: +8 to hit.' }, 'pure-ranged wording even with variant dice'],
      [{ name: 'Javelin', description: 'Melee or Ranged Weapon Attack.', range: '30/120' }, 'no primary dice to fall back to'],
      [undefined, 'missing action'],
    ];
    for (const [action, why] of inertRows) {
      expect(buildRangedVariantOffer(action, action?.name), `must stay null: ${why}`).toBeNull();
    }
  });
});

describe('MA-0539 buildRangedBandAdvisory', () => {
  // MA-0547 twin: the suffix-normalized Sentry disk row stamps identically.
  it('stamps band truth on pure-ranged band rows with exact bytes and stays null elsewhere', () => {
    const expected = 'Range band 30/120 ft — gridless: advisory (GM-enforced).';
    expect(buildRangedBandAdvisory(diskRow('Cyclops', 'Rock'))).toBe(expected);
    expect(buildRangedBandAdvisory(diskRow('Cyclops Sentry', 'Rock'))).toBe(expected);
    for (const inert of [
      { reach: '5 ft.', range: '30/120', description: 'Melee or Ranged Weapon Attack.' },
      { damage_dice_primary: '1d4 + 2' },
      { range: '60 ft.' },
      undefined,
    ]) {
      expect(buildRangedBandAdvisory(inert), `must stay null: ${JSON.stringify(inert)}`).toBeNull();
    }
  });
});

describe('MA-0436 offer forwarding at the chip press', () => {
  // Chip render folded into press: clicking the dice chip is what proves the
  // chip armed; rollAttack args pinned BY NAME with the exact forwarded offer.
  it.each([
    ['Bugbear', 'Bugbear 1', 'Javelin', '+4', 4, JAVELIN_OFFER],
    ['Bugbear Chief', 'Bugbear Chief 1', 'Javelin', '+5', 5, CHIEF_JAVELIN_OFFER],
  ])('%s chip press forwards the exact rangedVariantOffer to the roll context', (name, instance, attackName, chip, bonus, expectedOffer) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    _setPopupHtml(null);
    const m = makeMonster({ name, actions: [diskRow(name, attackName)] });
    damageUtils.__setFindCreatureReturn({ name: instance, targetName: 'AasimarTest', conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: instance, targetName: 'AasimarTest' }, { name: 'AasimarTest', type: 'player' }], creatureName: instance })} />);
    clickChipLink(chip);
    expect(rollAttack).toHaveBeenCalledTimes(1);
    const [rolledName, rolledBonus, ctx] = rollAttack.mock.calls[0];
    expect(rolledName).toBe(attackName);
    expect(rolledBonus).toBe(bonus);
    expect(ctx.rangedVariantOffer).toEqual(expectedOffer);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('forwards a null offer for melee-only rows', () => {
    const m = makeMonster({ name: 'Goblin', actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Weapon Attack.', reach: '5 ft.', damage_dice_primary: '1d4 + 2', damage_type_primary: 'bludgeoning' }] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', targetName: null, conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin' }] })} />);
    clickChipLink('+4');
    expect(rollAttack.mock.calls[0][2].rangedVariantOffer).toBeNull();
  });
});

describe('MA-0436 chooser resolution + Done auto-damage', () => {
  it('ranged pick swaps Done auto-damage to 1d6 + 2, logs mode + band advisory once, Done rolls the swapped formula', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('1d6 + 2');
    expect(popup.autoDamage.rangedChoice).toBe('ranged');
    const pickLogs = variantLogs('ranged_variant_selected');
    expect(pickLogs).toHaveLength(1);
    expect(pickLogs[0].characterName).toBe('Bugbear 1');
    expect(pickLogs[0].abilityName).toBe('Javelin');
    expect(pickLogs[0].description).toBe('Bugbear 1 Javelin RANGED variant selected — 1d6 + 2 Piercing applied on Done. Range band 30/120 ft — no map position: advisory (GM-enforced).');
    expect(variantLogs('melee_variant_selected')).toHaveLength(0);
    await doneWith({ ...popup.autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('1d6 + 2');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    expect(rollDamage.mock.calls).toHaveLength(1);
    expect(rollDamage.mock.calls[0][0].formula).toBe('1d6 + 2');
  });

  it('melee pick keeps 2d6 + 2, logs the choice once, and Done does not re-log the default', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('melee');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('melee');
    });
    const popup = useLoggedDiceRoll.__getPopupHtml();
    expect(popup.autoDamage.formula).toBe('2d6 + 2');
    expect(popup.autoDamage.rangedChoice).toBe('melee');
    const pickLogs = variantLogs('melee_variant_selected');
    expect(pickLogs).toHaveLength(1);
    expect(pickLogs[0].description).toBe('Bugbear 1 Javelin melee variant selected — 2d6 + 2 Piercing applied on Done.');
    expect(variantLogs('ranged_variant_selected')).toHaveLength(0);
    await doneWith({ ...popup.autoDamage });
    expect(rollDamage.mock.calls[0][0].formula).toBe('2d6 + 2');
    expect(variantLogs('melee_variant_selected')).toHaveLength(1);
  });

  // Resolver guards (MonsterCardModal resolveRangedVariantSelection early
  // return): a resolved popup cannot re-fire, an offer-less popup no-ops.
  it.each([
    ['an already-resolved popup', hitPopupHtml({ rangedVariantResolved: 'ranged' })],
    ['a popup with no ranged variant offer', hitPopupHtml({ rangedVariantOffer: null })],
  ])('clicking %s does nothing', async (_case, popupHtml) => {
    renderBugbear(popupHtml);
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().autoDamage.formula).toBe('2d6 + 2');
    });
    expect(variantLogs('ranged_variant_selected')).toHaveLength(0);
    expect(variantLogs('melee_variant_selected')).toHaveLength(0);
  });

  it('unpicked Done applies the melee base and logs the default once; offer-less auto-damage stays inert', async () => {
    renderBugbear(hitPopupHtml());
    await doneWith({ ...hitPopupHtml().autoDamage });
    expect(rollExpression).toHaveBeenCalledWith('2d6 + 2');
    const defaultLogs = variantLogs('melee_variant_selected');
    expect(defaultLogs).toHaveLength(1);
    expect(defaultLogs[0].description).toBe('Bugbear 1 Javelin melee variant selected (default — no popup choice made) — 2d6 + 2 Piercing applied on Done.');
    await doneWith({ name: 'Javelin', formula: '2d6 + 2', damageType: 'Piercing', source: 'Bugbear 1' });
    expect(variantLogs('melee_variant_selected')).toHaveLength(1);
    expect(variantLogs('ranged_variant_selected')).toHaveLength(0);
  });

  it('crit doubles the chosen ranged formula via the existing Done seam', async () => {
    renderBugbear(hitPopupHtml());
    clickButton('ranged');
    await vi.waitFor(() => {
      expect(useLoggedDiceRoll.__getPopupHtml().rangedVariantResolved).toBe('ranged');
    });
    await doneWith({ ...useLoggedDiceRoll.__getPopupHtml().autoDamage }, true);
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d6 + 2');
    expect(rollExpression).not.toHaveBeenCalled();
  });
});
