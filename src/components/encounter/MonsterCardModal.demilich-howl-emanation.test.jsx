// @maintained-by-ai
// MA-0590 / MA-0603: authored "N-foot Emanation" RANGE rows (Demilich "Howl"
// DC 19 CON 20d6 Psychic; Dire Worg "Dreadful Howl" DC 16 WIS 8d8 Psychic —
// both Recharge 5-6) route the click through the same SaveAttackAoeModal area
// picker as the MA-0031 cones / MA-0084 spheres — labelled "30-ft Radius",
// attacker-origin coverage gate (rangeGateFt = the authored feet, gridless
// lenient §42) — never the former single-target block-save degrade that left a
// second adjacent victim with zero save / zero damage / zero log. The MA-0590
// DATA edit (save_effect byte-carries the MA-0303 "Failure or Success:"
// marker) arms the picker success-leg Frightened grant threaded onto the props;
// MA-0603's fail-only tail stays un-armed (saveConditions-only).
//
// Owned elsewhere, not re-pinned here: breathAoeShape emanation/prose/DC0
// parsing units (MA-1436 save-variant-shape, MA-1058 kraken-toxic-ink,
// MA-0610 whirlwind-zone); picker confirm apply/grant legs
// (SaveAttackAoeModal.demilich-howl + .crackling-wave); clause extraction
// (MonsterCardHelpers.both-outcomes); cone / line / clauseless-single-target
// modal twins (MA-0031 recharge-cone — incl. the Chilling Gaze single-target
// keep, MA-0035 line-breath, dracolich-line-breath); generic recharge
// popup/log lane (monsterRecharge.js via MA-0031 cold_breath_refused).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null, onClose: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    aoeProps.onClose = props.onClose;
    return (
      <div className="sp-overlay emanation-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
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

const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
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

vi.mock('../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
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

// Store keys ride the runtime monsterName (creatureName prop, #591 pattern —
// never the base monster name).
const HOWL_ROWS = [
  {
    ma: 'MA-0590 Demilich Howl',
    index: 'demilich',
    name: 'Demilich',
    actionName: 'Howl',
    creatureName: 'Demilich 1',
    save_dc: 19,
    save_type: 'Constitution',
    damage: '20d6',
    // MA-0303 marker byte arms the picker success-leg grant:
    saveEffect: "Failure or Success: The target has the Frightened condition until the start of the demilich's next turn.",
    bothOutcomesClause: { conditions: ['frightened'], effects: [] },
    durationNote: "until the start of the demilich's next turn (GM-enforced)",
    descRe: /30-foot\s*<strong>Emanation<\/strong>/i,
  },
  {
    ma: 'MA-0603 Dire Worg Dreadful Howl',
    index: 'dire-worg',
    name: 'Dire Worg',
    actionName: 'Dreadful Howl',
    creatureName: 'Dire Worg 1',
    save_dc: 16,
    save_type: 'Wisdom',
    damage: '8d8',
    // fail-only tail — stays un-armed (no MA-0303 marker):
    saveEffect: "The target has the Frightened condition until the start of the worg's next turn.",
    bothOutcomesClause: null,
    durationNote: "until the start of the worg's next turn (GM-enforced)",
    descRe: /each creature within 30 feet/i,
  },
];

const diskRow = (index, actionName) => monstersData.find(m => m.index === index).actions.find(a => a.name === actionName);

function renderMonster(name, actions, creatureName) {
  const m = makeMonster({ name, actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName, creatures: [
    { name: creatureName, type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 180, maxHp: 180, ac: 20, conditions: [] },
    { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
    { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  ] })} />);
}

function rowLink(label) {
  const row = Array.from(document.querySelectorAll('.mc-overlay .mc-action')).find(r => {
    const s = r.querySelector('strong');
    return s && s.textContent.trim().startsWith(label);
  });
  return row ? row.querySelector('.mc-dice-link, .mc-dice-link-save-clickable') : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe.each(HOWL_ROWS)('$ma: $actionName Emanation row', ({ index, name, actionName, creatureName, save_dc, save_type, damage, saveEffect, bothOutcomesClause, durationNote, descRe }) => {
  it('disk ground truth: DC, save type, damage, range "30-foot Emanation", Recharge 5-6, dc_success absent (default half)', () => {
    const row = diskRow(index, actionName);
    expect(row.save_dc).toBe(save_dc);
    expect(row.save_type).toBe(save_type);
    expect(row.damage_dice_primary).toBe(damage);
    expect(row.damage_type_primary).toBe('Psychic');
    expect(row.range).toBe('30-foot Emanation');
    expect(row.dc_success).toBeUndefined();
    expect(row.recharge).toBe('5-6');
    expect(row.save_effect).toBe(saveEffect);
    expect(row.description).toMatch(descRe);
    expect(row.description).not.toMatch(/\bcone\b|\bline\b|\bcylinder\b/i);
  });

  it('fresh click spends the recharge and opens the 30-ft Radius picker with the attacker-origin gate, never the single-target save', async () => {
    renderMonster(name, [diskRow(index, actionName)], creatureName);
    fireEvent.click(rowLink(actionName));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const props = aoeProps.current;
    expect(props.titleOverride).toBe('30-ft Radius (GM positions tokens; selection advisory)');
    expect(props.range).toBe(30);
    // attacker-origin emanation coverage gate (MA-0031 cone shape, gridless lenient §42).
    expect(props.rangeGateFt).toBe(30);
    expect(props.saveDc).toBe(save_dc);
    expect(props.saveType).toBe(save_type);
    expect(props.dcSuccess).toBe('half');
    expect(props.damage).toBe(damage);
    expect(props.damageType).toBe('Psychic');
    expect(props.saveConditions).toEqual(['frightened']);
    expect(props.bothOutcomesClause).toEqual(bothOutcomesClause);
    expect(props.conditionDurationNote).toBe(durationNote);
    expect(props.excludeNames).toEqual([creatureName]);
    expect(props.storeLastAttack).toBe(false);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    const rechargeKey = `${creatureName}.monsterRecharge`;
    await waitFor(() => expect(runtime.store[rechargeKey]).toBeTruthy());
    expect(runtime.store[rechargeKey]).toEqual({ [actionName]: { recharged: false, threshold: 5 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(new RegExp(`${actionName}.*Recharge 5-6; unavailable until a d6 5\\+`));
  });
});

// Refusal once (#571 lane is owned by MA-0031/0035) — this pins only the
// emanation-row ORDER: the recharge gate refuses BEFORE the picker opens.
it('MA-0590 spent Howl refuses: popup + howl_refused, zero spend, NO picker, no single-target roll', async () => {
  runtime.store['Demilich 1.monsterRecharge'] = { Howl: { recharged: false, threshold: 5 } };
  renderMonster('Demilich', [diskRow('demilich', 'Howl')], 'Demilich 1');
  fireEvent.click(rowLink('Howl'));
  await waitFor(() => expect(addEntry).toHaveBeenCalled());
  expect(aoeProps.current).toBeNull();
  expect(rollSavingThrow).not.toHaveBeenCalled();
  expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
  const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'howl_refused');
  expect(refusal).toBeTruthy();
  expect(refusal.characterName).toBe('Demilich 1');
  expect(refusal.description).toMatch(/refused \(not recharged\)/);
  expect(runtime.store['Demilich 1.monsterRecharge']).toEqual({ Howl: { recharged: false, threshold: 5 } });
});
