// MA-0044 regression: Adult Blue Dracolich Frightful Presence (Multiattack-named
// mechanic). Frightened application landed with MA-0017 (saveProcessing
// .applyDamagelessSaveConditions — verified live PC + NPC paths). Residuals
// fixed here in monsters.json: dc_success "none" (FP deals NO damage — the
// prompt must not claim "Half damage on successful save", MA-0030 token) and
// Bite secondary lightning structured (damage_dice_secondary 1d10, mirroring
// Adult Blue Dragon Rend).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Adult Blue Dracolich 1', creatures: [] } }));
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
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

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

const ABD = monstersData.find(m => m.name === 'Adult Blue Dracolich');
const FP = ABD.actions.find(a => a.name === 'Frightful Presence');
const BITE = ABD.actions.find(a => a.name === 'Bite');

const CREATURES = [
  { name: 'Adult Blue Dracolich 1', type: 'npc', targetName: 'TestPC', currentHp: 225, maxHp: 225, ac: 19, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 224, maxHp: 224, conditions: [] },
];

function fpSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes('DC 18 Wisdom')) || null;
}

describe('MA-0044 monsters.json data: Adult Blue Dracolich FP + Bite structured', () => {
  it('FP row: DC 18 Wisdom + frightened save_effect + dc_success none (no damage — no half-damage boilerplate)', () => {
    expect(FP.save_dc).toBe(18);
    expect(FP.save_type).toBe('Wisdom');
    expect(FP.dc_success).toBe('none');
    expect(FP.damage_dice_primary == null).toBe(true);
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
  });

  it('Bite row: secondary lightning 1d10 structured (mirrors Adult Blue Dragon Rend)', () => {
    expect(BITE.damage_dice_primary).toBe('2d10 + 7');
    expect(BITE.damage_dice_secondary).toBe('1d10');
    expect(BITE.damage_type_secondary).toBe('Lightning');
  });
});

describe('MA-0044 MonsterCardModal FP save roll context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Adult Blue Dracolich 1', creatures: CREATURES };
  });

  it('click opens WIS save at DC 18 with frightened conditions, no damage formula, dcSuccess none', async () => {
    const m = makeMonster({ ...ABD, name: 'Adult Blue Dracolich' });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Blue Dracolich 1', creatures: CREATURES })} />);
    const chip = fpSaveChip();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toLowerCase()).toBe('wis');
    expect(call[2]).toMatchObject({
      saveDc: 18,
      saveType: 'Wisdom',
      dcSuccess: 'none',
      saveConditions: ['frightened'],
      autoDamageFormula: null,
      attackerName: 'Adult Blue Dracolich 1',
      actionName: 'Frightful Presence',
    });
  });
});
