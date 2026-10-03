// @improved-by-ai
// SP-019 Blur (2024) — monster attacker lane: the target-side compute used by
// combineAttackModes must receive the ATTACKER's senses so a Blindsight/Truesight
// attacker is immune to the Blur defender-disadvantage, while an ordinary attacker
// still folds Disadvantage. Before the fix buildTargetEffectData omitted
// attackerSenses, so EVERY attacker folded Disadvantage against a Blur-warded
// target (RAW immunity violated). Uses REAL computeConditionEffects +
// combineAttackModes (importActual) so the immunity decision is genuinely computed.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [5, 5], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => String(html || '')),
}));

// REAL condition-effects + combine — the immunity is computed for real.
vi.mock('../../services/combat/conditions/conditionEffects.js', async (importActual) => ({
  ...(await importActual()),
}));

// REAL damageUtils — findCreatureByName / getTargetFromAttacker resolve naturally.
vi.mock('../../services/rules/combat/damageUtils.js', async (importActual) => ({
  ...(await importActual()),
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _targetEffects = [];
  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    return null;
  });
  const mockGetRuntimeValue = vi.fn(() => null);
  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    __setTargetEffects(val) { _targetEffects = val; },
  };
});

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

const rollAttack = useLoggedDiceRoll._rollAttack;

// ── Rigs ─────────────────────────────────────────────────────────────────────

// Wizard is Blur-warded (target = wizard); attacker is the card monster.
const BLUR_WIZARD_TE = [{ target: 'Wizard', source: 'DivinationWizard', effect: 'blur', duration: 'concentration' }];

function makeBoard(attackerName) {
  return [
    { name: attackerName, targetName: 'Wizard' },
    { name: 'Wizard', type: 'player' },
  ];
}

function renderAttacker(attackerMonster) {
  return render(
    <MonsterCardModal {...makeProps(attackerMonster, { creatures: makeBoard(attackerMonster.name) })} />,
  );
}

function pressAttackChip(bonus = '+3') {
  const links = Array.from(document.querySelectorAll('.mc-dice-link'));
  const chip = links.find((el) => el.textContent.trim() === bonus);
  expect(chip, `expected attack chip "${bonus}"`).toBeTruthy();
  fireEvent.click(chip);
  expect(rollAttack).toHaveBeenCalled();
  return rollAttack.mock.calls[0][2];
}

function flyingSword() {
  return makeMonster({
    name: 'Flying Sword',
    senses: { blindsight: '60 ft. (blind beyond this radius)', passive_perception: 7 },
    actions: [{ name: 'Longsword', attack_bonus: 3, reach: '5 ft.', damage_dice_primary: '1d8', damage_type_primary: 'Slashing', description: 'Melee Weapon Attack.' }],
  });
}

function ordinaryBandit() {
  return makeMonster({
    name: 'Bandit',
    senses: null,
    actions: [{ name: 'Scimitar', attack_bonus: 3, reach: '5 ft.', damage_dice_primary: '1d6', damage_type_primary: 'Slashing', description: 'Melee Weapon Attack.' }],
  });
}

function pressAttackChipAfterRender(monster, bonus) {
  renderAttacker(monster);
  return pressAttackChip(bonus);
}

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.__setTargetEffects(BLUR_WIZARD_TE);
});

describe('SP-019 Blur — monster attacker lane honours Blindsight/Truesight immunity', () => {
  it('Flying Sword (blindsight) vs Blur-warded wizard → NO disadvantage (RAW immunity)', () => {
    const ctx = pressAttackChipAfterRender(flyingSword(), '+3');
    // resolveForcedMode maps mode:"normal" → undefined — the immune/normal-roll signal.
    expect(ctx.forcedMode).toBeUndefined();
    expect(ctx.forcedMode).not.toBe('disadvantage');
  });

  it('ordinary attacker (no blindsight/truesight) vs Blur-warded wizard → Disadvantage', () => {
    const ctx = pressAttackChipAfterRender(ordinaryBandit(), '+3');
    expect(ctx.forcedMode).toBe('disadvantage');
  });
});
