// @improved-by-ai
// @cleaned-by-ai
// Removed 11 redundant tests covered by sibling files:
//
//   Ability modifier tests (3)
//     → MonsterCardModal.damage-and-ability-checks.test.jsx:236-293
//       "passes forcedMode disadvantage when monster has ray_of_enfeeble_debuff..."
//       "does not pass forcedMode when ability is not STR even with ray debuff"
//       "does not pass forcedMode when monster lacks ray_of_enfeeble_debuff even for STR"
//
//   Skill dice link tests (2)
//     → MonsterCardModal.damage-and-ability-checks.test.jsx:313-373
//       "does not pass forcedMode because skill key is lowercase"
//       "does not pass forcedMode when skill is not Athletics even with ray debuff"
//       (base skill click test also covered by same file)
//
//   Initiative tests (3)
//     → MonsterCardModal.damage-and-ability-checks.test.jsx:383-407
//       "calls rollInitiative with positive bonus"
//       "calls rollInitiative with negative bonus"
//       "renders initiative text without a clickable dice link when bonus is not parseable"
//
//   Psychic Strike tests (2)
//     → MonsterCardModal.attack-advanced.test.jsx:551-606
//       "shows alert when Psychic Strike is used without a target"
//       "shows alert when Psychic Strike is used but target lacks hex effect"
//
//   Save DC dice link test (1)
//     → MonsterCardModal.auto-damage-roll.test.jsx:208-225
//       "calls rollSavingThrow instead of rollDamage when action has save_dc"
//
// Kept (unique behavioral coverage):
//   Monster-level saving throws (2) — different UI rendering path from
//   action save_dc tested in save-modifier.test.jsx (uses .mc-dice-link
//   vs .mc-dice-link-save-clickable, monster.saving_throws vs action.save_dc).
//   Attacker cannot act (1) — authoritative location; logic.test.jsx
//   explicitly removed its copy here per comments on lines 3-6.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ----
vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _targetEffects = [];
  let _tempHp = null;

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'tempHp') return _tempHp;
    return null;
  });

  const mockGetRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'tempHp') return _tempHp;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    __setTargetEffects(val) { _targetEffects = val; },
    __setTempHp(val) { _tempHp = val; },
  };
});

// ── Re-import mocked modules ----
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Helpers ----

/**
 * Find a dice link element by exact visible text content.
 */
function findDiceLinkByText(text) {
  const links = document.querySelectorAll('.mc-dice-link');
  return Array.from(links).find((el) => el.textContent.trim() === text) || null;
}

// ── Tests ----

describe('MonsterCardModal interaction / game rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setTargetEffects([]);
  });

  // ════════════════════════════════════════════
  // Save modifier dice link → rollSavingThrow
  // ════════════════════════════════════════════

  describe('save modifier dice links', () => {
    it('clicking save modifier dice link calls rollSavingThrow with ability abbreviation and modifier', () => {
      const m = makeMonster({
        saving_throws: { str: { modifier: 2 }, dex: { modifier: 1 } },
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      // Save modifier links use className "mc-dice-link" inside save rows
      const saveLinks = document.querySelectorAll('.mc-dice-link');
      // Find the STR save link (contains "STR" or the abbreviation)
      const strSaveLink = Array.from(saveLinks).find((el) => el.textContent.includes('STR'));
      expect(strSaveLink).toBeTruthy();
      fireEvent.click(strSaveLink);
      // MA-0694 stale-pin inversion: save chips gained a third forcedMode
      // context channel (Bolster te consumer) — undefined = byte-inert
      // without a `bolster_advantage` te on the holder.
      expect(rollSavingThrow).toHaveBeenCalledWith('STR', 2, undefined);
    });

    it('clicking save modifier with negative value passes the negative modifier', () => {
      const m = makeMonster({
        saving_throws: { con: { modifier: -3 } },
      });
      render(<MonsterCardModal {...makeProps(m)} />);
      const conSaveLink = Array.from(document.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.includes('CON'));
      expect(conSaveLink).toBeTruthy();
      fireEvent.click(conSaveLink);
      expect(rollSavingThrow).toHaveBeenCalledWith('CON', -3, undefined);
    });
  });

  // ════════════════════════════════════════════
  // Attacker cannot act — attack blocking
  // ════════════════════════════════════════════

  describe('attacker cannot act', () => {
    it('does not render attack links when the attacker has an incapacitating condition', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [{ key: 'incapacitated' }],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.', reach: '5 ft.' }],
      });
      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

      // When attacker cannot act, the attack dice link is not rendered
      const attackLink = findDiceLinkByText('+4');
      expect(attackLink).toBeFalsy();
      // The incapacitated label should be visible
      expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
    });
  });
});
