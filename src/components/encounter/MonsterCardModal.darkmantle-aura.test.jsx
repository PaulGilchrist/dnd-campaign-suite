// MA-0554: Darkmantle Darkness Aura actions[] row — formerly inert
// zero-chip prose (uses "1/Day" invisible). Now the self-origin zone dict
// arms a ZoneAuraLink chip ("15-ft Aura (1/Day · N left)") that routes the
// row through resolveSelfAuraRow: self te lair_darkness + 1/Day spend via
// the monsterSpellUses map; exhausted rows render the spent class and the
// resolver refuses with zero te/spend. Crush and sibling rows untouched.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const auraCalls = vi.hoisted(() => ({ calls: [] }));

vi.mock('../../services/encounters/monsterSelfAura.js', async (importActual) => ({
  ...(await importActual()),
  resolveSelfAuraRow: vi.fn((args) => {
    auraCalls.calls.push(args);
    return Promise.resolve({ resolved: true, effectKey: 'lair_darkness', radiusFt: 15, remaining: 0 });
  }),
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(), rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Thug 1', creatures: [] })),
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
  { name: 'Darkmantle 1', type: 'npc', monsterType: 'aberration', targetName: 'Thug 1', currentHp: 22, maxHp: 22, ac: 11, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, ac: 11, conditions: [] },
];

function renderDarkmantle() {
  const dm = monstersData.find(m => m.name === 'Darkmantle');
  const m = makeMonster({ name: 'Darkmantle', actions: dm.actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Darkmantle 1', creatures: CREATURES })} />);
}

function auraChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-aura'))[0] || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  auraCalls.calls.length = 0;
});

describe('MA-0554 Darkmantle Darkness Aura chip', () => {
  it('actions[] row renders a 15-ft Aura chip with the 1/Day counter', () => {
    renderDarkmantle();
    const chip = auraChip();
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('15-ft Aura');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    expect(chip.getAttribute('title')).toMatch(/lair_darkness on self, radius 15 ft, no save/);
  });

  it('chip click routes the row through resolveSelfAuraRow with the monster + stored uses', async () => {
    renderDarkmantle();
    fireEvent.click(auraChip());
    await waitFor(() => expect(auraCalls.calls.length).toBe(1));
    const args = auraCalls.calls[0];
    expect(args.monsterName).toBe('Darkmantle 1');
    expect(args.action.name).toBe('Darkness Aura');
    expect(args.action.zone.radius_ft).toBe(15);
    expect(args.storedUses).toEqual({});
    expect(typeof args.setPopupHtml).toBe('function');
  });

  it('spent uses: chip renders the spent class and still routes the honest refusal', async () => {
    runtime.store['Darkmantle.monsterSpellUses'] = { 'Darkness Aura': 1 };
    runtime.store['Darkmantle 1.monsterSpellUses'] = { 'Darkness Aura': 1 };
    renderDarkmantle();
    const chip = auraChip();
    expect(chip.className).toContain('mc-dice-link-spell-spent');
    expect(chip.textContent).toContain('(1/Day · 0 left)');
    fireEvent.click(chip);
    await waitFor(() => expect(auraCalls.calls.length).toBe(1));
  });

  it('Crush attack row unaffected: +5 chip only, no aura link on it', () => {
    renderDarkmantle();
    expect(document.querySelectorAll('.mc-dice-link-aura').length).toBe(1);
    const crushRow = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith('Crush.'));
    expect(crushRow.querySelector('.mc-dice-link-aura')).toBeNull();
    expect(crushRow.textContent).toContain('+5');
  });
});
