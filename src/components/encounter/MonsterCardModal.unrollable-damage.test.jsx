// @maintained-by-ai
// MA-0014 modal press-refusal lane (owner): a dispatched damage-chip press whose roll
// resolves null must console.error + emit exactly ONE 'automation blocked' log carrying
// the authored formula bytes — zero rollDamage, no fabricated total, never silence.
// The null is forced at the roll seam (rollExpression→null): post-fix render gates keep
// unrollable formulas from ever becoming clickable, so a press can only meet a null when
// the roll itself fails to resolve — defense-in-depth, not a dead code path (chip press
// reaches handleDamage via MonsterCardBody :241 passthrough, the bug's original lane).
// logBlockedDamageRoll (MonsterCardModal.jsx:1491-1500) is the ONE shared refusal
// producer for every damage seam — its console + log bytes are pinned exactly once here.
// Cited, NOT duplicated (inverse ownership cuts):
// - unrollable chip render, canRollExpression rollability-isolated + disk verbatim:
//   MonsterAction.unrollable-damage.test.jsx :53-99 (test.jsx #781 map / #763 render faces).
// - attack-row missing-to-hit suppression (Eye Ray 'Ranged Spell Attack' wording):
//   MonsterAction.ma0286-slam-suppression.test.jsx :45-59.
// - autoDamageRoll blocked seam face ("MA-0014 inert face ... once"):
//   MonsterCardModal.flat-hit-damage.test.jsx:152-170 — recommend adding there (report-only):
//   console.error + exact blocked-description pins, so seam-face assertions match this producer.
// - generic autoDamageRoll Done seam / rollDamage payloads:
//   MonsterCardModal.auto-damage-roll.test.jsx:201-253.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// canRollExpression stays REAL so the Club chip arms and is genuinely clickable;
// only rollExpression is forced null to arm the refusal branch deterministically
// (rollExpressionDoubled never fires — popupHtml is null, wasCrit falsy).
vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollDamage = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: _rollDamage,
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollDamage,
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

let consoleErrorSpy;

beforeEach(() => {
  vi.clearAllMocks();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('MA-0014 MonsterCardModal press refusal', () => {
  it('refuses a damage-chip press that resolves null: console.error + exactly one automation-blocked log, zero rollDamage', () => {
    // Damage-only wording (no Spell/Weapon Attack token) so the MA-0286 suppression
    // gate cannot interfere: the chip is live, the press dispatches, and the refusal
    // is attributable to the roll seam alone (no false green on an absent chip).
    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'Bludgeoning', description: 'Melee Attack.' }],
    });
    const { container } = render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);
    const chip = [...container.querySelectorAll('.mc-dice-link')].find(el => el.textContent.includes('1d6+2'));
    expect(chip).toBeTruthy();

    fireEvent.click(chip);

    expect(rollDamage).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Goblin — Club: "1d6+2"'));
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'automation blocked',
      characterName: 'Goblin',
      abilityName: 'Club',
      description: 'Goblin Club: damage formula "1d6+2" could not be rolled — GM adjudicate manually.',
      timestamp: expect.any(Number),
    });
  });
});
