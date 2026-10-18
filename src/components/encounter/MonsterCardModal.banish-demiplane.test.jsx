// @maintained-by-ai
// MA-0104 modal lane (trimmed): clicking the gated Banish legendary row on the
// Adult Gold Dragon card arms the banished_demiplane te producer + dc_success
// 'none' in the save context handed to rollSavingThrow (click->ctx identity
// bytes; args verified at MonsterCardModal.jsx:446-447 rollSavingThrow(abbr,
// mod, buildAbilitySaveRollContext(...)) — context rides arg [2]).
// save_dc/dc_success e2e lock cited by MonsterCardHelpers.banish-transport.test.js:4-5.
// Owners elsewhere (dropped legs): parse truth-table + both-direction MA-0104
// discrimination (clauseless save_effect -> null) -> banish-transport.test.js:19 +
// soul-tome-trap.test.js (#563); attack-seam routing incl. rollSavingThrow-not-
// called + rollAttack options arg[2] -> scorching-ray.test.jsx:222-233 and the
// Pounce delegate-chip lane legendary-uses.test.jsx:178-187/:277-286 + #573/#571.
// (buildSaveOptions carries NO demiplaneTransport byte — MonsterCardModal.jsx:1324-1352 —
// so a clauseless-row byte-inert leg was un-assertable on the attack path here.)
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
    const chip = goldRow('Banish').querySelector('.mc-dice-link');
    expect(chip.textContent).toMatch(/3d6/);
    expect(goldRow('Banish').querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 21 Charisma/);
    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const [abbr, mod, context] = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(typeof abbr).toBe('string');
    expect(abbr).toBe('CHA');
    expect(typeof mod).toBe('number');
    expect(context.targetName).toBe('ElderPaladin');
    expect(context.attackerName).toBe('Adult Gold Dragon 1');
    expect(context.actionName).toBe('Banish');
    expect(context.demiplaneTransport).toEqual({ effect: 'banished_demiplane' });
    expect(context.dcSuccess).toBe('none');
    expect(context.saveDc).toBe(21);
    expect(context.saveConditions).toContain('incapacitated');
  });
});
