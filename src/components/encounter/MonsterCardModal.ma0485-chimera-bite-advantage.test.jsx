// @maintained-by-ai 2026-10-18 (MA-0485 audit/trim: 5→2 tests; advantage-face press + data lock;
// generic MA-0007 seam faces — ctx forward :190-206, grant/crit, decline :235, guards — stay owned by MonsterCardModal.charge-bonus.test.jsx)
// MA-0485: Chimera Bite advantage-damage variant — conditional_damage authored on
// monsters.json actions[1] (MA-0007 seam) so the HIT popup offers the
// "or 18 (4d6 + 4) Piercing if Advantage" variant. Locks the authored row bytes
// (dice/modifier/damage_type/advantage condition, single Bite row) and presses the
// advantage face once end-to-end through the REAL builder + resolveChargeBonus:
// offer shape + popup label transport, grant rolls 4d6 + 4 as its own damage roll,
// logs the clause, marks resolved, keeps base autoDamage.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((formula) => ({ total: 17, rolls: [4, 4, 3, 2, 4], modifier: 4, formula })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: 30, rolls: [4, 4, 3, 2, 4, 4, 4, 3, 2, 4], modifier: 4, formula })),
  rollD20: vi.fn(() => 14),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn().mockResolvedValue();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = typeof val === 'function' ? val(_popupHtml) : val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _setPopupHtml,
    __getPopupHtml: () => _popupHtml,
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

// Stub the popup (offer gating on misses is owned by
// char-sheet/DiceRollResult.charge-bonus.test.jsx) so the modal's
// resolveChargeBonus handler is driven directly through its real wiring.
vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: (props) => {
    const offer = props.popupHtml?.chargeBonusOffer;
    return (
      <div data-testid="popup-stub">
        {offer && <span>{offer.label}</span>}
        <button onClick={() => props.onChargeBonus?.()}>charge-grant</button>
        <button onClick={() => props.onChargeBonusDecline?.()}>charge-decline</button>
      </div>
    );
  },
}));

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildChargeBonusOffer } from './MonsterCardHelpers.js';

const { _rollDamage, _setPopupHtml } = useLoggedDiceRoll;

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CHIMERA = monsters.find((m) => m.index === 'chimera');

function findLogEntry(type) {
  return addEntry.mock.calls.map((c) => c[1]).find((e) => e && e.automationType === type);
}

beforeEach(() => {
  vi.clearAllMocks();
  _setPopupHtml(null);
});

describe('MA-0485 Chimera Bite conditional_damage (advantage 4d6 + 4 variant)', () => {
  it('authors conditional_damage on the single Chimera Bite row — advantage clause, 4d6 + 4 Piercing over base 2d6 + 4', () => {
    const bites = CHIMERA.actions.filter((a) => a.name === 'Bite');
    expect(bites).toHaveLength(1);
    const BITE = bites[0];
    expect(BITE.attack_bonus).toBe(7);
    expect(BITE.damage_dice_primary).toBe('2d6 + 4');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.conditional_damage).toEqual({
      dice: '4d6',
      modifier: 4,
      damage_type: 'Piercing',
      condition: 'advantage on the attack roll',
    });
  });

  it('presses the advantage face via the real MA-0007 seam: offer + popup label, grant rolls 4d6 + 4 as its own damage roll and logs the clause', async () => {
    // Real builder over the REAL authored row (Helpers:687) — locks the
    // static-condition label chrome face (MA-1363: no feet token here).
    const BITE = CHIMERA.actions.find((a) => a.name === 'Bite');
    const offer = buildChargeBonusOffer(BITE, 'Bite');
    expect(offer).toMatchObject({
      dice: '4d6',
      modifier: 4,
      damageType: 'Piercing',
      formula: '4d6 + 4',
      attackName: 'Bite',
      label: 'Advantage on the attack roll: +4d6+4 Piercing?',
    });

    _setPopupHtml({
      type: 'd20',
      rollType: 'attack',
      name: 'Bite',
      rolls: [14],
      bonus: 7,
      targetName: 'Bandit 1',
      targetAc: 12,
      hit: true,
      autoDamage: { name: 'Bite', formula: '2d6 + 4', damageType: 'Piercing', source: 'Chimera 1' },
      chargeBonusOffer: offer,
    });
    const m = makeMonster({ name: 'Chimera', actions: CHIMERA.actions });
    damageUtils.__setFindCreatureReturn({ name: 'Chimera 1', targetName: 'Bandit 1', conditions: [] });
    render(<MonsterCardModal {...makeProps(m, { creatures: [
      { name: 'Chimera 1', targetName: 'Bandit 1' },
      { name: 'Bandit 1', type: 'player' },
    ], creatureName: 'Chimera 1' })} />);
    expect(document.querySelector('[data-testid="popup-stub"]').textContent).toContain('Advantage on the attack roll: +4d6+4 Piercing?');

    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'charge-grant'));
    await vi.waitFor(() => {
      expect(_rollDamage).toHaveBeenCalled();
    });
    expect(rollExpression).toHaveBeenCalledWith('4d6 + 4');
    expect(rollExpressionDoubled).not.toHaveBeenCalled();
    const call = _rollDamage.mock.calls[0][0];
    expect(call.name).toBe('Bite — Charge Bonus');
    expect(call.formula).toBe('4d6 + 4');
    expect(call.context).toMatchObject({ damageType: 'Piercing', targetName: 'Bandit 1', attackerName: 'Chimera 1' });
    const grant = findLogEntry('conditional_damage_granted');
    expect(grant.description).toContain('+17 Piercing (4d6 + 4)');
    expect(grant.description).toMatch(/advantage on the attack roll/i);
    await vi.waitFor(() => {
      const resolved = useLoggedDiceRoll.__getPopupHtml();
      expect(resolved.chargeBonusResolved).toBe('granted');
      expect(resolved.autoDamage).toBeTruthy();
    });
  });
});
