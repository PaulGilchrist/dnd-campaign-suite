// @maintained-by-ai
// MA-1807/MA-1808/MA-1809 modal-seam lane: young-white-dragon lair_actions [0]
// was a BARE STRING and [1]/[2] nameless dicts (inert static spans —
// MonsterCardBody.jsx MonsterLairAction string/nameless disjuncts, isLairRowClickable
// never reached). DATA fixes promote them to three named clickable rows:
// "Freezing Fog" + "Glacial Fog" (adult-white MA-0149 byte-shape save dicts:
// DC 10 Constitution, 3d6 Cold, dcSuccess "half", DISTINCT names) and
// "Jagged Ice Shards" (adult-white attack byte-twin: attack_bonus 7).
// LANE, adjudicated from disk bytes: both fog dicts carry save_dc with NO
// advisory key and NO zone block → lairRowAffordance 'save' → handleSaveRoll →
// executeBlockSaveRoll's aoe!=null branch opens SaveAttackAoeModal as a FULL
// save picker (radius 20 from the "20-foot-radius sphere" prose). NOT the
// silver MA-1802 advisory record lane, NOT the bronze MA-1766 zoneOnly picker
// lane — lane-silence for both untaken branches pinned in the press test:
// zoneOnly strictly false (picker render coerces), setPopupHtml never called,
// zero logs and zero save rolls while the picker sits unresolved.
// Cited owners, NOT re-pinned here: disk byte locks → monsterLairActions.test.js
// :6698 (MA-1807 [0]) / :6791 (MA-1808 [1]) + scope guards :1675/:1770/:3646
// (MA-1809 [2] attack twin); generic lair chip render + title format +
// block-save seam + advisory press machine + cannot-act gate →
// MonsterCardModal.lair-actions.test.jsx:114/:140/:148/:176; picker-internal
// target resolution stays SaveAttackAoeModal's own owner. This file pins only
// the WHITE modal seam: named-chip census vs real disk + per-fog-press
// picker-arm contract with white-distinct bytes (DC 10, 3d6 Cold, half, 20-ft).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const pickerProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    pickerProps.current = props;
    return <div className="sp-overlay young-white-fog-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
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
  getTargetFromAttacker: vi.fn(() => ({ name: 'Bandit 1', type: 'npc' })),
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
  { name: 'Young White Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'Bandit 1', currentHp: 123, maxHp: 123, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'young-white-dragon');
  const m = makeMonster({ name: 'Young White Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Young White Dragon 1', creatures: CREATURES })} />);
}

function lairChips() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

function lairRows() {
  const title = Array.from(document.querySelectorAll('h5.mc-section-title')).find(h => h.textContent.includes('Lair Actions'));
  return Array.from(title.nextElementSibling.querySelectorAll('.mc-action'));
}

// Byte table: both fog rows share DC 10 Constitution / 3d6 Cold / half / 20-ft
// Radius and byte-identical disk prose — only the NAME differs. Each press must
// arm the picker exactly ONCE with the full save contract and stay silent:
// no save rolled before resolution, no advisory popup (silver lane untaken),
// zoneOnly strictly false + zoneTe null (bronze lane untaken), zero logs.
// Nulling pickerProps.current first proves THIS press armed it, not a stale render.
const FOG_CHIPS = [
  { i: 0, name: 'Freezing Fog' },
  { i: 1, name: 'Glacial Fog' },
];

async function clickFogChip({ i, name }) {
  pickerProps.current = null;
  const logsBefore = addEntry.mock.calls.length;
  fireEvent.click(lairChips()[i]);
  await waitFor(() => expect(pickerProps.current, `chip ${i} (${name}) did not open the picker`).toBeTruthy());
  const p = pickerProps.current;
  expect(p.saveType, `chip ${i} (${name}) saveType`).toBe('Constitution');
  expect(p.saveDc, `chip ${i} (${name}) saveDc`).toBe(10);
  expect(p.damage, `chip ${i} (${name}) damage`).toBe('3d6');
  expect(p.damageType, `chip ${i} (${name}) damageType`).toBe('Cold');
  expect(p.dcSuccess, `chip ${i} (${name}) dcSuccess`).toBe('half');
  expect(p.saveConditions, `chip ${i} (${name}) saveConditions`).toEqual([]);
  expect(p.range, `chip ${i} (${name}) range`).toBe(20);
  expect(p.titleOverride, `chip ${i} (${name}) titleOverride`).toBe('20-ft Radius (GM positions tokens; selection advisory)');
  expect(p.rangeGateFt, `chip ${i} (${name}) rangeGateFt`).toBeNull();
  expect(p.zoneOnly, `chip ${i} (${name}) zoneOnly`).toBe(false);
  expect(p.zoneTe ?? null, `chip ${i} (${name}) zoneTe`).toBeNull();
  expect(p.excludeNames, `chip ${i} (${name}) excludeNames`).toEqual(['Young White Dragon 1']);
  expect(p.storeLastAttack, `chip ${i} (${name}) storeLastAttack`).toBe(false);
  expect(addEntry.mock.calls.length, `chip ${i} (${name}) logged at picker-open`).toBe(logsBefore);
  expect(ROLLERS.setPopupHtml, `chip ${i} (${name}) fired an advisory popup`).not.toHaveBeenCalled();
  expect(ROLLERS.rollSavingThrow, `chip ${i} (${name}) rolled before the picker resolved`).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  pickerProps.current = null;
});

describe('MA-1807/MA-1808/MA-1809 young-white-dragon fog + shards lair chip lock', () => {
  it('lair block renders EXACTLY THREE clickable rows/chips — save twins "Freezing Fog."/"Glacial Fog." (DC 10 Constitution) + attack "Jagged Ice Shards."; zero static prose rows', () => {
    renderDragon();
    const chips = lairChips();
    expect(chips.map(c => c.textContent.trim())).toEqual(['DC 10 Constitution', 'DC 10 Constitution', 'Jagged Ice Shards']);
    expect(chips.map(c => c.getAttribute('title'))).toEqual([
      'Lair action — DC 10 Constitution. Chosen on initiative 20, GM-enforced.',
      'Lair action — DC 10 Constitution. Chosen on initiative 20, GM-enforced.',
      'Lair action — Jagged Ice Shards. Chosen on initiative 20, GM-enforced.',
    ]);
    const rows = lairRows();
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.querySelector('strong')?.textContent)).toEqual(['Freezing Fog.', 'Glacial Fog.', 'Jagged Ice Shards.']);
    expect(rows.map(r => r.querySelectorAll('.mc-dice-link-lair').length)).toEqual([1, 1, 1]);
  });

  it('BOTH fog chips press arm the full save picker — DC 10 Constitution 3d6 Cold half 20-ft Radius, self-excluded — with advisory/zone lanes silent and zero save rolled at press', async () => {
    renderDragon();
    for (const chip of FOG_CHIPS) await clickFogChip(chip);
  });
});
