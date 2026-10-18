// Audit + trim (vacuous-lane fix + dead-mock purge, #578/#579 pattern):
//
//   VACUOUS LANE FIXED: the autoDamageRoll callback rides the useLoggedDiceRoll
//   OPTIONS (hook 3rd arg, MonsterCardModal.jsx:2216), NOT the rollAttack call
//   args — the old `rollAttack.mock.calls[0][1]?.autoDamageRoll` read the
//   numeric bonus and the `if (autoDamageRoll)` guards silently skipped every
//   assertion in all 5 callback tests. Callbacks are now grabbed from the hook
//   options (flat-hit-damage.test.jsx:119 idiom) with a strict function assert.
//
//   attack chip transport: 4 it.each cases → 3. Plain primary and secondary
//     pass-through merged into one row (same non-composite branch, one ctx).
//     MA-0551 plain-composite strip and MA-0551 save-leg-secondary strip kept
//     — distinct branches of buildAttackChipSaveOptions (:1302-1311) with no
//     other modal-click-lane owner (secondary-save-transport/ma1329 test the
//     helpers at unit level only).
//   callback behavior: 2 it.each tables (4 cases) + null-guard → ONE it.each
//     of 5 cases (roll / auto-crit double / saveDc ctx / secondary ctx /
//     blocked-null guard) sharing the render→click→invoke pattern.
//   traits/reactions/legendary: one it.each kept, one case per section lane.
//     The vacuous save_dc case (clicked, asserted nothing) now pins
//     rollSavingThrow('CON', .., ctx.saveDc 14) — rolled lane at the modal
//     seam; modifier math owned by save-modifier.test.jsx.
//   dead mock channels purged: conditionEffects.__setComputeReturn,
//     damageUtils.__setFindCreatureReturn (constant target hoisted to the
//     mock), useRuntimeState __set* setters, unused _rollAbilityCheck/
//     _rollSkillCheck/_rollInitiative/_quickRollPlayerSave export channels.
//     addEntry now mocked — the callback's blocked-refusal path (:2218)
//     reaches logService.

import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue({}) }));

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
    rollSavingThrow: _rollSavingThrow,
    rollAbilityCheck: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

// Attacker resolvable with an armed target so every lane rolls (no
// no-target refusal); modifier math owners mocked out (playbook cite-skip).
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [], targetName: 'Player A' })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

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
  const targetEffects = [];
  return {
    useRuntimeValue: vi.fn((_characterKey, propertyName) => (propertyName === 'targetEffects' ? targetEffects : null)),
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
  };
});

// ── Re-import mocked hook for mock-call assertions ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderModal(overrides) {
  render(<MonsterCardModal {...makeProps(makeMonster(overrides), {
    creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }],
  })} />);
}

function clickChip(text) {
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text));
  expect(link).toBeTruthy();
  fireEvent.click(link);
}

// The autoDamageRoll callback rides the useLoggedDiceRoll options (3rd arg).
function grabAutoDamageRoll() {
  return useLoggedDiceRoll.default.mock.calls.at(-1)[2].autoDamageRoll;
}

