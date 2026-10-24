// MA-0020 modal-lane owner: Aboleth "Dominate Mind (2/Day)" save-row gate as
// rendered/clicked in MonsterCardModal. Rides the REAL monsters.json row (data
// pin via literal assertions). Distinct seams, one render per state:
//   fresh → chip bytes '(2/Day · 2 left)' + click arms save with monsterAbilityUse
//           spend marker + until-clause durationNote (ungated rows: no counter, no marker)
//   partial → live '(2/Day · 1 left)', still arms
//   exhausted → refusal popup + dominate_mind_refused log, zero prompts, spent class.
// Cite-skip owners: gate arithmetic services/encounters/monsterAbilityUses.test.js:105-127
// (truth-table; ranges refreshed fix#363 #1082); refusal wording #829 block :129-145;
// spend-at-confirm cycle :146-204 and consumer
// saveProcessing.failed-save-conditions.test.js; usage-string format
// MonsterCardHelpers.usage.test.js (#571); generic gated reactions
// MonsterAction.gated-reaction.test.jsx. No At Will save rows exist in this lane,
// so the MonsterCardHelpers.js:3022-3027 '999/Day' cosmetic sentinel never surfaces here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

// Real authored row — renamed/removed aboleth action fails these tests loudly.
const DOMINATE_MIND = monstersData.find(m => m.index === 'aboleth').actions.find(a => a.name === 'Dominate Mind (2/Day)');
const MIND_ROT = { name: 'Mind Rot', save_dc: 15, save_type: 'Intelligence', save_effect: 'Failure: Stunned' };

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
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

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Aboleth 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: 185, maxHp: 185, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function renderAboleth(uses) {
  if (uses !== undefined) runtime.store['Aboleth 1.monsterSpellUses'] = uses;
  const m = makeMonster({ name: 'Aboleth', actions: [DOMINATE_MIND, MIND_ROT] });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function saveLink(name) {
  return Array.from(document.querySelectorAll('.mc-dice-link-save-clickable')).find(el => el.closest('div')?.textContent.includes(name)) || null;
}

describe('MA-0020 MonsterCardModal Dominate Mind uses gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('fresh row renders (2/Day · 2 left) and click arms DC 16 Wisdom charmed save with spend marker + until-clause note; ungated rows carry no counter/marker', () => {
    renderAboleth();
    const link = saveLink('Dominate Mind');
    expect(link).toBeTruthy();
    expect(link.textContent).toMatch(/\(2\/Day · 2 left\)/);
    expect(link.className).not.toContain('mc-dice-link-spell-spent');

    fireEvent.click(link);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(16);
    expect(ctx.saveType).toBe('Wisdom');
    expect(ctx.saveConditions).toEqual(['charmed']);
    expect(ctx.monsterAbilityUse).toEqual({ useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' });
    expect(ctx.conditionDurationNote).toMatch(/^until the aboleth dies .* \(GM-enforced\)$/);

    // Ungated save row: no uses authored → no counter bytes, no spend marker, still arms.
    const rot = saveLink('Mind Rot');
    expect(rot.textContent).not.toMatch(/\(.*\/Day/);
    fireEvent.click(rot);
    expect(rollSavingThrow).toHaveBeenCalledTimes(2);
    expect(rollSavingThrow.mock.calls[1][2].monsterAbilityUse).toBeUndefined();
  });

  it('one use spent: live counter shows 1 left, click still arms the save', () => {
    renderAboleth({ 'Dominate Mind': 1 });
    const link = saveLink('Dominate Mind');
    expect(link.textContent).toMatch(/\(2\/Day · 1 left\)/);
    expect(link.className).not.toContain('mc-dice-link-spell-spent');
    fireEvent.click(link);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
  });

  it('exhausted (2/2): popup + dominate_mind_refused log, zero save prompts, counter 0 left + spent class', () => {
    renderAboleth({ 'Dominate Mind': 2 });
    const link = saveLink('Dominate Mind');
    expect(link.textContent).toMatch(/\(2\/Day · 0 left\)/);
    expect(link.className).toContain('mc-dice-link-spell-spent');

    fireEvent.click(link);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Uses Exhausted');
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'dominate_mind_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.characterName).toBe('Aboleth 1');
    expect(refusal.description).toMatch(/already used Dominate Mind today \(2\/Day\)/);
  });
});

// @maintained-by-ai
