// MA-0104: clicking the gated Banish legendary row on the Adult Gold Dragon
// card arms the banished_demiplane te producer + dc_success none in the save
// context handed to rollSavingThrow (clause + honest success ride to
// saveProcessing); rows without the clause arm null (byte-inert).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [5, 1, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [5, 1, 3], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollDamage: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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

const CREATURES = [
  { name: 'Adult Gold Dragon 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 243, maxHp: 243, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 100, maxHp: 100, conditions: [] },
];

const gold = () => monstersData.find(m => m.name === 'Adult Gold Dragon');
const goldActions = () => [{ name: 'Rend', attack_bonus: 14, damage_dice_primary: '2d8 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '1d8', damage_type_secondary: 'Fire', reach: '10 ft.' }];

function renderGold(uses) {
  if (uses !== undefined) runtime.store['Adult Gold Dragon 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ name: 'Adult Gold Dragon', actions: goldActions(), legendary_actions: gold().legendary_actions });
  ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Gold Dragon 1', creatures: CREATURES })} />);
}

function goldRow(name) {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
}

describe('MA-0104 MonsterCardModal Banish arms demiplane te producer in save context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('Banish click: save context carries demiplaneTransport te arm + dcSuccess none', async () => {
    renderGold({ max: 3, used: 0 });
    fireEvent.click(goldRow('Banish').querySelector('.mc-dice-link'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.demiplaneTransport).toEqual({ effect: 'banished_demiplane' });
    expect(context.dcSuccess).toBe('none');
    expect(context.saveDc).toBe(21);
    expect(context.saveConditions).toContain('incapacitated');
  });

  it('clauseless row (Rend attack via Pounce) arms nothing: demiplaneTransport absent/null on attack path', async () => {
    renderGold({ max: 3, used: 0 });
    fireEvent.click(goldRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
