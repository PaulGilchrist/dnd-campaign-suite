// MA-0622: Dracolich "Terrifying Presence" (legendary, DC 19 WIS, 2d10
// Psychic, range "30-foot Emanation") listed damage under FAILURE ONLY —
// RAW carries no "Success: half damage" clause, so a successful save must pay
// ZERO. The absent dc_success field let resolveBlockSaveDcSuccess default the
// picker props to 'half' (MV-20 half-default leak; live proof: save success
// "rolled 11, halved" paid finalDamage 9, hp 999→990). Same MA-0218 /
// MA-0481 byte-shape data fix: dc_success:"none" on the row, consumed live
// via setConePicker → SaveAttackAoeModal computeDamageAfterEvasion →
// computeDamageAfterSave(raw, true, 'none') = 0 (MA-0590 shows the emanation
// RANGE byte rides the area picker, never the single-target block save). The
// "Failure or Success:" prose clause gates only the MA-0073 once-per-turn
// recharge latch — save_effect stays fail-only Frightened (§157).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import { hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay emanation-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 11, rolls: [6, 5], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 22, rolls: [6, 5], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));

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

const ctx = vi.hoisted(() => ({ value: { round: 2, activeCreatureName: 'Bandit 1', creatures: [] } }));

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
  rangeToFeet: vi.fn(() => 30),
}));

vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));
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

const dracolich = () => monstersData.find(m => m.index === 'dracolich');
const presenceRow = () => dracolich().legendary_actions.find(a => a.name === 'Terrifying Presence');

const CREATURES = [
  { name: 'Dracolich 1', type: 'npc', targetName: 'Bandit 1', currentHp: 225, maxHp: 225, ac: 20, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

function renderDracolich(uses) {
  runtime.store['Dracolich 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ name: 'Dracolich', legendary_actions: dracolich().legendary_actions });
  ctx.value = { round: 2, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Dracolich 1', creatures: CREATURES })} />);
}

function presenceSaveLink() {
  const row = Array.from(document.querySelectorAll('.mc-overlay .mc-action')).find(r => {
    const s = r.querySelector('strong');
    return s && s.textContent.trim().startsWith('Terrifying Presence');
  });
  return row ? row.querySelector('.mc-dice-link-save-clickable') : null;
}

describe('MA-0622 monsters.json data lock: Dracolich Terrifying Presence row', () => {
  it('authors dc_success none (failure-only damage) with DC 19 Wisdom 2d10 Psychic', () => {
    const row = presenceRow();
    expect(row.save_dc).toBe(19);
    expect(row.save_type).toBe('Wisdom');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('2d10');
    expect(row.damage_type_primary).toBe('Psychic');
    expect(row.range).toBe('30-foot Emanation');
    expect(row.save_effect).toBe('The target has the Frightened condition until the end of its next turn.');
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(hasLegendaryCooldownClause(row)).toBe(true);
  });

  it('legendary header authors numeric uses:1 (MA-0620) arming the economy', () => {
    expect(dracolich().legendary_actions[0].name).toBe('Legendary Action Uses: 1');
    expect(dracolich().legendary_actions[0].uses).toBe(1);
  });
});

describe('MA-0622 computeDamageAfterSave: none pays ZERO on success, FULL on failure', () => {
  it('success pays 0, failure pays raw — the old half-default leak is gone', () => {
    expect(computeDamageAfterSave(11, true, 'none')).toBe(0);
    expect(computeDamageAfterSave(11, false, 'none')).toBe(11);
    expect(computeDamageAfterSave(11, true, 'half')).toBe(5);
  });
});

describe('MA-0622 Terrifying Presence picker threads dcSuccess none live', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
  });

  it('fresh legendary click opens the 30-ft Radius picker with dcSuccess none, never the single-target save', async () => {
    renderDracolich({ max: 1, used: 0 });
    fireEvent.click(presenceSaveLink());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const props = aoeProps.current;
    expect(props.titleOverride).toBe('30-ft Radius (GM positions tokens; selection advisory)');
    expect(props.range).toBe(30);
    expect(props.rangeGateFt).toBe(30);
    expect(props.saveDc).toBe(19);
    expect(props.saveType).toBe('Wisdom');
    expect(props.dcSuccess).toBe('none');
    expect(props.damage).toBe('2d10');
    expect(props.damageType).toBe('Psychic');
    expect(props.saveConditions).toEqual(['frightened']);
    expect(props.excludeNames).toEqual(['Dracolich 1']);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
  });

  it('exhausted row refuses: zero spend, NO picker, no save rolled', async () => {
    renderDracolich({ max: 1, used: 1 });
    fireEvent.click(presenceSaveLink());
    await waitFor(() => expect(runtime.store['Dracolich 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 }));
    expect(aoeProps.current).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});
