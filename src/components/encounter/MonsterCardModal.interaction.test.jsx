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
}));

vi.mock('../../services/combat/auras/protectionBuffUtils.js', () => ({
  hasProtectionBuff: vi.fn(() => false),
}));

// ── Re-import mocked modules ----
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

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
    useRuntimeState.useRuntimeValue.mockReturnValue(null);
  });

  // ════════════════════════════════════════════
  // Basic rendering
  // ════════════════════════════════════════════

  it('renders monster name and basic info', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Small humanoid, neutral evil')).toBeInTheDocument();
    expect(screen.getByText('Armor Class')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Hit Points')).toBeInTheDocument();
    expect(screen.getByText('7 (2d6)')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('walk 30 ft.')).toBeInTheDocument();
  });

  it('renders monster description when provided', () => {
    const m = makeMonster({ desc: 'A tiny fierce goblin.', book: 'MM', page: 310 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('A tiny fierce goblin.')).toBeInTheDocument();
    expect(screen.getByText(/MM \(page 310\)/)).toBeInTheDocument();
  });

  it('does not render description section when desc is null', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('returns null when monster prop is null', () => {
    const { container } = render(<MonsterCardModal {...makeProps(null)} />);
    expect(container.innerHTML).toBe('');
  });

  // ════════════════════════════════════════════
  // Close behavior
  // ════════════════════════════════════════════

  it('calls onClose when close button is clicked', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    const closeBtn = document.querySelector('.mc-close');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(useLoggedDiceRoll.default.mock.results[0].value.setPopupHtml).toBeDefined();
  });

  it('calls onClose when overlay is clicked', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    const overlay = document.querySelector('.mc-overlay');
    expect(overlay).toBeTruthy();
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
    expect(screen.getByText('Poisoned')).toBeInTheDocument();
  });

  it('does not render condition effects section when creature has no conditions', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText(/Can't Act/)).not.toBeInTheDocument();
    expect(screen.queryByText('Speed 0')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Auto-Crit/ })).not.toBeInTheDocument();
  });

  it('renders speed zero effect badge and shows 0 ft. speed when condition causes speed zero', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, speedZero: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'grappled', label: 'Grappled' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.queryByText(/Can't Act/)).not.toBeInTheDocument();
    expect(screen.getByText('0 ft.')).toBeInTheDocument();
    expect(document.querySelector('.mc-stat-penalized')).toBeInTheDocument();
  });

  it('renders cannot act badge when applicable', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: "Incapacitated" }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Can't Act/)).toBeInTheDocument();
    expect(document.querySelector('.effect-cannot-act')).toBeInTheDocument();
  });

  it('renders auto-fail saves badge with correct label text', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoFailSaves: ['str', 'dex'] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'stunned', label: 'Stunned' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Auto-Fail STR\/DEX/)).toBeInTheDocument();
    expect(document.querySelector('.effect-auto-fail')).toBeInTheDocument();
  });

  it('renders auto-crit badge when condition applies', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Auto-Crit')).toBeInTheDocument();
    expect(document.querySelector('.effect-auto-crit')).toBeInTheDocument();
  });

  it('renders concentration broken badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, concentrationBroken: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: 'Incapacitated' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('No Conc.')).toBeInTheDocument();
    expect(document.querySelector('.effect-no-conc')).toBeInTheDocument();
  });

  it('renders resist all badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, resistantToAll: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'petrified', label: 'Petrified' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Resist All')).toBeInTheDocument();
    expect(document.querySelector('.effect-resist')).toBeInTheDocument();
  });

  it('renders disadvantage effect badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, attackDisadvantageCount: 1 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Disadv')).toBeInTheDocument();
    expect(document.querySelector('.effect-disadvantage')).toBeInTheDocument();
  });

  it('renders target advantage effect badge', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, targetAdvantageCount: 1 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'blinded', label: 'Blinded' }] });
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText('Adv vs')).toBeInTheDocument();
    expect(document.querySelector('.effect-target-adv')).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Incapacitated / Cannot Act - renderAction behavior
  // ════════════════════════════════════════════

  it('disables actions and shows incapacitated label when attacker cannot act', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });

    const m = makeMonster({ actions: [{ name: 'Club', description: 'Melee Weapon Attack: +4 to hit, 1d4+2 bludgeoning damage.', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/Incapacitated/)).toBeInTheDocument();
    expect(document.querySelector('.mc-action-disabled')).toBeInTheDocument();
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
    expect(screen.getByText('+4')).toBeInTheDocument();

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

  it('does not render attack bonus dice link when attacker is incapacitated', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, cannotAct: true });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'paralyzed', label: 'Paralyzed' }] });
    const m = makeMonster({ actions: [{ name: 'Club', description: '', attack_bonus: 4 }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    // The attack bonus link should not be rendered when incapacitated
    const links = document.querySelectorAll('.mc-dice-link');
    for (const el of links) {
      expect(el.textContent).not.toContain('+4');
    }
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
    const mockHook = useLoggedDiceRoll.default;
    mockHook.mockReturnValue({
      popupHtml: 'Some HTML popup content',
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Some HTML popup content/)).toBeInTheDocument();
  });

  it('renders DiceRollResult when popupHtml is an object', () => {
    const mockHook = useLoggedDiceRoll.default;
    mockHook.mockReturnValue({
      popupHtml: { type: 'damage', name: 'Slash', formula: '1d8', rolls: [3], total: 3, bonus: 0, modifier: 0 },
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(document.querySelector('.dice-roll-result')).toBeInTheDocument();
  });

  it('shows Quick Roll button when popupHtml is waiting for save', () => {
    const mockHook = useLoggedDiceRoll.default;
    mockHook.mockReturnValue({
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
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    });

    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Quick Roll/)).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Save-based actions (save_dc without attack_bonus)
  // ════════════════════════════════════════════

  it('renders save DC as clickable for save-only actions (no attack_bonus)', () => {
    const m = makeMonster({ actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [], targetName: 'Player A' });
    render(<MonsterCardModal {...makeProps(m)} />);
    const saveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
    expect(saveLinks.length).toBeGreaterThan(0);
  });

  it('does not make save DC clickable when action also has attack_bonus', () => {
    const m = makeMonster({ actions: [{ name: 'Attack', description: '', attack_bonus: 3, damage_dice_primary: '1d6', save_dc: 13, save_type: 'Dexterity' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
    expect(clickableSaveLinks.length).toBe(0);
  });

  it('does not make save DC clickable when attacker is incapacitated', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'incapacitated', label: 'Incapacitated' }] });
    const m = makeMonster({ actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    const clickableSaveLinks = document.querySelectorAll('.mc-dice-link-save-clickable');
    expect(clickableSaveLinks.length).toBe(0);
  });

  // ════════════════════════════════════════════
  // Creatures prop vs fallback creature lookup
  // ════════════════════════════════════════════

  it('uses creatures prop to find attacker when provided', () => {
    damageUtils.__setFindCreatureReturn(null);
    const m = makeMonster();
    const creatures = [{ name: 'Goblin', conditions: [{ key: 'prone', label: 'Prone' }] }];
    render(<MonsterCardModal {...makeProps(m, { creatures })} />);
    // When creatures is provided, findCreatureByName is called with { creatures }
    expect(damageUtils.findCreatureByName).toHaveBeenCalled();
  });

  it('renders traits, actions, reactions, and legendary actions sections', () => {
    const m = makeMonster({
      traits: [{ name: 'Keen Hearing', description: 'Passive Perception 15.' }],
      actions: [{ name: 'Shortsword', description: 'Melee Attack.', attack_bonus: 4 }],
      reactions: [{ name: 'Opportunity Attack', description: 'Melee Attack.', attack_bonus: 4 }],
      legendary_actions: [{ name: 'Mischief', description: 'Can act out of turn.' }],
    });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Reactions')).toBeInTheDocument();
    expect(screen.getByText('Legendary Actions')).toBeInTheDocument();
    expect(screen.getByText(/Keen Hearing/)).toBeInTheDocument();
  });

  // ════════════════════════════════════════════
  // Defensive stats sections
  // ════════════════════════════════════════════

  it('renders senses section when monster has senses', () => {
    const m = makeMonster({ senses: { darkvision: 60, passive_perception: 14 } });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Senses')).toBeInTheDocument();
    expect(screen.getByText(/darkvision 60/)).toBeInTheDocument();
  });

  it('renders damage resistances and immunities sections', () => {
    const m = makeMonster({
      damage_resistances: ['cold', 'fire'],
      damage_immunities: ['poison'],
    });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Damage Resist.')).toBeInTheDocument();
    expect(screen.getByText('cold, fire')).toBeInTheDocument();
    expect(screen.getByText('Damage Imm')).toBeInTheDocument();
    expect(screen.getByText('poison')).toBeInTheDocument();
  });

  it('renders challenge rating and legendary resistance', () => {
    const m = makeMonster({ challenge_rating: 2, xp: 450, legendary_resistance: 3 });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('CR')).toBeInTheDocument();
    expect(screen.getByText(/450 XP/)).toBeInTheDocument();
    expect(screen.getByText('Legendary Resist.')).toBeInTheDocument();
    expect(screen.getByText('3/day')).toBeInTheDocument();
  });

  it('renders lair actions when provided as array', () => {
    const m = makeMonster({ lair_actions: ['Wind howls.', 'Shadows move.'] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Lair Actions')).toBeInTheDocument();
    expect(screen.getByText('Wind howls.')).toBeInTheDocument();
  });

  it('renders lair actions when provided as object with actions array', () => {
    const m = makeMonster({ lair_actions: { actions: [{ name: 'Beware', description: 'Shadows stir.' }] } });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Lair Actions')).toBeInTheDocument();
    expect(screen.getByText(/Beware/)).toBeInTheDocument();
  });

  it('renders regional effects when provided as array', () => {
    const m = makeMonster({ regional_effects: ['Cold wind blows.'] });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Regional Effects')).toBeInTheDocument();
    expect(screen.getByText('Cold wind blows.')).toBeInTheDocument();
  });

  it('renders regional effects when provided as object with effects array', () => {
    const m = makeMonster({ regional_effects: { effects: [{ description: 'Mist covers the land.' }] } });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('Regional Effects')).toBeInTheDocument();
    expect(screen.getByText('Mist covers the land.')).toBeInTheDocument();
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

  it('shows 0 ft. speed when speedZero is true regardless of actual speed', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, speedZero: true });
    const m = makeMonster({ speed: { walk: '30 ft.', fly: '40 ft.' } });
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [{ key: 'grappled', label: 'Grappled' }] });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('0 ft.')).toBeInTheDocument();
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
