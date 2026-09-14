// MA-0014: handleDamage / auto-damage roll on an unparseable formula must log
// an `automation blocked` refusal + console.error — never vanish silently.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => null),
  rollExpressionDoubled: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  let _opts = null;
  const mockHook = vi.fn((_monsterName, _campaignName, opts) => {
    _opts = opts;
    return {
      popupHtml: null,
      setPopupHtml: vi.fn(),
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
    __getOpts: () => _opts,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [], targetName: 'Player A' })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 30)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollDamage = useLoggedDiceRoll._rollDamage;

const CREATURES = [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }];

let consoleErrorSpy;

beforeEach(() => {
  vi.clearAllMocks();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('MA-0014 MonsterCardModal unrollable damage', () => {
  it('renders no clickable Eye Ray chip for unparseable formula', () => {
    const m = makeMonster({
      actions: [{
        name: 'Eye Ray',
        description: 'Ranged Spell Attack: +spell attack modifier, range 150 ft. Hit: 1d8+3+spell level Psychic damage.',
        attack_bonus: null,
        damage_dice_primary: '1d8+3+spell level',
        damage_type_primary: 'Psychic',
      }],
    });
    const { container } = render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES })} />);
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.some(el => el.textContent.includes('spell level'))).toBe(false);
    expect(container.textContent).toContain('Ranged Spell Attack');
  });

  it('logs automation blocked (not silence) when a clicked chip rolls null', () => {
    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'Bludgeoning', description: 'Melee Attack.' }],
    });
    const { container } = render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES })} />);
    const chip = [...container.querySelectorAll('.mc-dice-link')].find(el => el.textContent.includes('1d6+2'));
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(rollDamage).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation blocked',
      characterName: 'Goblin',
      abilityName: 'Club',
      description: expect.stringContaining('1d6+2'),
    }));
  });

  it('logs automation blocked for unparseable auto-damage after an attack', async () => {
    const m = makeMonster({
      actions: [{ name: 'Eye Ray', attack_bonus: null, damage_dice_primary: '1d8+3+spell level', damage_type_primary: 'Psychic', description: 'Ranged Spell Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES })} />);
    const opts = useLoggedDiceRoll.__getOpts();
    await opts.autoDamageRoll({ name: 'Eye Ray', formula: '1d8+3+spell level' }, false);
    expect(rollDamage).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation blocked',
      characterName: 'Goblin',
      abilityName: 'Eye Ray',
    }));
  });
});
