// @maintained-by-ai
// MA-0051: Adult Blue Dracolich "Detect" legendary row — authored
// ability_check {ability:"wisdom", skill:"perception"} renders a clickable
// skill-check chip ("Wisdom (Perception) +14") that spends 1 legendary use
// then rolls d20+14 through the rollSkillCheck seam with a check log.
// MA-0021 exhausted/turn-latch refusals on this same chip are owned by
// MonsterCardModal.legendary-uses.test.jsx; check-bonus-shape parsing is
// owned by monsterLegendaryUses service tests (MA-2002). Unique branch here:
// unresolvable bonus (no skills, no ability mod) refuses BEFORE the spend
// with reason 'no-check-bonus' — zero spend, zero roll.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const ROLLERS = vi.hoisted(() => ({ rollSkillCheck: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSkillCheck = vi.fn();
  ROLLERS.rollSkillCheck = rollSkillCheck;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(), rollSkillCheck, rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const DRACOLICH = monstersData.find(m => m.name === 'Adult Blue Dracolich');
const NAME = 'Adult Blue Dracolich 1';

function detectChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-check')).find(el => el.closest('div')?.textContent.includes('Detect')) || null;
}

describe('MA-0051 MonsterCardModal Detect legendary skill-check row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: [] };
  });

  it('chip "Wisdom (Perception) +14": click spends 1 use, rolls d20+14 via rollSkillCheck, logs spend', async () => {
    runtime.store[`${NAME}.monsterLegendaryUses`] = { max: 3, used: 0 };
    render(<MonsterCardModal {...makeProps(DRACOLICH, { creatureName: NAME, creatures: [{ name: NAME, type: 'npc', currentHp: 225, maxHp: 225, conditions: [] }] })} />);
    const chip = detectChip();
    expect(chip.textContent).toContain('Wisdom (Perception) +14');
    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSkillCheck).toHaveBeenCalled());
    expect(runtime.store[`${NAME}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    const call = ROLLERS.rollSkillCheck.mock.calls[0];
    expect(call[0]).toBe('Wisdom (Perception)');
    expect(call[1]).toBe(14);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Detect/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Detect/);
  });

  it('unresolvable check bonus (no skills, no ability mod): refusal BEFORE spend, zero roll', async () => {
    const m = makeMonster({
      name: 'Test Lich',
      skills: {},
      ability_score_modifiers: {},
      legendary_actions: [
        { name: 'Legendary Action Uses: 3', uses: 3, description: 'Expend a use.' },
        { name: 'Detect', ability_check: { ability: 'wisdom', skill: 'perception' }, description: 'Makes a Wisdom (Perception) check.' },
      ],
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: NAME })} />);
    fireEvent.click(detectChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('ability check');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused' && /no-check-bonus/.test(e.description))).toBe(true));
    expect(runtime.store[`${NAME}.monsterLegendaryUses`]).toBeUndefined();
    expect(ROLLERS.rollSkillCheck).not.toHaveBeenCalled();
  });
});
