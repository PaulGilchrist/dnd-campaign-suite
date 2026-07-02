/* @improved-by-ai */
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];
  let _activeBuffs = null;
  let _bulwarkActive = null;
  let _bulwarkTargets = [];
  let _invokeDuplicityAdvantageTargets = [];

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    return null;
  });

  const mockGetRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'activeBuffs') return _activeBuffs;
    if (propertyName === 'bulwarkOfForceActive') return _bulwarkActive;
    if (propertyName === 'bulwarkOfForceTargets') return _bulwarkTargets;
    if (propertyName === 'invokeDuplicityAdvantageTargets') return _invokeDuplicityAdvantageTargets;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
    __setActiveBuffs(val) { _activeBuffs = val; },
    __setBulwarkActive(val) { _bulwarkActive = val; },
    __setBulwarkTargets(val) { _bulwarkTargets = val; },
    __setInvokeDuplicityAdvantageTargets(val) { _invokeDuplicityAdvantageTargets = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleAttack: Bulwark of Force cover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setBulwarkActive(null);
    useRuntimeState.__setBulwarkTargets([]);
    useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('applies +2 AC cover bonus from Bulwark of Force when target is in bulwarkTargets', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setBulwarkActive(true);
    useRuntimeState.__setBulwarkTargets(['Player A']);

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    const characters = [{ name: 'Player A' }];
    render(<MonsterCardModal {...makeProps(m, { characters, creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.coverAcBonus).toBe(2);
    expect(callArgs.coverLevel).toBe('half');
  });

  it('does not apply Bulwark of Force when bulwarkActive is false', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setBulwarkActive(false);

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    const characters = [{ name: 'Player A' }];
    render(<MonsterCardModal {...makeProps(m, { characters, creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.coverAcBonus).toBe(0);
  });

  it('does not apply Bulwark of Force when target is not in bulwarkTargets', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setBulwarkActive(true);
    useRuntimeState.__setBulwarkTargets(['Other Player']);

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    const characters = [{ name: 'Player A' }];
    render(<MonsterCardModal {...makeProps(m, { characters, creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.coverAcBonus).toBe(0);
  });
});

describe('MonsterCardModal - handleAttack: Improved Duplicity advantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('grants advantage when cleric has create_illusion with isImprovedDuplicity and monster is in advantageTargets', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setInvokeDuplicityAdvantageTargets(['Goblin']);

    const clericCharacter = {
      name: 'Cleric',
      computedStats: {
        automation: {
          passives: [
            { effect: 'enhanced_distraction_and_healing' },
          ],
        },
      },
    };

    useRuntimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
      if (propertyName === 'activeBuffs') return [{ effect: 'create_illusion', isImprovedDuplicity: true }];
      if (propertyName === 'invokeDuplicityAdvantageTargets') return ['Goblin'];
      return null;
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [clericCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.forcedMode).toBe('advantage');
  });

  it('does not grant advantage when cleric does not have create_illusion buff', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setInvokeDuplicityAdvantageTargets(['Goblin']);
    useRuntimeState.__setActiveBuffs([]);

    const clericCharacter = {
      name: 'Cleric',
      computedStats: {
        automation: {
          passives: [
            { effect: 'enhanced_distraction_and_healing' },
          ],
        },
      },
    };

    useRuntimeState.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
      if (propertyName === 'activeBuffs') return [];
      if (propertyName === 'invokeDuplicityAdvantageTargets') return ['Goblin'];
      return null;
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [clericCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.forcedMode).toBeUndefined();
  });

  it('does not grant advantage when monster is not in advantageTargets', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    useRuntimeState.__setInvokeDuplicityAdvantageTargets(['OtherMonster']);

    const clericCharacter = {
      name: 'Cleric',
      computedStats: {
        automation: {
          passives: [
            { effect: 'enhanced_distraction_and_healing' },
          ],
        },
      },
    };

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [clericCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.forcedMode).toBeUndefined();
  });
});

describe('MonsterCardModal - handleAttack: Graze mechanic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('sets grazeDamage and grazeAbilityMod when weapon_mastery_choice is Graze', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const monsterCharacter = {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [
            { type: 'weapon_mastery_choice', chosenMastery: 'Graze' },
          ],
        },
        abilities: [
          { name: 'Strength', bonus: 2 },
        ],
      },
    };

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.grazeDamage).toBe(true);
    expect(callArgs.grazeAbilityMod).toBe(2);
    expect(callArgs.grazeAbilityName).toBe('STR');
  });

  it('does not set grazeDamage when chosenMastery is not Graze', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const monsterCharacter = {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [
            { type: 'weapon_mastery_choice', chosenMastery: 'Polished' },
          ],
        },
      },
    };

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.grazeDamage).toBe(false);
    expect(callArgs.grazeAbilityMod).toBe(0);
  });

  it('does not set grazeDamage when attack is ranged (not melee)', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const monsterCharacter = {
      name: 'Goblin',
      computedStats: {
        automation: {
          passives: [
            { type: 'weapon_mastery_choice', chosenMastery: 'Graze' },
          ],
        },
        abilities: [
          { name: 'Strength', bonus: 2 },
        ],
      },
    };

    const m = makeMonster({
      actions: [{ name: 'Longbow', attack_bonus: 4, description: 'Ranged Attack.', range: '150/600' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.grazeDamage).toBe(false);
  });

  it('does not set grazeDamage when monsterCharacter has no computedStats', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const monsterCharacter = { name: 'Goblin' };
    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { characters: [monsterCharacter], creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.grazeDamage).toBe(false);
  });
});

describe('MonsterCardModal - handleAttack: auto-crit within 5ft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('sets isAutoCrit when targetEffectData.autoCritWithin5ft is true and attack is melee', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: true });
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.isAutoCrit).toBe(true);
  });

  it('does not set isAutoCrit when autoCritWithin5ft is false', () => {
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, autoCritWithin5ft: false });
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.isAutoCrit).toBe(false);
  });
});

describe('MonsterCardModal - handleAttack: attack range calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('calculates melee attack when reach is 5 ft.', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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

  it('calculates ranged attack when range is 150/600', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Longbow', attack_bonus: 4, description: 'Ranged Attack.', range: '150/600' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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

  it('defaults to 30ft range when no reach or range property', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Special', attack_bonus: 4, description: 'Special attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
});

describe('MonsterCardModal - handleAttack: autoDamage fields in rollAttack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setInvokeDuplicityAdvantageTargets([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('passes autoDamageFormula from damage_dice_primary', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.autoDamageFormula).toBe('1d6+2');
  });

  it('passes autoDamageSecondaryFormula from damage_dice_secondary', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Multiattack', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', damage_dice_secondary: '1d4+1', damage_type_secondary: 'piercing', description: 'Two attacks.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

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
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.autoDamageSecondaryFormula).toBe('1d4+1');
    expect(callArgs.autoDamageSecondaryDamageType).toBe('piercing');
  });

  it('passes saveDc and saveType when action has save_dc', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Hex Attack', attack_bonus: 5, save_dc: 13, save_type: 'Wisdom', damage_type_primary: 'psychic', description: 'Attack with save.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    const links = document.querySelectorAll('.mc-dice-link');
    let attackLink = null;
    for (const el of links) {
      if (el.textContent.trim() === '+5') {
        attackLink = el;
        break;
      }
    }
    expect(attackLink).toBeTruthy();
    fireEvent.click(attackLink);
    expect(rollAttack).toHaveBeenCalled();
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.saveDc).toBe(13);
    expect(callArgs.saveType).toBe('wis');
    expect(callArgs.dcSuccess).toBe('half');
  });
});
