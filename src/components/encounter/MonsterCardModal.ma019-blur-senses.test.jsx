// @maintained-by-ai — trimmed to the two MA-0019-distinct attacker-sense legs
// (Blindsight immunity vs ordinary Disadvantage fold) through the real
// computeConditionEffects→combineAttackModes seam; 7 bisect-dead service mocks
// purged (only rollAttack capture + targetEffects feed are load-bearing).
// SP-019 Blur (2024) — monster attacker lane: the target-side compute used by
// combineAttackModes must receive the ATTACKER's senses so a Blindsight/Truesight
// attacker is immune to the Blur defender-disadvantage, while an ordinary attacker
// still folds Disadvantage. Before the fix buildTargetEffectData omitted
// attackerSenses, so EVERY attacker folded Disadvantage against a Blur-warded
// target (RAW immunity violated). Uses REAL computeConditionEffects +
// combineAttackModes (blur handler conditionEffects.js:504, modal seam
// MonsterCardModal.jsx:2365) so the immunity decision is genuinely computed.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

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

// Wizard is Blur-warded (target = Wizard); attacker is the card monster.
const BLUR_WIZARD_TE = [{ target: 'Wizard', source: 'DivinationWizard', effect: 'blur', duration: 'concentration' }];

function makeBoard(attackerName) {
  return [
    { name: attackerName, targetName: 'Wizard' },
    { name: 'Wizard', type: 'player' },
  ];
}

function pressAttackChipAfterRender(attackerMonster, bonus = '+3') {
  render(
    <MonsterCardModal {...makeProps(attackerMonster, { creatures: makeBoard(attackerMonster.name) })} />,
  );
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

beforeEach(() => {
  vi.clearAllMocks();
  useRuntimeState.__setTargetEffects(BLUR_WIZARD_TE);
});

describe('SP-019 Blur — monster attacker lane honours Blindsight/Truesight immunity', () => {
  it('Flying Sword (blindsight) vs Blur-warded wizard → NO disadvantage (RAW immunity)', () => {
    const ctx = pressAttackChipAfterRender(flyingSword());
    // resolveForcedMode maps mode:"normal" → undefined — the immune/normal-roll signal.
    expect(ctx.forcedMode).toBeUndefined();
  });

  it('ordinary attacker (no blindsight/truesight) vs Blur-warded wizard → Disadvantage', () => {
    const ctx = pressAttackChipAfterRender(ordinaryBandit());
    expect(ctx.forcedMode).toBe('disadvantage');
  });
});
