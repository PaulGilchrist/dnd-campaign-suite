/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ----
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
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

  const mockHook = vi.fn(() => ({
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
  const _findCreatureByName = vi.fn((_ctx, _name) => {
    return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
  });

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: _findCreatureByName,
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => null),
  getRuntimeValue: vi.fn((_characterKey, _propertyName) => null),
}));

// ── Re-import mocked modules ----
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;
const rollAbilityCheck = useLoggedDiceRoll._rollAbilityCheck;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const rollSkillCheck = useLoggedDiceRoll._rollSkillCheck;
const rollInitiative = useLoggedDiceRoll._rollInitiative;

// ── Tests ----

describe('MonsterCardModal interaction / game rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  // ════════════════════════════════════════════
  // Dice link click handlers (rollAttack, rollDamage, etc.)
  // ════════════════════════════════════════════

  it('clicking ability modifier calls rollAbilityCheck with correct ability and modifier', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    const mods = document.querySelectorAll('.mc-ability-mod');
    expect(mods.length).toBe(6);
    // STR has modifier -1
    fireEvent.click(mods[0]);
    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', -1);
  });

  it('clicking saving throw dice link calls rollSavingThrow', () => {
    const m = makeMonster({ saving_throws: { str: { modifier: 2 } } });
    render(<MonsterCardModal {...makeProps(m)} />);

    const rows = document.querySelectorAll('.mc-defense-row');
    let saveRow = null;
    for (const row of rows) {
      if (row.querySelector('.mc-defense-label')?.textContent === 'Saving Throws') {
        saveRow = row;
        break;
      }
    }
    expect(saveRow).toBeTruthy();
    const link = saveRow.querySelector('.mc-dice-link');
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSavingThrow).toHaveBeenCalled();
  });

  it('clicking skill dice link calls rollSkillCheck', () => {
    const m = makeMonster({ skills: { stealth: { modifier: 3 } } });
    render(<MonsterCardModal {...makeProps(m)} />);

    const rows = document.querySelectorAll('.mc-defense-row');
    let skillRow = null;
    for (const row of rows) {
      if (row.querySelector('.mc-defense-label')?.textContent === 'Skills') {
        skillRow = row;
        break;
      }
    }
    expect(skillRow).toBeTruthy();
    const link = skillRow.querySelector('.mc-dice-link');
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSkillCheck).toHaveBeenCalled();
  });

  it('clicking initiative dice link calls rollInitiative when initiative_details has a bonus', () => {
    const m = makeMonster({ initiative_details: '+5' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+5')).toBeInTheDocument();
    const initLink = screen.getByText('+5');
    expect(initLink.closest('.mc-dice-link')).toBeTruthy();
    fireEvent.click(initLink);
    expect(rollInitiative).toHaveBeenCalledWith(5);
  });

  it('does not render initiative dice link when initiative_details has no parseable bonus', () => {
    const m = makeMonster({ initiative_details: 'advantage' });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    // initiative_details is rendered but not as a dice link since parseInitiativeBonus returns null
    const initEl = screen.getByText('advantage');
    expect(initEl.closest('.mc-dice-link')).toBeNull();
  });

  it('clicking attack bonus calls rollAttack', () => {
    const m = makeMonster({ actions: [{ name: 'Club', description: 'Melee Attack.', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);

    const links = document.querySelectorAll('.mc-dice-link');
    let attackLink = null;
    for (const el of links) {
      if (el.textContent.trim() === '+4') {
        attackLink = el;
        break;
      }
    }
    expect(attackLink).toBeTruthy();
    fireEvent.click(attackLink);
    expect(rollAttack).toHaveBeenCalled();
  });

  it('clicking damage dice link calls rollDamage', () => {
    const m = makeMonster({ actions: [{ name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d4 + 2' }] });
    render(<MonsterCardModal {...makeProps(m)} />);

    const links = document.querySelectorAll('.mc-dice-link');
    let dmgLink = null;
    for (const el of links) {
      if (el.textContent.includes('1d4')) {
        dmgLink = el;
        break;
      }
    }
    expect(dmgLink).toBeTruthy();
    fireEvent.click(dmgLink);
    expect(rollDamage).toHaveBeenCalled();
  });

  it('clicking extra damage dice link calls rollDamage', () => {
    const m = makeMonster({ actions: [{ name: 'Sword', description: '', attack_bonus: null, damage_dice_primary: '1d8', damage_dice_secondary: '2d6', damage_type_secondary: 'Slashing' }] });
    render(<MonsterCardModal {...makeProps(m)} />);

    const diceLinks = document.querySelectorAll('.mc-dice-link');
    expect(diceLinks.length).toBeGreaterThan(1);

    let dmgLink = null;
    for (const el of diceLinks) {
      if (el.textContent.includes('2d6')) {
        dmgLink = el;
        break;
      }
    }
    expect(dmgLink).toBeTruthy();
    fireEvent.click(dmgLink);
    expect(rollDamage).toHaveBeenCalled();
  });

  // ════════════════════════════════════════════
  // Speed display with multiple movement types
  // ════════════════════════════════════════════

  it('displays multiple speed types when available', () => {
    const m = makeMonster({ speed: { walk: '30 ft.', fly: '40 ft.', swim: '20 ft.' } });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('walk 30 ft., fly 40 ft., swim 20 ft.')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Damage options (split by "or")
  // ════════════════════════════════════════════

  it('renders multiple damage options separated by "or"', () => {
    const m = makeMonster({ actions: [{ name: 'Lightning Bolt', description: '1d6 or 1d8 lightning damage', damage_dice_primary: '1d6 or 1d8' }] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    const links = document.querySelectorAll('.mc-dice-link');
    let has1d6 = false;
    let has1d8 = false;
    for (const el of links) {
      if (el.textContent.includes('1d6')) has1d6 = true;
      if (el.textContent.includes('1d8')) has1d8 = true;
    }
    expect(has1d6).toBe(true);
    expect(has1d8).toBe(true);
  });
});
