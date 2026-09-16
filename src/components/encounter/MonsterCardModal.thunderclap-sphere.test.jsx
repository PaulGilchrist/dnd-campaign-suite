// MA-0084: Adult Bronze Dragon "Thunderclap" (legendary, DC 17 CON, 3d6
// Thunder, Deafened on fail, dc_success none) authors a "20-foot-radius
// Sphere … within 90 feet" area. breathAoeShape now recognizes the RADIUS
// token and routes the click through the SAME SaveAttackAoeModal area picker
// as the MA-0031 cones / MA-0042 zones — labelled "20-ft Radius", point
// placement GM-advisory (rangeGateFt null, MA-0042 shape), never the
// single-target block-save degrade. MA-0081 uses gating stays in front of
// the picker (spend at click, refusal at 0 uses). Cylinder rows (radius +
// height clause) stay byte-identical single-target.
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
      <div className="sp-overlay sphere-picker-stub">
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

const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));

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

const CREATURES = [
  { name: 'Adult Bronze Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 200, maxHp: 200, ac: 19, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 90, maxHp: 90, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
];

const bronze = () => monstersData.find(m => m.name === 'Adult Bronze Dragon');
const bronzeActions = () => [{ name: 'Rend', attack_bonus: 12, damage_dice_primary: '2d8 + 7', damage_type_primary: 'Slashing', reach: '10 ft.' }];

function renderBronze(uses) {
  if (uses !== undefined) runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({
    name: 'Adult Bronze Dragon',
    actions: bronzeActions(),
    legendary_actions: bronze().legendary_actions,
  });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Bronze Dragon 1', creatures: CREATURES })} />);
}

function thunderclapRowLink() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Thunderclap'));
  return row ? row.querySelector('.mc-dice-link-legendary') || row.querySelector('.mc-dice-link') : null;
}

describe('MA-0084 monsters.json data: adult bronze Thunderclap sphere row ground truth', () => {
  it('authors DC 17 CON, 3d6 Thunder, dc_success none, Deafened, 20-foot-radius Sphere', () => {
    const row = bronze().legendary_actions.find(a => a.name === 'Thunderclap');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Thunder');
    expect(row.save_effect).toMatch(/Deafened condition until the end of its next turn/i);
    expect(row.description).toMatch(/20-foot-radius\s*<strong>Sphere<\/strong>/i);
    expect(row.description).not.toMatch(/\bcone\b|\bline\b|\bcylinder\b/i);
  });
});

describe('MA-0084 Thunderclap routes the Sphere row to the area picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  it('click spends 1 legendary use and opens the 20-ft Radius picker, never the single-target save', async () => {
    renderBronze({ max: 3, used: 0 });
    fireEvent.click(thunderclapRowLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const props = aoeProps.current;
    expect(props.titleOverride).toMatch(/^20-ft Radius/);
    expect(props.range).toBe(20);
    // GM positions the point — MA-0042 zone shape: no attacker-origin gate.
    expect(props.rangeGateFt).toBeNull();
    expect(props.saveDc).toBe(17);
    expect(props.saveType).toBe('Constitution');
    expect(props.dcSuccess).toBe('none');
    expect(props.damage).toBe('3d6');
    expect(props.damageType).toBe('Thunder');
    expect(props.saveConditions).toEqual(['deafened']);
    expect(props.conditionDurationNote).toMatch(/^until the end of its next turn \(GM-enforced\)$/);
    expect(props.excludeNames).toEqual(['Adult Bronze Dragon 1']);
    expect(props.storeLastAttack).toBe(false);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Thunderclap/.test(String(e.description)));
    expect(spend.description).toMatch(/expends a legendary use for Thunderclap/);
  });

  it('exhausted (3/3): click refuses with popup + legendary_use_refused, zero spend, NO picker', async () => {
    renderBronze({ max: 3, used: 3 });
    fireEvent.click(thunderclapRowLink());
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(aoeProps.current).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
  });
});

describe('MA-0084 shape detection guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  it('cylinder row (Storm Giant Lightning Storm, radius + height clause) stays byte-identical single-target', async () => {
    const giant = monstersData.find(m => m.name === 'Storm Giant');
    const actions = (giant.actions || []).filter(a => a.name === 'Lightning Storm');
    expect(actions[0].description).toMatch(/10-foot-radius.*Cylinder/i);
    const m = makeMonster({ name: 'Storm Giant', actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Storm Giant 1', creatures: [{ name: 'Storm Giant 1', type: 'npc', targetName: 'ElderPaladin', currentHp: 230, maxHp: 230, ac: 17, conditions: [] }, ...CREATURES.slice(1)] })} />);
    fireEvent.click(document.querySelector('.mc-dice-link-save-clickable') || Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('.mc-action')?.textContent.includes('Lightning Storm')));
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    expect(aoeProps.current).toBeNull();
  });
});
