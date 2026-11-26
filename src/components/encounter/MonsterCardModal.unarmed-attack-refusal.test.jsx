// @maintained-by-ai 2026-11-16
// TA-1116 (2026-11-16): an attack chip pressed on a monster card with NO armed
// target used to roll real dice, log a dangling `roll attack` row missing
// targetName/hit, and pop a verdict-less panel (isAutoMiss:false). The press
// now refuses LOUD through the MA-0049 no-target popup lane (the same string-
// popup lane the sheet cannotAct gate went through in 1326072e1) with ZERO
// roll dispatch, ZERO campaign-log rows and ZERO runtime writes. An armed
// press must stay byte-identical: one rollAttack dispatch carrying the armed
// targetName/attackerName and no refusal popup.
// Harness mirrors MonsterCardModal.ma1569-swarm-of-stirges-proboscises.test.jsx
// (same mock family; the useLoggedDiceRoll stub exposes _rollAttack/_setPopupHtml).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: _rollAttack,
      rollDamage: _rollDamage,
    })),
    _rollAttack,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0 })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;
  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn(() => _findCreatureReturn),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(),
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const { _rollAttack: rollAttack, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SCIMITAR = monsters.find((m) => m.index === 'goblin').actions.find((a) => a.name === 'Scimitar');

const CREATURES = [
  { name: 'Goblin 1', targetName: 'Bandit 1' },
  { name: 'Bandit 1', type: 'player', size: 'Medium' },
];

// armed=false ⇒ the attacker's initiative row carries NO targetName — the
// card's armed lane (getTarget → findCreatureByName) resolves null.
function renderGoblin({ armed }) {
  const m = makeMonster({ name: 'Goblin', actions: monsters.find((mo) => mo.index === 'goblin').actions });
  damageUtils.__setFindCreatureReturn(armed
    ? { name: 'Goblin 1', targetName: 'Bandit 1', conditions: [] }
    : { name: 'Goblin 1', conditions: [] });
  return render(<MonsterCardModal {...makeProps(m, { creatures: CREATURES, creatureName: 'Goblin 1' })} />);
}

function pressScimitarChip() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find((a) => /^Scimitar/.test(a.textContent.trim()));
  const chip = Array.from(row.querySelectorAll('.mc-dice-link')).find((el) => el.textContent.trim() === '+4');
  expect(chip, 'Expected Scimitar +4 dice link').toBeTruthy();
  fireEvent.click(chip);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the stub's popup state, then drop the reset call itself so press
  // assertions count ONLY the handler's setPopupHtml dispatches.
  _setPopupHtml(null);
  _setPopupHtml.mockClear();
});

describe('TA-1116 unarmed monster-card attack chip refuses loudly', () => {
  it('unarmed press → MA-0049-lane refusal popup, zero roll dispatch, zero log rows, zero runtime writes', () => {
    renderGoblin({ armed: false });
    pressScimitarChip();

    // Loud refusal in the shared popup lane (string → Popup [data-testid=popup-overlay] + Done).
    expect(_setPopupHtml).toHaveBeenCalledTimes(1);
    const html = _setPopupHtml.mock.calls[0][0];
    expect(typeof html).toBe('string');
    expect(html).toContain('mc-no-target-refusal');
    expect(html).toContain('Goblin 1 cannot use Scimitar');
    // 2026-11-16 modal-arm improve: the refusal now names the modal header's own
    // Target select first (the full attack flow completes inside the modal).
    expect(html).toContain('Arm a target with the Target select at the top of this card');
    expect(html).toContain('No attack rolled, nothing spent.');
    // Attack-lane copy: the save-lane AoE parenthetical never rides an attack chip.
    expect(html).not.toContain('AoE rows');

    // Zero dice, zero ledger rows, zero game-state writes.
    expect(rollAttack).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('armed press → unchanged: one rollAttack dispatch carrying targetName/attackerName, no refusal popup', () => {
    renderGoblin({ armed: true });
    pressScimitarChip();

    expect(rollAttack).toHaveBeenCalledTimes(1);
    expect(rollAttack.mock.calls[0][0]).toBe('Scimitar');
    expect(rollAttack.mock.calls[0][1]).toBe(SCIMITAR.attack_bonus);
    const ctx = rollAttack.mock.calls[0][2];
    expect(ctx.targetName).toBe('Bandit 1');
    expect(ctx.attackerName).toBe('Goblin 1');
    expect(ctx.autoDamageFormula).toBe(SCIMITAR.damage_dice_primary);
    expect(_setPopupHtml).not.toHaveBeenCalled();
  });
});
