// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" — 30-foot Cube of magical
// Darkness at a point within 60 feet. Cube was NOT parsed (breathAoeShape
// tested cone|line only, sphereRadiusFeet needed "-radius"), so the DC chip
// degraded to the inline single-target block save and the area picker NEVER
// opened (§62/§159). Now: a "N-foot Cube" token on a save row that authors
// a numeric origin range routes through the point-centered Radius picker as
// an honest radius approximation, with the shapeNote advisory in the picker
// title + a cube_area_advisory log each fire (MA-0673 shape_note precedent,
// §85/§228 accepted cube→radius residual). rangeGateFt stays null like the
// MA-0084 sphere — the 60-ft token gates WHERE the GM places the origin,
// never target selection. Byte-inert twins: Beholder-family eye-ray rows
// (range: null, disintegration "10-foot Cube" prose), Rust Monster
// "destroys a 1-foot Cube of the object" (range:""), Gelatinous Cube
// Engulf (no digit-cube adjacency), MA-0673 "90-foot-radius Cube"
// (Radius token wins first, byte-identical).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { breathAoeShape } from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
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

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 26, rolls: [5, 6, 1, 5, 4, 4, 1, 1], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => null),
  canRollExpression: vi.fn(() => true),
  parseConstant: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
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

vi.mock('../../services/rules/combat/rangeValidation.js', async (importActual) => ({
  ...(await importActual()),
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
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
  { name: 'Gnoll Demoniac 1', type: 'npc', monsterType: 'fiend', targetName: 'Bandit 1', currentHp: 135, maxHp: 135, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [], saveBonuses: { dexterity: -19 } },
];

const gnoll = () => monstersData.find(m => m.name === 'Gnoll Demoniac');
const hungerRow = () => gnoll().actions.find(a => a.name === 'Hunger of Yeenoghu');

function renderGnoll() {
  return render(<MonsterCardModal {...makeProps(makeMonster(gnoll()), { creatureName: 'Gnoll Demoniac 1', creatures: CREATURES })} />);
}

function hungerSaveChip() {
  const row = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Hunger of Yeenoghu'));
  return row ? Array.from(row.querySelectorAll('.mc-dice-link-save-clickable')).find(l => /DC 14 Dexterity/.test(l.textContent)) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  aoeProps.current = null;
  ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
});

describe('MA-0875 breathAoeShape parses the authored Cube row', () => {
  it('30-foot Cube + numeric 60-ft origin range → Cube picker, radius approx, null rangeGateFt', () => {
    const aoe = breathAoeShape(hungerRow(), null);
    expect(aoe).toMatchObject({ shape: 'Cube', feet: 30, rangeGateFt: null });
    expect(aoe.shapeNote).toMatch(/modeled as radius/i);
    expect(aoe.shapeNote).toMatch(/Darkness/i);
  });

  it('byte-inert twins: eye-ray rows (range null), Rust Monster (range ""), Gelatinous Cube Engulf (no digit-cube adjacency)', () => {
    expect(breathAoeShape(monstersData.find(m => m.name === 'Beholder').actions.find(a => a.name === 'Eye Rays'), null)).toBeNull();
    expect(breathAoeShape(monstersData.find(m => m.name === 'Rust Monster').actions.find(a => a.name === 'Destroy Metal'), null)).toBeNull();
    expect(breathAoeShape(monstersData.find(m => m.name === 'Gelatinous Cube').actions.find(a => a.name === 'Engulf'), null)).toBeNull();
  });

  it('MA-0673 "90-foot-radius Cube" shape_note still parses Radius first, byte-identical', () => {
    const aoe = breathAoeShape({ save_dc: 23, description: '90-foot-radius Cube' }, null);
    expect(aoe).toEqual({ shape: 'Radius', feet: 90, rangeGateFt: null });
  });

  it('spellInfo route stays byte-identical null; cone rows unaffected', () => {
    expect(breathAoeShape(hungerRow(), { spellName: 'X' })).toBeNull();
    const cone = breathAoeShape({ save_dc: 15, description: '30-foot Cone', range: 'Self' }, null);
    expect(cone).toEqual({ shape: 'Cone', feet: 30, rangeGateFt: 30 });
  });
});

describe('MA-0875 Hunger DC chip now opens the area picker (was inline single-target)', () => {
  it('chip click opens the Cube picker with honest radius-advisory title + threads tempHpGrant; recharge spends at picker-open', async () => {
    renderGnoll();
    const chip = hungerSaveChip();
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    expect(aoeProps.current.titleOverride).toMatch(/^30-ft Cube — modeled as radius/);
    expect(aoeProps.current.titleOverride).toMatch(/GM positions tokens; selection advisory/);
    expect(aoeProps.current.rangeGateFt).toBeNull();
    expect(aoeProps.current.range).toBe(30);
    expect(aoeProps.current.tempHpGrant).toEqual({ tempHp: 10 });
    expect(aoeProps.current.damage).toBe('8d6');
    expect(aoeProps.current.saveType).toBe('Dexterity');
    expect(aoeProps.current.saveDc).toBe(14);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    const advisory = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'cube_area_advisory');
    expect(advisory).toBeTruthy();
    expect(advisory.description).toMatch(/Cube — modeled as a 30-foot radius/i);
    expect(advisory.description).toMatch(/within 60 ft/i);
  });
});
