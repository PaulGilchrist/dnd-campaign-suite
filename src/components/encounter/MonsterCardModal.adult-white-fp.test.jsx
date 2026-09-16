// MA-0147 regression: Adult White Dragon Frightful Presence (legendary_actions[2])
// previously authored only name/description/save_dc/save_type — no save_effect —
// so extractConditionsFromSaveEffect → [] and the MA-0017 damageless-save seam
// applied NOTHING on a failed save (no activeConditions, no te, no condition log).
// Data fix mirrors the verified MA-0048 Adult Blue Dracolich FP row:
// save_effect (frightened) + dc_success:"none" + success_immunity + repeat_save.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import { extractConditionsFromSaveEffect, parseSuccessImmunity, gazeImmunityActive } from './MonsterCardHelpers.js';
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
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'TestPC', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
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

const AWD = monstersData.find(m => m.name === 'Adult White Dragon');
const FP = AWD.legendary_actions.find(a => a.name === 'Frightful Presence');

const CREATURES = [
  { name: 'Adult White Dragon 1', type: 'npc', targetName: 'TestPC', currentHp: 200, maxHp: 200, ac: 18, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 143, maxHp: 143, conditions: [] },
];

function fpSaveChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.textContent.includes('DC 14 Charisma')) || null;
}

describe('MA-0147 monsters.json data: Adult White Dragon FP row full-service shape', () => {
  it('FP row: DC 14 Charisma untouched + frightened save_effect + dc_success none', () => {
    expect(FP.save_dc).toBe(14);
    expect(FP.save_type).toBe('Charisma');
    expect(FP.dc_success).toBe('none');
    expect(FP.damage_dice_primary == null).toBe(true);
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
  });

  it('FP row engages the MA-0048 service: repeat_save + success_immunity object shape (byte-mirrors Adult Blue Dracolich FP)', () => {
    const dracolich = monstersData.find(m => m.name === 'Adult Blue Dracolich');
    const DFP = dracolich.actions.find(a => a.name === 'Frightful Presence');
    expect(FP.repeat_save).toEqual({ condition: 'frightened', save_type: 'Charisma', duration_minutes: 1 });
    expect(FP.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
    expect(Object.keys(FP)).toEqual(Object.keys(DFP));
    const immunity = parseSuccessImmunity(FP);
    expect(immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', durationMinutes: 1440 });
  });

  it('FP row description carries canonical 120-ft range + turn-end-repeat + 24h-immunity wording', () => {
    expect(FP.description).toContain('within 120 feet');
    expect(FP.description).toContain('repeat the saving throw at the end of each of its turns');
    expect(FP.description).toContain('immune to the dragon\'s Frightful Presence for the next 24 hours');
  });

  it('immunity te on target refuses the FP row click (MA-0030/MA-0048 gate)', () => {
    const target = { name: 'TestPC', type: 'player' };
    const active = gazeImmunityActive({
      action: FP, target, monsterName: 'Adult White Dragon 1',
      targetEffects: [{ target: 'TestPC', effect: 'frightful_presence_immunity', source: 'Adult White Dragon 1' }],
    });
    expect(active).toMatchObject({ effect: 'frightful_presence_immunity', durationMinutes: 1440 });
    const none = gazeImmunityActive({ action: FP, target, monsterName: 'Adult White Dragon 1', targetEffects: [] });
    expect(none).toBeNull();
  });
});

describe('MA-0147 MonsterCardModal FP save roll context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'TestPC', creatures: CREATURES };
    runtime.store['Adult White Dragon 1.monsterLegendaryUses'] = { max: 3, used: 0 };
  });

  it('legendary FP click opens CHARISMA save at DC 14 with frightened conditions, dcSuccess none, repeatSave + successImmunity forwarded', async () => {
    const m = makeMonster({ ...AWD, name: 'Adult White Dragon' });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult White Dragon 1', creatures: CREATURES })} />);
    const chip = fpSaveChip();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(String(call[0]).toLowerCase()).toBe('cha');
    expect(call[2]).toMatchObject({
      saveDc: 14,
      saveType: 'Charisma',
      dcSuccess: 'none',
      saveConditions: ['frightened'],
      autoDamageFormula: null,
      attackerName: 'Adult White Dragon 1',
      actionName: 'Frightful Presence',
      repeatSave: { condition: 'frightened', save_type: 'Charisma', duration_minutes: 1 },
      successImmunity: { effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 },
    });
  });
});
