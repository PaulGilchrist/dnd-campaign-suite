// MA-0322: Awakened Shrub / Rake — flat "Hit: 1 Slashing damage." (no
// damage_dice_primary) must arm autoDamageFormula "1" on the attack chip and
// resolve dice-less on hit (total 1, empty rolls), never silently zero.
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks (mirror MonsterCardModal.auto-damage-roll.test.jsx) ─────────────
// diceRoller stays REAL: rollExpression('1') genuinely returns null
// (constants are not dice) — the MA-0322 parseConstant seam resolves it.
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
  findCreatureByName: vi.fn(() => ({ name: 'Awakened Shrub 1', conditions: [], targetName: 'Player A' })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;

const RAKE_ACTION = {
  name: 'Rake',
  description: 'Melee Attack Roll: +1, reach 5 ft. <strong>Hit:</strong> 1 Slashing damage.',
  attack_bonus: 1,
  reach: '5 ft.',
  damage_type_primary: 'Slashing',
};

function renderShrub() {
  const m = makeMonster({ name: 'Awakened Shrub 1', actions: [RAKE_ACTION] });
  render(<MonsterCardModal {...makeProps(m, {
    creatures: [{ name: 'Awakened Shrub 1', targetName: 'Player A' }, { name: 'Player A', type: 'player' }],
  })} />);
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes('+1'));
  expect(link).toBeTruthy();
  fireEvent.click(link);
  // The autoDamageRoll callback rides the useLoggedDiceRoll options (3rd arg).
  const hookOpts = useLoggedDiceRoll.default.mock.calls.at(-1)[2];
  return hookOpts.autoDamageRoll;
}

describe('MonsterCardModal — MA-0322 flat hit damage (Rake, no dice)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('arms autoDamageFormula "1" from dice-less prose on the +1 attack chip', () => {
    renderShrub();
    expect(rollAttack).toHaveBeenCalled();
    expect(rollAttack.mock.calls[0][2].autoDamageFormula).toBe('1');
    expect(rollAttack.mock.calls[0][2].damageType).toBe('Slashing');
  });

  it('resolves the constant dice-less on hit: rollDamage total 1, empty rolls', async () => {
    const autoDamageRoll = renderShrub();
    expect(autoDamageRoll).toBeTruthy();
    await act(async () => {
      await autoDamageRoll({
        formula: '1',
        damageType: 'Slashing',
        name: 'Rake',
        attackerName: 'Awakened Shrub 1',
        source: 'Awakened Shrub 1',
      });
    });
    expect(rollDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rake',
        formula: '1',
        total: 1,
        rolls: [],
        modifier: 0,
        context: expect.objectContaining({ damageType: 'Slashing', targetName: 'Player A', attackerName: 'Awakened Shrub 1' }),
      })
    );
  });

  it('does NOT double flat damage on crit (dice-only doubling)', async () => {
    const autoDamageRoll = renderShrub();
    await act(async () => {
      await autoDamageRoll({
        formula: '1',
        damageType: 'Slashing',
        name: 'Rake',
        attackerName: 'Awakened Shrub 1',
        isAutoCrit: true,
      });
    });
    expect(rollDamage).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1, rolls: [], modifier: 0 })
    );
  });

  it('still logs a blocked-damage refusal for unrollable formulas (MA-0014 intact)', async () => {
    const autoDamageRoll = renderShrub();
    await act(async () => {
      await autoDamageRoll({
        formula: 'spell level',
        damageType: 'force',
        name: 'Broken',
        attackerName: 'Awakened Shrub 1',
      });
    });
    expect(rollDamage).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation blocked',
      abilityName: 'Broken',
    }));
  });
});
