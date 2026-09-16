// MA-0064: Adult Blue Dragon lair_actions[2] "Lightning Arcs" was a plain
// string (inert — no chip, no save, no roll, zero log). Now a structured
// save row mirroring MA-0062 Falling Ceiling / MA-0042 Insect Cloud: DC 15
// Dexterity, 3d6 Lightning half-on-success. Chip click routes through the
// MA-0031/0035 area picker as a LINE — coverage gate parsed to the greatest
// authored distance (120 ft endpoints, NOT the 5-ft width token) — and the
// picker resolves per-target saves; save math untouched.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return <div className="sp-overlay lightning-arcs-picker-stub"><div className="sp-body">{props.titleOverride}</div></div>;
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

vi.mock('../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(() => Promise.resolve(true)),
  isWithinRangeOf: vi.fn(() => Promise.resolve(true)),
}));

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Adult Blue Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'ElderPaladin', currentHp: 212, maxHp: 212, ac: 19, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, ac: 11, conditions: [] },
  { name: 'ElderPaladin', type: 'player', currentHp: 60, maxHp: 60, conditions: [] },
];

function renderDragon() {
  const dragon = monstersData.find(m => m.index === 'adult-blue-dragon');
  const m = makeMonster({ name: 'Adult Blue Dragon', lair_actions: dragon.lair_actions });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Blue Dragon 1', creatures: CREATURES })} />);
}

function arcsChip() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'))
    .find(el => el.closest('.mc-action')?.textContent.includes('Lightning Arcs')) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
});

describe('MA-0064 Lightning Arcs lair row → 120-ft LINE area picker', () => {
  it('row is no longer an inert string — renders a clickable DC 15 Dexterity lair chip', () => {
    renderDragon();
    const chip = arcsChip();
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('DC 15 Dexterity');
    expect(chip.getAttribute('title')).toMatch(/initiative 20/);
  });

  it('chip click routes to the area picker at DEX DC 15, 3d6 Lightning half-on-success', async () => {
    renderDragon();
    fireEvent.click(arcsChip());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const p = aoeProps.current;
    expect(p.saveDc).toBe(15);
    expect(p.saveType).toBe('Dexterity');
    expect(p.damage).toBe('3d6');
    expect(p.dcSuccess).toBe('half');
    expect(p.saveConditions).toEqual([]);
    expect(p.zoneTe).toBeNull();
    expect(p.excludeNames).toEqual(['Adult Blue Dragon 1']);
    expect(p.storeLastAttack).toBe(false);
  });

  it('coverage gate parses the 120-ft endpoint distance, NOT the leading 5-ft width token', async () => {
    renderDragon();
    fireEvent.click(arcsChip());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.range).toBe(120);
    expect(aoeProps.current.rangeGateFt).toBe(120);
    expect(aoeProps.current.titleOverride).toBe('120-ft Line (GM positions tokens; selection advisory)');
  });

  it('verified sibling gates untouched: acid breath line still gates at its 60-ft length', async () => {
    const black = monstersData.find(m => m.index === 'adult-black-dragon');
    const m = makeMonster({ name: 'Adult Black Dragon', actions: black.actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Black Dragon 1', creatures: CREATURES })} />);
    const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.closest('.mc-action')?.textContent.includes('Acid Breath'));
    expect(link).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.rangeGateFt).toBe(60);
    expect(aoeProps.current.titleOverride).toBe('60-ft Line (GM positions tokens; selection advisory)');
  });

  it('row click logs nothing by itself — the picker owns save/damage logging', async () => {
    renderDragon();
    fireEvent.click(arcsChip());
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
