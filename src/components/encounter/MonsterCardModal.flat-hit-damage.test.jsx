// @maintained-by-ai
// MA-0322: Awakened Shrub / Rake — flat "Hit: 1 Slashing damage." (no
// damage_dice_primary) must arm autoDamageFormula "1" on the attack chip and
// resolve dice-less on hit (total 1, empty rolls), never silently zero.
//
// Audit + trim (lane: flat damage, no dice — diceRoller stays REAL here:
// rollExpression('1') genuinely returns null, constants are not dice, so the
// parseConstant seam (MonsterCardModal.jsx:1486) is proven at this seam;
// auto-damage-roll.test.jsx (#580) MOCKS rollExpression and cannot cover it).
//   - 4 tests → 2: chip-arm identity kept once (flat formula byte →
//     rollAttack options), callback faces collapsed into ONE it.each
//     (hit / crit / blocked-refusal) per #580's blocked-guard precedent.
//   - crit row pins REAL semantics: flat NEVER doubles on crit (dice-only
//     doubling, :1480) — total stays 1 and context.isAutoCrit rides through.
//   - vacuous purges: toHaveBeenCalled before mock.calls access,
//     truthy-on-immediately-invoked callback; unused _roll*/_setPopupHtml
//     export channels purged (hook-object methods stay for the modal's
//     destructure). Chip-transport blocked face owned by
//     unrollable-damage.test.jsx; secondary chip owned by #590; secondary
//     flat byte owned by cultist-flat-secondary.test.js (#589).
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks (mirror MonsterCardModal.auto-damage-roll.test.jsx) ─────────────
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  // Stable identities for the remaining channels the modal destructures (:2211).
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();

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

  return { default: mockHook, _rollAttack, _rollDamage };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ')),
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
  expect(typeof hookOpts.autoDamageRoll).toBe('function');
  return hookOpts.autoDamageRoll;
}

describe('MonsterCardModal — MA-0322 flat hit damage (Rake, no dice)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('arms autoDamageFormula "1" + Slashing from dice-less prose on the +1 attack chip', () => {
    renderShrub();
    expect(rollAttack.mock.calls[0][2].autoDamageFormula).toBe('1');
    expect(rollAttack.mock.calls[0][2].damageType).toBe('Slashing');
  });

  it.each([
    {
      label: 'hit — constant resolves dice-less',
      autoDamage: { formula: '1', damageType: 'Slashing', name: 'Rake', attackerName: 'Awakened Shrub 1' },
    },
    {
      // Flat NEVER doubles on crit (dice-only doubling, playbook §4):
      // real rollExpressionDoubled('1') → null, parseConstant → 1 verbatim.
      label: 'crit — flat total stays 1 (not doubled)',
      autoDamage: { formula: '1', damageType: 'Slashing', name: 'Rake', attackerName: 'Awakened Shrub 1', isAutoCrit: true },
      crit: true,
    },
    {
      // MA-0014 inert face at the flat callback seam, once: nothing
      // resolves → logged refusal, never silence.
      label: 'unrollable formula blocked (MA-0014)',
      autoDamage: { formula: 'spell level', damageType: 'force', name: 'Broken', attackerName: 'Awakened Shrub 1' },
      blocked: true,
    },
  ])('autoDamageRoll: $label', async ({ autoDamage, blocked, crit }) => {
    const autoDamageRoll = renderShrub();
    await act(async () => {
      await autoDamageRoll(autoDamage);
    });
    if (blocked) {
      expect(rollDamage).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'automation blocked',
        abilityName: 'Broken',
      }));
      return;
    }
    expect(rollDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rake',
        formula: '1',
        total: 1,
        rolls: [],
        modifier: 0,
        // wasCrit = isCrit || autoDamage.isAutoCrit (:2223) — absent-flag
        // hit face is undefined, crit face pins TRUE, and total still 1.
        context: expect.objectContaining({ damageType: 'Slashing', targetName: 'Player A', attackerName: 'Awakened Shrub 1', ...(crit ? { isAutoCrit: true } : {}) }),
      })
    );
  });
});
