// @maintained-by-ai
// MA-1802/MA-1803: Young Silver Dragon lair lane — ADVISORY twins at the modal seam.
// [0] was a BARE STRING, [1] a nameless dict (both inert static spans, zero
// affordance — MonsterCardBody.jsx:385 string short-circuit / isLairRowClickable).
// DATA fix promotes BOTH to the byte-proven adult-silver MA-0140 ADVISORY dicts
// {name, advisory:"fog_cloud", description} — two named chips, both clicking
// through the CLA-325 advisory record: ability_use "casts fog cloud" log +
// initiative-20 GM-enforced popup — NO picker, NO save, NO damage, NO zone te.
// Silver fog carries NO zone block: bronze MA-1766's zoneOnly picker lane is NOT
// a lane twin here (different affordance branch in resolveLairRow) — the two
// chips duplicate advisory key "fog_cloud" (OK: consumer keys by action.name,
// MA-1779) and press as TWO distinct abilityName records.
// OWNERS cited-skipped: disk byte-locks → monsterLairActions.test.js:6545
// (MA-1802) / :6625 (MA-1803) incl. scope guard :6607; generic lair chip
// render + title format + advisory press machine + cannot-act gate →
// lair-actions.test.jsx:114/:140/:176; popup/log builder bytes →
// monsterLairActions.test.js (buildLairAdvisory*). This file pins only the
// SILVER modal seam: named-chip census and the per-chip click contract.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay young-silver-fog-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 0, rolls: [], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null, setPopupHtml: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  ROLLERS.setPopupHtml = _setPopupHtml;
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
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Bandit 1', creatures: [] })),
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

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Young Silver Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 168, maxHp: 168, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 733, maxHp: 733, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-silver-dragon');
  const m = makeMonster({ name: 'Young Silver Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young Silver Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

function lairRows() {
  const title = Array.from(document.querySelectorAll('h5.mc-section-title')).find(h => h.textContent.includes('Lair Actions'));
  return Array.from(title.nextElementSibling.querySelectorAll('.mc-action'));
}

// Per-chip byte table: both rows share advisory "fog_cloud" and byte-identical
// disk prose — only the NAME differs. Each press must land exactly ONE
// ability_use record + ONE advisory popup naming THIS chip, never a picker,
// save roll, or runtime-store write (advisory lane touches no state).
const FOG_CHIPS = [
  { i: 0, name: 'Fog Cloud' },
  { i: 1, name: 'Rolling Fog' },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-1802/MA-1803 young-silver-dragon fog advisory lair lane lock', () => {
  it('lair block renders TWO named advisory rows/chips "Fog Cloud" + "Rolling Fog" — exact chrome titles, zero static prose rows, zero DC text', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips.map(c => c.textContent.trim())).toEqual(['Fog Cloud', 'Rolling Fog']);
    expect(chips.map(c => c.getAttribute('title'))).toEqual([
      'Lair action — Fog Cloud. Chosen on initiative 20, GM-enforced.',
      'Lair action — Rolling Fog. Chosen on initiative 20, GM-enforced.',
    ]);
    chips.forEach(chip => {
      expect(chip.getAttribute('role')).toBe('button');
      expect(chip.getAttribute('tabindex')).toBe('0');
      expect(chip.textContent).not.toMatch(/DC/);
    });
    const rows = lairRows();
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.querySelector('strong')?.textContent)).toEqual(['Fog Cloud.', 'Rolling Fog.']);
    expect(rows.map(r => r.querySelectorAll('.mc-dice-link-lair').length)).toEqual([1, 1]);
    expect(rows.filter(r => !r.querySelector('.mc-dice-link-lair'))).toHaveLength(0);
  });

  it('BOTH chips press as CLA-325 advisory records: one ability_use "casts fog cloud" log + GM-enforced popup per press, NO picker/save/damage/store write', async () => {
    renderDragon();
    for (const { i, name } of FOG_CHIPS) {
      aoeProps.current = null;
      const logsBefore = addEntry.mock.calls.length;
      const popupsBefore = ROLLERS.setPopupHtml.mock.calls.length;
      fireEvent.click(lairChips()[i]);
      await waitFor(() => expect(addEntry.mock.calls.length, `chip ${i} logged nothing`).toBe(logsBefore + 1));
      const entry = addEntry.mock.calls[logsBefore][1];
      expect(entry.type).toBe('ability_use');
      expect(entry.characterName).toBe('Young Silver Dragon 1');
      expect(entry.abilityName, `chip ${i} abilityName`).toBe(name);
      expect(entry.description).toMatch(new RegExp(`lair action ${name}`));
      expect(entry.description).toMatch(/casts fog cloud/i);
      expect(entry.description).toMatch(/initiative 20 \(GM-enforced/i);
      expect(entry.description).not.toMatch(/save DC/i);
      expect(ROLLERS.setPopupHtml.mock.calls.length, `chip ${i} popup`).toBe(popupsBefore + 1);
      const html = String(ROLLERS.setPopupHtml.mock.calls[popupsBefore][0]);
      expect(html).toMatch(new RegExp(`Lair Action — ${name}`));
      expect(html).toMatch(/casts fog cloud/i);
      expect(html).toMatch(/initiative 20/i);
      expect(aoeProps.current, `chip ${i} opened a picker`).toBeNull();
      expect(runtime.store, `chip ${i} wrote runtime state`).toEqual({});
    }
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(0);
  });
});