const CLUB_ACTION = { name: 'Club', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' };

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - autoDamageRoll seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('attack chip → rollAttack auto-damage transport', () => {
    it.each([
      {
        desc: 'plain row passes primary + secondary auto-damage byte-identical, save keys inert',
        action: { name: 'Multiattack', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', damage_dice_secondary: '1d4+1', damage_type_secondary: 'piercing', description: 'Two attacks.' },
        expected: { autoDamageFormula: '1d6+2', autoDamageSecondaryFormula: '1d4+1', autoDamageSecondaryDamageType: 'piercing', saveDc: null, saveType: null, dcSuccess: null },
      },
      {
        // MA-0551: composite attack+save — the attack chip must NOT arm save
        // adjudication (fixed damage pays full; no npcSaveDamage hijack).
        desc: 'MA-0551: composite attack chip strips saveDc/saveType/dcSuccess (fixed damage pays full)',
        action: { name: 'Hex Attack', attack_bonus: 5, save_dc: 13, save_type: 'Wisdom', damage_dice_primary: '1d6+2', damage_type_primary: 'psychic', description: 'Attack with save.' },
        expected: { autoDamageFormula: '1d6+2', saveDc: null, saveType: null, dcSuccess: null },
      },
      {
        // MA-0551: save-leg rider secondary (dice inside save_effect) never
        // rides the attack chip — fixed primary only on hit.
        desc: 'MA-0551: Dao Earth Burst attack chip pays fixed 2d8+6 with no save hijack and no secondary pre-pay',
        action: {
          name: 'Earth Burst',
          attack_bonus: 10,
          save_dc: 16,
          save_type: 'Dexterity',
          dc_success: 'none',
          save_effect: 'Failure: 10 (3d6) Thunder damage.',
          damage_dice_primary: '2d8 + 6',
          damage_type_primary: 'Bludgeoning',
          damage_dice_secondary: '3d6',
          damage_type_secondary: 'Thunder',
          description: 'Ranged Attack Roll: +10, range 120 ft. Hit: 15 (2d8 + 6) Bludgeoning damage. Hit or Miss: 10-foot Emanation, DC 16 Dexterity. Failure: 10 (3d6) Thunder damage.',
        },
        expected: { autoDamageFormula: '2d8 + 6', autoDamageSecondaryFormula: null, saveDc: null, saveType: null, dcSuccess: null },
      },
    ])('$desc', ({ action, expected }) => {
      renderModal({ actions: [action] });
      clickChip(`+${action.attack_bonus}`);
      expect(rollAttack).toHaveBeenCalledTimes(1);
      const ctx = rollAttack.mock.calls[0][2];
      for (const [key, value] of Object.entries(expected)) {
        expect(ctx[key]).toBe(value);
      }
    });
  });

  describe('autoDamageRoll callback → rollDamage', () => {
    const AUTO_BASE = { formula: '1d6+2', damageType: 'slashing', attackerName: 'Goblin', name: 'Club', isAutoCrit: false };

    it.each([
      {
        desc: 'rolls the formula via rollExpression and lands rollDamage with hit context',
        autoDamage: AUTO_BASE,
        expected: { total: 8, context: { damageType: 'slashing', attackerName: 'Goblin', isAutoCrit: false } },
      },
      {
        desc: 'doubles the dice via rollExpressionDoubled when isAutoCrit is true',
        autoDamage: { ...AUTO_BASE, isAutoCrit: true },
        expected: { total: 16, context: { damageType: 'slashing', attackerName: 'Goblin', isAutoCrit: true } },
      },
      {
        desc: 'saveDc/saveType/dcSuccess ride the damage context when armed',
        autoDamage: { ...AUTO_BASE, damageType: 'psychic', saveDc: 13, saveType: 'wis', dcSuccess: 'half' },
        expected: { total: 8, context: { damageType: 'psychic', saveDc: 13, saveType: 'wis', dcSuccess: 'half' } },
      },
      {
        desc: 'secondary formula triple rides the damage context when present',
        autoDamage: { ...AUTO_BASE, secondaryFormula: '1d4+1', secondaryName: 'Multiattack', secondaryDamageType: 'piercing' },
        expected: { total: 8, context: { autoDamageSecondaryFormula: '1d4+1', autoDamageSecondaryName: 'Multiattack', autoDamageSecondaryDamageType: 'piercing' } },
      },
      {
        desc: 'null autoDamage is refused — zero rollDamage (blocked path)',
        autoDamage: null,
        expected: null,
      },
    ])('$desc', async ({ autoDamage, expected }) => {
      renderModal({ actions: [CLUB_ACTION] });
      clickChip('+4');
      const autoDamageRoll = grabAutoDamageRoll();
      expect(typeof autoDamageRoll).toBe('function');

      await act(async () => {
        await autoDamageRoll(autoDamage);
      });

      if (expected === null) {
        expect(rollDamage).not.toHaveBeenCalled();
        return;
      }
      expect(rollDamage).toHaveBeenCalledWith({
        name: autoDamage.name,
        formula: autoDamage.formula,
        total: expected.total,
        rolls: [3, 5],
        modifier: 2,
        context: expect.objectContaining(expected.context),
      });
    });
  });

  describe('trait/reaction/legendary section chips', () => {
    it.each([
      {
        desc: 'trait damage_dice chip rolls onDamage',
        section: 'traits',
        action: { name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d8', damage_type_primary: 'piercing' },
        chipText: '1d8',
        lane: { fn: () => rollDamage, args: [expect.objectContaining({ name: 'Bite', formula: '1d8', total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) })] },
      },
      {
        desc: 'trait attack_bonus chip rolls onAttack',
        section: 'traits',
        action: { name: 'Sting', description: '', attack_bonus: 3 },
        chipText: '+3',
        lane: { fn: () => rollAttack, args: [] },
      },
      {
        desc: 'trait save_dc chip rolls the CON save with the DC in context',
        section: 'traits',
        action: { name: 'Petrification Gaze', description: '', save_dc: 14, save_type: 'Constitution' },
        chipText: 'DC 14',
        lane: { fn: () => rollSavingThrow, args: ['CON', expect.any(Number), expect.objectContaining({ saveDc: 14 })] },
      },
      {
        desc: 'reaction damage_dice chip rolls onDamage',
        section: 'reactions',
        action: { name: 'Opportunity Attack', description: '', attack_bonus: null, damage_dice_primary: '1d6+1', damage_type_primary: 'slashing' },
        chipText: '1d6+1',
        lane: { fn: () => rollDamage, args: [expect.objectContaining({ name: 'Opportunity Attack', formula: '1d6+1' })] },
      },
      {
        desc: 'legendary damage_dice chip rolls onDamage',
        section: 'legendary_actions',
        action: { name: 'Tail Attack', description: '', attack_bonus: null, damage_dice_primary: '1d4', damage_type_primary: 'bludgeoning' },
        chipText: '1d4',
        lane: { fn: () => rollDamage, args: [expect.objectContaining({ name: 'Tail Attack', formula: '1d4' })] },
      },
    ])('$desc', ({ section, action, chipText, lane }) => {
      renderModal({ [section]: [action] });
      clickChip(chipText);
      if (lane.args.length > 0) {
        expect(lane.fn()).toHaveBeenCalledWith(...lane.args);
      } else {
        expect(lane.fn()).toHaveBeenCalledTimes(1);
      }
    });
  });
});

// @maintained-by-ai
