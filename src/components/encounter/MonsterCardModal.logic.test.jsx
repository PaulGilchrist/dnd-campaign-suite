// @maintained-by-ai
// Audit + trim (8 → 7): combat-context load/skip faces collapsed into one
// unmount-based test (same :2124 guard); dead _rollAbilityCheck/_rollSkillCheck/
// _rollInitiative/_quickRollPlayerSave export channels purged (hook-object
// methods kept for :2211 destructure); rollExpression override purged
// empirically — no surviving leg reaches it (crit uses rollExpressionDoubled;
// non-crit chips owned by damage-and-ability-checks/auto-damage-roll #580).
// Vacuity guards added (#580 class). Strengthened: blinded leg now clicks and
// pins rollAttack('Club', 4) — non-blocking cannotAct lane (blocking face +
// (Incapacitated) label stay owned by interaction.test.jsx). Preserved cited
// owners: petrified saveConditions :274 (conditions-extraction #586 cited
// :265), riderAttackBonus roll :228 (helpers.test.jsx cites this file),
// executeBlockSaveRoll non-empty saveConditions + autoDamage ctx matcher
// :294-306 (conditions-extraction #586 cited :285-297), dice crit popup
// :313-330 (#602 lane).
// Behavioral tests whose SOLE owner is this file (re-verified Oct 2026 against
// all sibling MonsterCardModal*.test.* files):
//   attacker can act with a NON-blocking condition — chip renders and +4
//     clicks roll unmodified. Blocking face + (Incapacitated) label owned by
//     interaction.test.jsx "attacker cannot act".
//   riderAttackBonus → rollAttack bonus fold — roll-path owner; helpers.test.jsx
//     cites this file for the roll and owns only the badge.
//   resistanceNotice — getResistanceNotice args + rollAttack passthrough; sole
//     owner (attack-advanced.test.jsx lost __setResistanceNoticeReturn in its
//     #578 trim).
//   saveConditions ['petrified'] from save_effect on the attack chip — cited
//     owner by conditions-extraction.test.jsx (#586); chip case-insensitivity
//     owned by gorgon-breath.test.jsx:145-167.
//   save chip → rollSavingThrow autoDamage context + non-empty saveConditions —
//     cited owner by conditions-extraction.test.jsx (#586); empty-[] face owned
//     by ma1863-behemoth-trumpet.test.jsx:206-213; abbreviation/modifier
//     resolution owned by save-modifier.test.jsx (full matcher kept here per
//     the #586 cite range).
//   handleDamage popup isCrit → doubled total + popup clear — dice crit popup
//     owner (#602); flat non-doubling owned by flat-hit-damage.test.jsx;
//     autoDamageRoll callback crit by auto-damage-roll.test.jsx (#580);
//     non-crit primary/secondary chips by damage-and-ability-checks.test.jsx.
//   getCombatContext fallback, both faces — sole owner (no sibling asserts the
//     call; senses-and-fallback only renders the name).

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  // Stable identities for the channels the modal destructures (:2211) that no
  // test here reads; export bindings purged (#578 dead-mock pattern).
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
    _rollSavingThrow,
    _setPopupHtml,
    __setPopupHtml(val) { _popupHtml = val; },
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
  let _resistanceNoticeReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => _resistanceNoticeReturn),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
    __setResistanceNoticeReturn(val) { _resistanceNoticeReturn = val; },
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
  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return [];
    if (propertyName === 'inspiringMovementNoOA') return false;
    if (propertyName === 'remarkableAthleteNoOA') return false;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollDamage = useLoggedDiceRoll._rollDamage;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find a dice link by exact text content and click it. */
function clickDiceLink(text) {
  const links = document.querySelectorAll('.mc-dice-link');
  const link = Array.from(links).find(el => el.textContent.trim() === text);
  expect(link, `Expected a dice link with text "${text}"`).toBeTruthy();
  fireEvent.click(link);
}

/** Reset all shared mock state used by the logic tests. */
function resetMocks() {
  vi.clearAllMocks();
  useLoggedDiceRoll.__setPopupHtml(null);
  conditionEffects.__setComputeReturn(null);
  damageUtils.__setFindCreatureReturn(null);
  damageUtils.__setResistanceNoticeReturn(null);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleAttack: attacker CAN act with non-blocking condition', () => {
  beforeEach(resetMocks);

  it('still renders and rolls the attack dice link when the attacker has a non-blocking condition', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [{ key: 'blinded', label: 'Blinded' }],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    expect(screen.queryByText('(Incapacitated)')).not.toBeInTheDocument();
    clickDiceLink('+4');
    // Blinded gates nothing in the cannotAct lane — bonus rolls unmodified.
    expect(rollAttack).toHaveBeenCalledWith('Club', 4, expect.anything());
  });
});

