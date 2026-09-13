// @improved-by-ai
// SP-094: monster-attack attacker-type lookup must resolve the real monsterType
// (EB combatSummary monsters carry type:'npc' with the real D&D type in monsterType).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollAttack };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  // Honour PfE disadvantage: a warded attacker's targetDisadvantageCount forces 'disadvantage'.
  combineAttackModes: vi.fn((_attacker, targetEffectData) => {
    const dis = targetEffectData?.targetDisadvantageCount || 0;
    return dis > 0 ? 'disadvantage' : 'normal';
  }),
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
  rangeToFeet: vi.fn(() => 5),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
}));

const WARDED = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn((type) => WARDED.some(t => t.toLowerCase() === String(type).toLowerCase())),
  handle: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
}));

import { _rollAttack } from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as pfeg from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';

function clickAttackLink(text) {
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.trim() === text);
  expect(link, `attack link "${text}"`).toBeTruthy();
  fireEvent.click(link);
}

describe('MonsterCardModal - Protection from Evil and Good attacker-type lookup (SP-094)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(false);
    pfeg.isCreatureWarded.mockImplementation((type) => WARDED.some(t => t.toLowerCase() === String(type).toLowerCase()));
    damageUtils.__setFindCreatureReturn(null);
  });

  it('resolves attacker monsterType (not npc) so a warded Undead attacker forces Disadvantage', () => {
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(true);
    // EB combatSummary monster: type 'npc', real type 'Undead'
    damageUtils.__setFindCreatureReturn({ name: 'Wight 1', type: 'npc', monsterType: 'Undead', targetName: 'HexWarlock' });

    const m = makeMonster({ actions: [{ name: 'Necrotic Sword', attack_bonus: 4, description: 'Melee Attack.' }] });
    render(<MonsterCardModal {...makeProps(m, {
      monsterName: 'Wight 1', creatureName: 'Wight 1',
      creatures: [{ name: 'Wight 1', type: 'npc', monsterType: 'Undead', targetName: 'HexWarlock' }, { name: 'HexWarlock', type: 'player' }],
    })} />);

    clickAttackLink('+4');

    expect(pfeg.isCreatureWarded).toHaveBeenCalled();
    const wardedArg = pfeg.isCreatureWarded.mock.calls[0][0];
    expect(wardedArg).toBe('Undead');
    expect(wardedArg).not.toBe('npc');
    expect(_rollAttack.mock.calls[0][2].forcedMode).toBe('disadvantage');
  });

  it('does NOT apply disadvantage to an unprotected protected-target (control: PfE inactive)', () => {
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(false);
    damageUtils.__setFindCreatureReturn({ name: 'Wight 1', type: 'npc', monsterType: 'Undead', targetName: 'HexWarlock' });

    const m = makeMonster({ actions: [{ name: 'Necrotic Sword', attack_bonus: 4, description: 'Melee Attack.' }] });
    render(<MonsterCardModal {...makeProps(m, {
      monsterName: 'Wight 1', creatureName: 'Wight 1',
      creatures: [{ name: 'Wight 1', type: 'npc', monsterType: 'Undead', targetName: 'HexWarlock' }, { name: 'HexWarlock', type: 'player' }],
    })} />);

    clickAttackLink('+4');
    expect(_rollAttack.mock.calls[0][2].forcedMode).toBeUndefined();
  });

  it('does NOT apply disadvantage to a non-warded monsterType attacker (control: Beast)', () => {
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(true);
    damageUtils.__setFindCreatureReturn({ name: 'Ogre 1', type: 'npc', monsterType: 'Giant', targetName: 'HexWarlock' });

    const m = makeMonster({ name: 'Ogre', actions: [{ name: 'Greatclub', attack_bonus: 6, description: 'Melee Attack.' }] });
    render(<MonsterCardModal {...makeProps(m, {
      monsterName: 'Ogre 1', creatureName: 'Ogre 1',
      creatures: [{ name: 'Ogre 1', type: 'npc', monsterType: 'Giant', targetName: 'HexWarlock' }, { name: 'HexWarlock', type: 'player' }],
    })} />);

    clickAttackLink('+6');

    expect(pfeg.isCreatureWarded).toHaveBeenCalled();
    expect(pfeg.isCreatureWarded.mock.calls[0][0]).toBe('Giant');
    expect(_rollAttack.mock.calls[0][2].forcedMode).toBeUndefined();
  });
});
