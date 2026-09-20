// MA-0590: Demilich "Howl" (actions, DC 19 CON, 20d6 Psychic, Recharge 5-6,
// range "30-foot Emanation"). breathAoeShape now recognizes the authored
// "N-foot Emanation" RANGE byte (emanationRadiusFeet) and routes the click
// through the same SaveAttackAoeModal area picker as the MA-0031 cones /
// MA-0084 spheres — labelled "30-ft Radius", attacker-origin coverage gate
// (rangeGateFt = the authored feet, gridless lenient §42) — never the former
// single-target block-save degrade that left a second adjacent victim with
// zero save / zero damage / zero log. The DATA edit (save_effect now
// byte-carries the MA-0303 "Failure or Success:" marker) arms the picker
// success-leg Frightened grant threaded onto the picker props. Cone/line/
// cylinder twins stay byte-identical (their branches untouched); a clauseless
// single-target save row keeps fire() with the picker closed.
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

const CREATURES = [
  { name: 'Demilich 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 180, maxHp: 180, ac: 20, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const demilichRow = (name) => monstersData.find(m => m.index === 'demilich').actions.find(a => a.name === name);

function renderMonster(name, actions, creatureName) {
  const m = makeMonster({ name, actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName, creatures: CREATURES })} />);
}

function rowLink(label) {
  const row = Array.from(document.querySelectorAll('.mc-overlay .mc-action')).find(r => {
    const s = r.querySelector('strong');
    return s && s.textContent.trim().startsWith(label);
  });
  return row ? row.querySelector('.mc-dice-link, .mc-dice-link-save-clickable') : null;
}

describe('MA-0590 monsters.json data: Demilich Howl row ground truth', () => {
  it('authors DC 19 CON, 20d6 Psychic, range 30-foot Emanation, Recharge 5-6, both-outcomes Frightened marker', () => {
    const row = demilichRow('Howl');
    expect(row.save_dc).toBe(19);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('20d6');
    expect(row.damage_type_primary).toBe('Psychic');
    expect(row.range).toBe('30-foot Emanation');
    expect(row.dc_success).toBeUndefined();
    expect(row.recharge).toBe('5-6');
    expect(row.save_effect).toBe("Failure or Success: The target has the Frightened condition until the start of the demilich's next turn.");
    expect(row.description).toMatch(/30-foot\s*<strong>Emanation<\/strong>/i);
    expect(row.description).not.toMatch(/\bcone\b|\bline\b|\bcylinder\b/i);
  });
});

describe('MA-0590 Howl routes the Emanation row to the area picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  it('fresh click spends the recharge and opens the 30-ft Radius picker, never the single-target save', async () => {
    renderMonster('Demilich', [demilichRow('Howl')], 'Demilich 1');
    fireEvent.click(rowLink('Howl'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const props = aoeProps.current;
    expect(props.titleOverride).toBe('30-ft Radius (GM positions tokens; selection advisory)');
    expect(props.range).toBe(30);
    // attacker-origin emanation coverage gate (MA-0031 cone shape, gridless lenient §42).
    expect(props.rangeGateFt).toBe(30);
    expect(props.saveDc).toBe(19);
    expect(props.saveType).toBe('Constitution');
    expect(props.dcSuccess).toBe('half');
    expect(props.damage).toBe('20d6');
    expect(props.damageType).toBe('Psychic');
    expect(props.saveConditions).toEqual(['frightened']);
    expect(props.bothOutcomesClause).toEqual({ conditions: ['frightened'], effects: [] });
    expect(props.conditionDurationNote).toBe("until the start of the demilich's next turn (GM-enforced)");
    expect(props.excludeNames).toEqual(['Demilich 1']);
    expect(props.storeLastAttack).toBe(false);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Demilich 1.monsterRecharge']).toBeTruthy());
    expect(runtime.store['Demilich 1.monsterRecharge']).toEqual({ Howl: { recharged: false, threshold: 5 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/Howl.*Recharge 5-6; unavailable until a d6 5\+/);
  });

  it('spent row refuses: popup + howl_refused, zero spend, NO picker, no single-target roll', async () => {
    runtime.store['Demilich 1.monsterRecharge'] = { Howl: { recharged: false, threshold: 5 } };
    renderMonster('Demilich', [demilichRow('Howl')], 'Demilich 1');
    fireEvent.click(rowLink('Howl'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(aoeProps.current).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Not Recharged');
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'howl_refused');
    expect(refusal).toBeTruthy();
  });
});

describe('MA-0590 shape-detection twins stay byte-identical', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  it('cone twin (Arch-hag Crackling Wave) keeps the 60-ft Cone picker + max-token gate', async () => {
    const hag = monstersData.find(m => m.index === 'arch-hag');
    renderMonster('Arch-hag', [hag.actions.find(a => a.name === 'Crackling Wave')], 'Arch-hag 1');
    fireEvent.click(rowLink('Crackling Wave'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.titleOverride).toBe('60-ft Cone (GM positions tokens; selection advisory)');
    expect(aoeProps.current.range).toBe(60);
    expect(aoeProps.current.rangeGateFt).toBe(60);
    expect(aoeProps.current.bothOutcomesClause).toEqual({ conditions: ['cursed'], effects: ['no_reactions'] });
  });

  it('line twin (Adult Blue Dragon Lightning Breath) keeps the max-feet-token 90-ft Line picker', async () => {
    const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
    renderMonster('Adult Blue Dragon', [dragon.actions.find(a => a.name === 'Lightning Breath (Recharge 5-6)')], 'Adult Blue Dragon 1');
    fireEvent.click(rowLink('Lightning Breath'));
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.titleOverride).toBe('90-ft Line (GM positions tokens; selection advisory)');
    expect(aoeProps.current.range).toBe(90);
    expect(aoeProps.current.rangeGateFt).toBe(90);
  });

  it('clauseless single-target save row (no emanation range) keeps fire(), picker stays closed', async () => {
    const creatures = [
      { name: 'Goblin Boss 1', type: 'npc', targetName: 'Bandit 1', currentHp: 30, maxHp: 30, ac: 17, conditions: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
    ];
    const m = makeMonster({ name: 'Goblin Boss', actions: [{ name: 'Net Attack', description: 'Dexterity Saving Throw: DC 12, one creature. Failure: Restrained.', save_dc: 12, save_type: 'Dexterity', save_effect: 'The target has the Restrained condition.' }] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Goblin Boss 1', creatures })} />);
    fireEvent.click(rowLink('Net Attack'));
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(aoeProps.current).toBeNull();
  });
});
