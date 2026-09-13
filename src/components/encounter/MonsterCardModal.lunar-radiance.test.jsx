// @improved-by-ai
// Regression tests for CLA-184 Improved Circle Forms (Lunar Radiance):
// Moon druid wild shape attacks must offer a per-hit Normal-vs-Radiant
// damage type choice instead of a forced Radiant conversion.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollAbilityCheck,
    _rollSavingThrow,
    _rollSkillCheck,
    _rollInitiative,
    _quickRollPlayerSave,
    _setPopupHtml,
    __setPopupHtml: _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const _computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
  });

  return {
    computeConditionEffects: _computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Brown Bear', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

const bearBite = (choices) => ({
  name: 'Bite',
  attack_bonus: 7,
  damage_dice_primary: '1d8+3',
  damage_type_primary: 'Piercing',
  ...(choices ? { damage_type_choices: choices } : {}),
  description: choices ? '7 Piercing or Radiant damage.' : '7 Piercing damage.',
});

const creatures = [
  { name: 'Brown Bear', targetName: 'Ogre' },
  { name: 'Ogre', type: 'nonplayer' },
];

function clickDiceLinkByText(text) {
  const links = Array.from(document.querySelectorAll('.mc-dice-link'));
  const link = links.find(el => el.textContent.includes(text));
  if (link) fireEvent.click(link);
  return link;
}

describe('MonsterCardModal - Lunar Radiance per-hit damage type choice (CLA-184)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useLoggedDiceRoll._setPopupHtml(null);
    damageUtils.__setFindCreatureReturn({ name: 'Brown Bear', conditions: [], targetName: 'Ogre' });
  });

  it('passes damageTypeChoices from action.damage_type_choices to rollAttack context', () => {
    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(['Piercing', 'Radiant'])] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    const link = clickDiceLinkByText('+7');
    expect(link).toBeTruthy();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].damageTypeChoices).toEqual(['Piercing', 'Radiant']);
  });

  it('omits damageTypeChoices for actions without the choice flag', () => {
    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(null)] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    const link = clickDiceLinkByText('+7');
    expect(link).toBeTruthy();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].damageTypeChoices).toBeUndefined();
  });

  it('renders Normal-vs-Radiant choice buttons on a hit instead of Done', () => {
    useLoggedDiceRoll.__setPopupHtml({
      type: 'd20',
      rollType: 'attack',
      name: 'Bite',
      rolls: [12],
      bonus: 7,
      targetName: 'Ogre',
      targetAc: 11,
      hit: true,
      autoDamage: {
        name: 'Bite',
        formula: '1d8+3',
        damageType: 'Piercing',
        damageTypeChoices: ['Piercing', 'Radiant'],
        attackerName: 'Brown Bear',
        source: 'Brown Bear',
      },
    });

    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(['Piercing', 'Radiant'])] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    const buttons = document.querySelectorAll('.lunar-radiance-choice-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('Piercing');
    expect(buttons[1].textContent).toBe('Radiant');
    expect(document.querySelector('.dice-roll-reroll-btn:not(.lunar-radiance-choice-btn)')).toBeNull();
  });

  it('dispatches dice-roll-done with Radiant when Radiant is chosen', () => {
    useLoggedDiceRoll.__setPopupHtml({
      type: 'd20',
      rollType: 'attack',
      name: 'Bite',
      rolls: [12],
      bonus: 7,
      targetName: 'Ogre',
      targetAc: 11,
      hit: true,
      autoDamage: {
        name: 'Bite',
        formula: '1d8+3',
        damageType: 'Piercing',
        damageTypeChoices: ['Piercing', 'Radiant'],
        attackerName: 'Brown Bear',
        source: 'Brown Bear',
      },
    });

    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(['Piercing', 'Radiant'])] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    const detail = {};
    const listener = (e) => { Object.assign(detail, e.detail); };
    window.addEventListener('dice-roll-done', listener);

    const radiant = Array.from(document.querySelectorAll('.lunar-radiance-choice-btn'))
      .find(b => b.textContent === 'Radiant');
    fireEvent.click(radiant);
    window.removeEventListener('dice-roll-done', listener);

    expect(detail.autoDamage).toBeTruthy();
    expect(detail.autoDamage.damageType).toBe('Radiant');
    expect(detail.hit).toBe(true);
  });

  it('dispatches dice-roll-done with the beast normal type when Normal is chosen', () => {
    useLoggedDiceRoll.__setPopupHtml({
      type: 'd20',
      rollType: 'attack',
      name: 'Bite',
      rolls: [12],
      bonus: 7,
      targetName: 'Ogre',
      targetAc: 11,
      hit: true,
      autoDamage: {
        name: 'Bite',
        formula: '1d8+3',
        damageType: 'Piercing',
        damageTypeChoices: ['Piercing', 'Radiant'],
        attackerName: 'Brown Bear',
        source: 'Brown Bear',
      },
    });

    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(['Piercing', 'Radiant'])] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    const detail = {};
    const listener = (e) => { Object.assign(detail, e.detail); };
    window.addEventListener('dice-roll-done', listener);

    const normal = Array.from(document.querySelectorAll('.lunar-radiance-choice-btn'))
      .find(b => b.textContent === 'Piercing');
    fireEvent.click(normal);
    window.removeEventListener('dice-roll-done', listener);

    expect(detail.autoDamage).toBeTruthy();
    expect(detail.autoDamage.damageType).toBe('Piercing');
  });

  it('still renders the plain Done button when no damage type choice exists', () => {
    useLoggedDiceRoll.__setPopupHtml({
      type: 'd20',
      rollType: 'attack',
      name: 'Claw',
      rolls: [12],
      bonus: 5,
      targetName: 'Ogre',
      targetAc: 11,
      hit: true,
      autoDamage: {
        name: 'Claw',
        formula: '1d6+3',
        damageType: 'Slashing',
        attackerName: 'Brown Bear',
        source: 'Brown Bear',
      },
    });

    const m = makeMonster({ name: 'Brown Bear', actions: [bearBite(null)] });
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);

    expect(document.querySelectorAll('.lunar-radiance-choice-btn').length).toBe(0);
    const done = document.querySelector('.dice-roll-reroll-btn');
    expect(done).toBeTruthy();
    expect(done.textContent).toContain('Done');
  });
});