describe('MonsterCardModal - handleAttack: rider attack bonus', () => {
  beforeEach(resetMocks);

  it('adds riderAttackBonus to the effective bonus passed to rollAttack', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });
    conditionEffects.__setComputeReturn({ ...defaultConditionEffects, riderAttackBonus: 2 });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickDiceLink('+4');
    expect(rollAttack).toHaveBeenCalledWith('Club', 6, expect.anything());
  });
});

describe('MonsterCardModal - handleAttack: resistance notice', () => {
  beforeEach(resetMocks);

  it('passes the target resistance notice through to rollAttack', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Ogre',
    });
    damageUtils.__setResistanceNoticeReturn('Resists slashing');

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: 4, damage_type_primary: 'slashing', description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Ogre' }, { name: 'Ogre', resistances: ['slashing'] }] })} />);

    clickDiceLink('+4');
    expect(rollAttack).toHaveBeenCalled();
    expect(damageUtils.getResistanceNotice).toHaveBeenCalledWith(['slashing'], ['slashing'], [], 'Ogre');
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.resistanceNotice).toBe('Resists slashing');
  });
});

describe('MonsterCardModal - handleAttack: save conditions', () => {
  beforeEach(resetMocks);

  it('passes saveConditions parsed from save_effect to rollAttack', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Petrifying Bite', attack_bonus: 4, save_dc: 13, save_type: 'Constitution', save_effect: 'On a failed save, the target is petrified.', description: 'Bite.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickDiceLink('+4');
    expect(rollAttack).toHaveBeenCalled();
    const callArgs = rollAttack.mock.calls[0][2];
    expect(callArgs.saveConditions).toEqual(['petrified']);
  });
});

describe('MonsterCardModal - handleSaveRoll: autoDamage context', () => {
  beforeEach(resetMocks);

  it('passes autoDamage formula, type, name, and saveConditions when rolling a save for a damaging action', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Stinking Cloud', save_dc: 13, save_type: 'Constitution', damage_dice_primary: '4d6', damage_type_primary: 'poison', save_effect: 'On a failed save, the target is poisoned.', description: 'A cloud of noxious gas.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickDiceLink('4d6');
    expect(rollSavingThrow).toHaveBeenCalledWith(
      'CON',
      0,
      expect.objectContaining({
        saveDc: 13,
        saveType: 'Constitution',
        dcSuccess: 'half',
        autoDamageFormula: '4d6',
        autoDamageDamageType: 'poison',
        autoDamageName: 'Stinking Cloud',
        saveConditions: ['poisoned'],
      })
    );
  });
});

describe('MonsterCardModal - handleDamage: critical-hit popup', () => {
  beforeEach(resetMocks);

  it('doubles damage and clears the popup when the popup roll is a critical hit', () => {
    useLoggedDiceRoll.__setPopupHtml({ isCrit: true });
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m)} />);

    clickDiceLink('1d6+2');
    expect(useLoggedDiceRoll._setPopupHtml).toHaveBeenCalledWith(null);
    expect(rollDamage).toHaveBeenCalledWith(
      { name: 'Club', formula: '1d6+2', total: 10, rolls: expect.any(Array), modifier: 0, context: expect.anything() }
    );
  });
});

describe('MonsterCardModal - combat-context fallback', () => {
  beforeEach(resetMocks);

  it('fetches getCombatContext only when the creatures prop is absent', () => {
    const { unmount } = render(<MonsterCardModal {...makeProps(makeMonster(), { creatures: undefined })} />);
    expect(damageUtils.getCombatContext).toHaveBeenCalledWith('test-campaign');

    unmount();
    render(<MonsterCardModal {...makeProps(makeMonster(), { creatures: [] })} />);
    // creatures provided → the `if (creatures) return;` guard (MonsterCardModal.jsx:2124) skips the fetch.
    expect(damageUtils.getCombatContext).toHaveBeenCalledTimes(1);
  });
});
