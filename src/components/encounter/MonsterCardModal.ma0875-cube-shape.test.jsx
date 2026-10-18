// @maintained-by-ai
// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" — 30-foot Cube of Darkness at a
// point within 60 feet. The Cube token was unparsed (picker-inert, chip degraded
// to the inline single-target block save), so cubeCoverageFeet/radiusAoeFallback's
// cube leg now routes it through the point-centered Radius picker as an honest
// radius approximation: shapeNote advisory, rangeGateFt null like the MA-0084
// sphere (the 60-ft token gates WHERE the GM places the origin, never selection),
// cube_area_advisory log each picker-open, and the failed-save THP clause rides
// the picker as tempHpGrant. Inert face kept once: Beholder Eye Rays prose matches
// the cube regex ("10-foot Cube") but range:null never arms it (a numeric range
// there would reroute every eye-ray row). Rust Monster (save_dc:0) is MA-1071's
// DC0 gate, not this lane; Gelatinous Cube "cube" is never digit-adjacent
// (trivial regex non-match); the "90-foot-radius Cube" precedence twin is
// structurally guarded — the cube regex cannot bridge "radius" to "Cube" and no
// such row exists in monsters.json. Cone rows: MonsterCardModal.save-variant-shape
// .test.jsx :21 owner. Recharge spend at picker-open: MA-0031 recharge-cone
// .test.jsx owner.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { breathAoeShape } from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const aoeProps = vi.hoisted(() => ({ current: null }));

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return (
      <div className="sp-overlay cube-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();
  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));
  return { default: mockHook, _rollSavingThrow, _setPopupHtml: vi.fn() };
});

const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
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
  { name: 'Gnoll Demoniac 1', type: 'npc', monsterType: 'fiend', targetName: 'Bandit 1', currentHp: 135, maxHp: 135, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
];

const gnoll = () => monstersData.find(m => m.name === 'Gnoll Demoniac');
const hungerRow = () => gnoll().actions.find(a => a.name === 'Hunger of Yeenoghu');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
  ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
});

describe('MA-0875 breathAoeShape parses the authored Cube row', () => {
  it('30-foot Cube + numeric 60-ft origin range → Cube picker, radius approx, null rangeGateFt; spellInfo casts and range-null eye-ray prose never arm the cube leg', () => {
    const aoe = breathAoeShape(hungerRow(), null);
    expect(aoe).toMatchObject({ shape: 'Cube', feet: 30, rangeGateFt: null });
    expect(aoe.shapeNote).toMatch(/modeled as radius/i);
    // spell-info cast route stays closed (MA-0673 precedent gate)
    expect(breathAoeShape(hungerRow(), { spellName: 'X' })).toBeNull();
    // Beholder Eye Rays: prose "10-foot Cube" matches the cube regex but
    // range:null never arms a numeric origin — byte-inert null, never rerouted
    expect(breathAoeShape(monstersData.find(m => m.name === 'Beholder').actions.find(a => a.name === 'Eye Rays'), null)).toBeNull();
  });
});

describe('MA-0875 Hunger DC chip now opens the area picker (was inline single-target)', () => {
  it('chip click opens the Cube picker with honest radius-advisory title, row identity threaded, THP grant rides, advisory logged, no inline save roll', async () => {
    render(<MonsterCardModal {...makeProps(makeMonster(gnoll()), { creatureName: 'Gnoll Demoniac 1', creatures: CREATURES })} />);
    const row = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Hunger of Yeenoghu'));
    const chip = row ? Array.from(row.querySelectorAll('.mc-dice-link-save-clickable')).find(l => /DC 14 Dexterity/.test(l.textContent)) : null;
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.titleOverride).toMatch(/^30-ft Cube — modeled as radius[\s\S]*GM positions tokens; selection advisory/);
    expect(aoeProps.current.rangeGateFt).toBeNull();
    expect(aoeProps.current.range).toBe(30);
    expect(aoeProps.current.saveType).toBe('Dexterity');
    expect(aoeProps.current.saveDc).toBe(14);
    expect(aoeProps.current.damage).toBe('8d6');
    expect(aoeProps.current.tempHpGrant).toEqual({ tempHp: 10 });
    expect(rollSavingThrow).not.toHaveBeenCalled();
    const advisory = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'cube_area_advisory');
    expect(advisory).toBeTruthy();
    expect(advisory.description).toMatch(/Cube — modeled as a 30-foot radius/i);
    expect(advisory.description).toMatch(/within 60 ft/i);
  });
});
