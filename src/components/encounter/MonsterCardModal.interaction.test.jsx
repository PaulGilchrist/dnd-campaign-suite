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

vi.mock('../../hooks/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
      rollAbilityCheck: _rollAbilityCheck,
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: _rollSkillCheck,
      rollInitiative: _rollInitiative,
      quickRollPlayerSave: _quickRollPlayerSave,
    })),
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

// ── Re-import mocked modules ----
import * as useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;
const rollAbilityCheck = useLoggedDiceRoll._rollAbilityCheck;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const rollSkillCheck = useLoggedDiceRoll._rollSkillCheck;
const rollInitiative = useLoggedDiceRoll._rollInitiative;
const quickRollPlayerSave = useLoggedDiceRoll._quickRollPlayerSave;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

// ── Tests ----

describe('MonsterCardModal interaction / game rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  // ════════════════════════════════════════════
  // Conditions section and effect badges
  // ════════════════════════════════════════════

  it('renders condition labels for creature with conditions', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [{ key: 'prone', label: 'Prone', id: 'cond-1' }, { key: 'poisoned', label: 'Poisoned', id: 'cond-2' }],
    });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Prone')).toBeInTheDocument();
  });

  it('does not render condition effects when creature has no conditions', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText("Can't Act")).not.toBeInTheDocument();
  });

  it('renders speed zero effect badge when condition causes speed zero', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, speedZero: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'grappled', label: 'Grappled' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-speed-zero')).not.toBeNull();
  });

  it('shows "0 ft." speed when condition sets speedZero to true', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, speedZero: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'grappled', label: 'Grappled' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('0 ft.')).toBeInTheDocument();
  });

  it('renders cannot act badge when applicable', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: "Incapacitated" }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-cannot-act')).not.toBeNull();
  });

  it('renders auto-fail saves badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoFailSaves: ['str', 'dex'] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'stunned', label: 'Stunned' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-auto-fail')).not.toBeNull();
  });

  it('renders auto-crit badge when condition applies', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-auto-crit')).not.toBeNull();
  });

  it('renders concentration broken badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, concentrationBroken: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: 'Incapacitated' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-no-conc')).not.toBeNull();
  });

  it('renders resist all badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, resistantToAll: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'petrified', label: 'Petrified' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-resist')).not.toBeNull();
  });

  it('renders disadvantage effect badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, attackDisadvantageCount: 1 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-disadvantage')).not.toBeNull();
  });

  it('renders target advantage effect badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, targetAdvantageCount: 1 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.effect-target-adv')).not.toBeNull();
  });

  // ════════════════════════════════════════════
  // Incapacitated / Cannot Act - renderAction behavior
  // ════════════════════════════════════════════

  it('disables action and shows incapacitated label when attacker cannot act', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });

    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
     expect(screen.getByText(/Incapacitated/)).toBeInTheDocument();
    });

   it('adds mc-action-disabled class when attacker incapacitated', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'petrified', label: 'Petrified' }] });

    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(document.querySelector('.mc-action.mc-action-disabled')).not.toBeNull();
  });

  it('does not render incapacitated label when attacker can act normally', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: false });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText('Incapacitated')).not.toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Dice link click handlers (rollAttack, rollDamage, etc.)
  // ════════════════════════════════════════════

  it('clicking ability modifier calls rollAbilityCheck', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    const mods = document.querySelectorAll('.mc-ability-mod');
    expect(mods.length).toBe(6);
    fireEvent.click(mods[0]);
    expect(rollAbilityCheck).toHaveBeenCalled();
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
    fireEvent.click(link);
    expect(rollSkillCheck).toHaveBeenCalled();
  });

  it('clicking initiative dice link calls rollInitiative', () => {
    const m = makeMonster({ initiative_details: '+5' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+5')).toBeTruthy();
    const initLinks = document.querySelectorAll('.mc-dice-link');
    let initLink = null;
    for (const el of initLinks) {
      if (el.textContent.includes('+5') && !el.textContent.includes('d')) {
        initLink = el;
        break;
      }
    }
    expect(initLink).toBeTruthy();
    fireEvent.click(initLink);
    expect(rollInitiative).toHaveBeenCalled();
  });

  it('clicking attack bonus calls rollAttack', () => {
    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+4')).toBeTruthy();

    const links = document.querySelectorAll('.mc-dice-link');
    let attackLink = null;
    for (const el of links) {
      if (el.textContent.includes('+4') && !el.textContent.includes('d') && !el.textContent.includes('Init')) {
        attackLink = el;
        break;
      }
    }
    expect(attackLink).toBeTruthy();
    fireEvent.click(attackLink);
    expect(rollAttack).toHaveBeenCalled();
  });

  it('clicking damage dice link calls rollDamage', () => {
    const m = makeMonster({ actions: [{ name: 'Bite', description: '', attack_bonus: null, damage_dice: '1d4 + 2' }] });
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
    const m = makeMonster({ actions: [{ name: 'Sword', description: '', attack_bonus: null, damage_dice: '1d8', damage: 'plus 2d6 slashing' }] });
    render(<MonsterCardModal {...makeProps(m)} />);

    const diceLinks = document.querySelectorAll('.mc-dice-link');
    expect(diceLinks.length).toBeGreaterThan(0);
  });

  // ════════════════════════════════════════════
  // Creature conditions section only shown with conditions
  // ════════════════════════════════════════════

  it('shows condition labels when creature has conditions', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [{ key: 'prone', label: 'Prone', id: 'c1' }, { key: 'poisoned', label: 'Poisoned', id: 'c2' }],
    });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Prone')).toBeInTheDocument();
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Popup rendering (string and object popupHtml)
  // ════════════════════════════════════════════

  it('renders Popup when popupHtml is a string', () => {
    useLoggedDiceRoll.default.mockReturnValue({
      popupHtml: 'Some HTML popup content',
      setPopupHtml,
      rollAttack,
      rollDamage,
      rollAbilityCheck,
      rollSavingThrow,
      rollSkillCheck,
      rollInitiative,
      quickRollPlayerSave,
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
  });

  it('renders DiceRollResult when popupHtml is an object', () => {
    useLoggedDiceRoll.default.mockReturnValue({
      popupHtml: { type: 'damage', name: 'Slash', formula: '1d8', rolls: [3], total: 3, bonus: 0, modifier: 0 },
      setPopupHtml,
      rollAttack,
      rollDamage,
      rollAbilityCheck,
      rollSavingThrow,
      rollSkillCheck,
      rollInitiative,
      quickRollPlayerSave,
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.dice-roll-result')).not.toBeNull();
  });

  it('shows Quick Roll button when popupHtml is waiting for save', () => {
    useLoggedDiceRoll.default.mockReturnValue({
      popupHtml: {
        type: 'save-damage',
        name: 'Fireball',
        formula: '8d6',
        rolls: [40],
        total: 40,
        bonus: 0,
        modifier: 0,
        waitingForPlayerSave: true,
        promptId: 'test-prompt-1',
        targetName: 'Player A',
        saveType: 'CON',
        saveDc: 15,
      },
      setPopupHtml,
      rollAttack,
      rollDamage,
      rollAbilityCheck,
      rollSavingThrow,
      rollSkillCheck,
      rollInitiative,
      quickRollPlayerSave,
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Quick Roll/)).toBeInTheDocument();
  });
});
