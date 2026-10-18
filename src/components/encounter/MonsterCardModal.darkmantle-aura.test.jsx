// @maintained-by-ai
// MA-0554 modal seam only: the Darkmantle Darkness Aura actions[] row arms a
// ZoneAuraLink chip ("15-ft Aura (1/Day · N left)") and its click routes the
// row through resolveSelfAuraRow with monsterName + the monsterSpellUses
// store map. Exhausted chips stay clickable and still route the resolver.
// Aura math, spend, te arming and the honest exhausted refusal are owned by
// services/encounters/monsterSelfAura.test.js — not re-proved here.
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

// Mount guards for the heavy modal tree (network/log isolation).
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
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
  it('offers exactly one 15-ft Aura chip with the 1/Day counter; Crush row stays a plain +5 attack', () => {
    renderDarkmantle();
    const chip = auraChip();
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('15-ft Aura');
    expect(chip.textContent).toContain('(1/Day · 1 left)');
    expect(chip.getAttribute('title')).toMatch(/lair_darkness on self, radius 15 ft, no save/);
    const crushRow = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith('Crush.'));
    expect(crushRow.querySelector('.mc-dice-link-aura')).toBeNull();
    expect(crushRow.textContent).toContain('+5');
  });

  it.each([
    { label: 'uses remaining', stored: null, left: '1 left', spent: false },
    { label: 'exhausted 1/Day', stored: { 'Darkness Aura': 1 }, left: '0 left', spent: true },
  ])('chip click routes resolveSelfAuraRow with $label via the monsterSpellUses store', async ({ stored, left, spent }) => {
    if (stored) runtime.store['Darkmantle 1.monsterSpellUses'] = stored;
    renderDarkmantle();
    const chip = auraChip();
    expect(chip.className.includes('mc-dice-link-spell-spent')).toBe(spent);
    expect(chip.textContent).toContain(`(1/Day · ${left})`);
    fireEvent.click(chip);
    await waitFor(() => expect(auraCalls.calls.length).toBe(1));
    const args = auraCalls.calls[0];
    expect(args.monsterName).toBe('Darkmantle 1');
    expect(args.action.name).toBe('Darkness Aura');
    expect(args.action.zone.radius_ft).toBe(15);
    expect(args.storedUses).toEqual(stored || {});
    expect(typeof args.setPopupHtml).toBe('function');
  });
});
