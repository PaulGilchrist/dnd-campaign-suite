// Audit + trim + restore (#590 citation refresh + #578 psychic-strike alert restore):
//
//   Citations updated to SEAM NAMES (old line ranges no longer exist):
//     - Ability modifier ray trio (forcedMode disadvantage / non-str / no-debuff)
//       → damage-and-ability-checks.test.jsx "ability check chip" it.each.
//     - Initiative chip (+/- bonus, unparseable text) → damage-and-ability-checks.test.jsx
//       "initiative chip" it.each — initiative-chips owner per #590.
//     - Primary damage chip → auto-damage-roll.test.jsx "attack chip → rollAttack
//       auto-damage transport" seam (#580).
//     - Action save_dc chip → save-modifier.test.jsx (.mc-dice-link-save-clickable
//       handleSaveRoll lane); trait/reaction/legendary save_dc chips →
//       auto-damage-roll.test.jsx "trait save_dc chip" it.each
//       (replaces dead :208-225 cite).
//     - Skill chip ray legs: the old damage-and-ability-checks :313-373 cite is
//       dead and app-wide grep showed ZERO rollSkillCheck click assertions —
//       restored HERE as one it.each on handleSkillCheck (MonsterCardModal.jsx
//       :2460-2464): Athletics+debuff → forcedMode, lowercase-key hazard →
//       undefined, non-Athletics gate → undefined.
//
//   RESTORED per #578: psychicStrikePreconditionFailed alert legs
//   (MonsterCardModal.jsx:941-953) — once per branch, exact alert message +
//   zero rollAttack. These branches were untested app-wide (attack-advanced
//   :551-606 was a dead cite). Hex-gate POSITIVE leg lives in
//   attack-advanced.test.jsx "Psychic Strike hex-gate positive".
//
//   Kept (unique): monster-level save chips (.mc-dice-link DefenseModifierRow →
//   handleSaveThrow :2458, distinct from save-modifier's action-save_dc lane)
//   — collapsed to it.each; attacker cannot act — authoritative location,
//   logic.test.jsx:1-4 cites this file for its removal.
//
//   Dead-mock purge: _rollDamage/_setPopupHtml export channels, popupHtml
//   getter state, conditionEffects __setComputeReturn (never set non-null),
//   useRuntimeState __setTempHp, formula-arithmetic diceRoller mock (no test
//   pins a damage total here). Every ctx assertion is exact
//   ({forcedMode} | undefined — MA-0694 bolster te channel is byte-inert
//   without a bolster_advantage te on the holder).
//
// @maintained-by-ai

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ----
vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollAttack = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollAttack, _rollSavingThrow, _rollSkillCheck };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

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

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: vi.fn(() => 0),
    __setTargetEffects(val) { _targetEffects = val; },
  };
});

// ── Re-import mocked modules ----
import { _rollAttack, _rollSavingThrow, _rollSkillCheck } from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { __setTargetEffects } from '../../hooks/runtime/useRuntimeState.js';

// ── Helpers ----

/**
 * Find a dice link element by exact visible text content.
 */
function findDiceLinkByText(text) {
  const links = document.querySelectorAll('.mc-dice-link');
  return Array.from(links).find((el) => el.textContent.trim() === text) || null;
}

let alertSpy = null;

// ── Tests ----

describe('MonsterCardModal interaction / game rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
    __setTargetEffects([]);
  });

  afterEach(() => {
    alertSpy?.mockRestore();
    alertSpy = null;
  });

  // ════════════════════════════════════════════
  // Monster-level save chips → rollSavingThrow
  // (.mc-dice-link DefenseModifierRow lane — NOT the
  // .mc-dice-link-save-clickable action-save_dc lane owned
  // by save-modifier.test.jsx)
  // ════════════════════════════════════════════

  describe('save modifier dice links', () => {
    it.each([
      { savingThrows: { str: { modifier: 2 }, dex: { modifier: 1 } }, abbr: 'STR', mod: 2 },
      { savingThrows: { con: { modifier: -3 } }, abbr: 'CON', mod: -3 },
    ])('save chip $abbr passes abbreviation + modifier $mod through', ({ savingThrows, abbr, mod }) => {
      render(<MonsterCardModal {...makeProps(makeMonster({ saving_throws: savingThrows }))} />);
      const chip = Array.from(document.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.includes(abbr));
      expect(chip).toBeTruthy();
      fireEvent.click(chip);
      // MA-0694: third ctx channel (bolster te) is byte-inert without a
      // bolster_advantage te on the holder — exact undefined.
      expect(_rollSavingThrow).toHaveBeenCalledWith(abbr, mod, undefined);
    });
  });

  // ════════════════════════════════════════════
  // Skill chip → rollSkillCheck ray gate
  // (handleSkillCheck :2460-2464 — restored, was
  // untested app-wide after the stale :313-373 cite died)
  // ════════════════════════════════════════════

  describe('skill chip ray gate', () => {
    it.each([
      { name: 'Athletics', debuff: true, ctx: { forcedMode: 'disadvantage' } },
      { name: 'athletics', debuff: true, ctx: undefined },
      { name: 'Perception', debuff: true, ctx: undefined },
    ])('skill "$name" with ray debuff $debuff → ctx $ctx', ({ name, debuff, ctx }) => {
      if (debuff) __setTargetEffects([{ target: 'Goblin', effect: 'ray_of_enfeeble_debuff' }]);
      render(<MonsterCardModal {...makeProps(makeMonster({ skills: { [name]: { modifier: 5 } } }))} />);

      const sign = '+5';
      const chip = findDiceLinkByText(`${name} ${sign}`);
      expect(chip).toBeTruthy();
      fireEvent.click(chip);
      expect(_rollSkillCheck).toHaveBeenCalledWith(name, 5, ctx);
    });
  });

  // ════════════════════════════════════════════
  // Psychic Strike precondition alerts (#578 restore)
  // once per branch of psychicStrikePreconditionFailed
  // (:941-953): alert message exact, zero rollAttack.
  // ════════════════════════════════════════════

  describe('Psychic Strike precondition alerts', () => {
    it.each([
      {
        desc: 'no target selected',
        attacker: { name: 'Goblin', conditions: [] },
        creatures: [{ name: 'Goblin' }, { name: 'Player A', type: 'player' }],
        targetEffects: [],
        alert: "Psychic Strike requires a target to be selected.",
      },
      {
        desc: 'target lacks hex effect',
        attacker: { name: 'Goblin', conditions: [], targetName: 'Player A' },
        creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }],
        targetEffects: [],
        alert: "Psychic Strike can only be used on a creature under the warlock's Hex spell.",
      },
    ])('refuses with alert when $desc', ({ attacker, creatures, targetEffects, alert }) => {
      damageUtils.__setFindCreatureReturn(attacker);
      __setTargetEffects(targetEffects);
      alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const m = makeMonster({
        actions: [{ name: 'Psychic Strike', attack_bonus: 4, description: 'Psychic attack.' }],
      });
      render(<MonsterCardModal {...makeProps(m, { creatures })} />);

      fireEvent.click(findDiceLinkByText('+4'));
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(alert);
      expect(_rollAttack).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════
  // Attacker cannot act — attack blocking
  // (authoritative: logic.test.jsx removed its copy)
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
