// MA-1113: Lizardfolk Shaman "Change Shape (Recharges after a Short or Long
// Rest)" — formerly a zero-affordance dead prose row (name + description ONLY;
// live audit: 0 interactive elements in the open .mc-action, 0 popups / 0 log
// delta on fresh-rect clicks). NOW one-field DATA fix mirroring the MA-1020
// imp Shape-Shift byte-shape: automation:{type:"monster_shape_shift",
// effect:"shape_shift", forms:[Crocodile, True Form]} arms ShapeShiftLink
// (MonsterAction.jsx) → ShapeShiftModal chooser → resolveMonsterShapeShiftRow
// (ONE merged cs POST stamping shapeShiftForm + Speed dict, §39).
// RAW pins: Crocodile walk 20 ft. (crocodile stat block disk speed);
// "True Form" revert clears the stamp. Clock-less model by design (§70 /
// MA-1020 "until shift back") — no expiration, no te, no stat-swap.
// Advisory residuals (do NOT pin as working): swim 30 ft. speed leg (seam
// stamps walk/fly/climb only), statistics/size swap, revert-on-death,
// bonus-action economy, "Recharges after a Short or Long Rest" rest-rearm
// (§70 zero-consumer — name text stays cosmetic).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterShapeShiftRow,
  shapeShiftForms,
  shapeShiftSpeedDict,
  isTrueFormRequest,
  shapeShiftSpeedText,
  resolveMonsterShapeShiftRow,
} from './monsterShapeShift.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('./combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));
vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()) },
}));

const shaman = monstersData.find(m => m.index === 'lizardfolk-shaman');
const SHAPE_ROW = shaman.actions[3];
const BITE_ROW = shaman.actions[1];
const SHAPE_DESC = "The lizardfolk magically polymorphs into a crocodile, remaining in that form for up to 1 hour. It can revert to its true form as a bonus action. Its statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed. It reverts to its true form if it dies.";
const CROC = SHAPE_ROW.automation.forms[0];
const TRUE_FORM = SHAPE_ROW.automation.forms[1];

function makeCs() {
  return {
    round: 1,
    creatures: [
      { name: 'Lizardfolk Shaman 1', monsterIndex: 'lizardfolk-shaman', currentHp: 27, maxHp: 27 },
      { name: 'Bandit 1', monsterIndex: 'bandit', currentHp: 11, maxHp: 11 },
    ],
  };
}

function makeDeps({ cs = makeCs(), loadMonsters = monstersData } = {}) {
  const box = { cs };
  const writes = [];
  const logs = [];
  return {
    writes,
    logs,
    box,
    getCombatSummary: vi.fn(() => box.cs),
    setCombatSummary: vi.fn((next) => { writes.push(next); box.cs = next; return Promise.resolve(); }),
    loadMonsters: vi.fn(() => Promise.resolve(loadMonsters)),
    addEntry: vi.fn((campaignName, entry) => { logs.push(entry); return Promise.resolve(); }),
  };
}

async function apply(form, deps, setPopupHtml = vi.fn()) {
  return resolveMonsterShapeShiftRow({
    action: SHAPE_ROW,
    form,
    monsterName: 'Lizardfolk Shaman 1',
    campaignName: 'test-campaign',
    setPopupHtml,
    deps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1113 Lizardfolk Shaman Change Shape disk data — monster_shape_shift lane per imp MA-1020 byte-shape', () => {
  it('actions[3] authors monster_shape_shift automation with Crocodile + True Form; description byte-unchanged', () => {
    expect(SHAPE_ROW.name).toBe('Change Shape (Recharges after a Short or Long Rest)');
    expect(SHAPE_ROW.description).toBe(SHAPE_DESC);
    expect(SHAPE_ROW.automation).toEqual({
      type: 'monster_shape_shift',
      effect: 'shape_shift',
      forms: [
        { name: 'Crocodile', speed: 20 },
        { name: 'True Form' },
      ],
    });
    expect(isMonsterShapeShiftRow(SHAPE_ROW)).toBe(true);
    expect(shapeShiftForms(SHAPE_ROW).map(f => f.name)).toEqual(['Crocodile', 'True Form']);
  });

  it('Crocodile stamp is the stat-block land Speed walk 20 ft.; True Form reverts (null)', () => {
    expect(shapeShiftSpeedDict(CROC)).toEqual({ walk: '20 ft.' });
    expect(isTrueFormRequest(CROC)).toBe(false);
    expect(shapeShiftSpeedDict(TRUE_FORM)).toBeNull();
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
    expect(shapeShiftSpeedText(CROC)).toBe('walk 20 ft.');
    expect(shapeShiftSpeedText(TRUE_FORM)).toBe('true-form');
  });

  it('Byte-inert twins: Bite and the pre-fix prose-only shape never arm', () => {
    expect(isMonsterShapeShiftRow(BITE_ROW)).toBe(false);
    expect(isMonsterShapeShiftRow({ name: SHAPE_ROW.name, description: SHAPE_DESC })).toBe(false);
  });
});

describe('MA-1113 apply — ONE merged cs POST stamps Crocodile; revert clears; NO clock, NO te', () => {
  it('Crocodile: single cs POST with speed dict + shapeShiftForm on the shaman only; other combatants untouched', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(CROC, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(false);
    expect(deps.writes).toHaveLength(1);
    const entry = deps.writes[0].creatures.find(c => c.name === 'Lizardfolk Shaman 1');
    expect(entry.speed).toEqual({ walk: '20 ft.' });
    expect(entry.shapeShiftForm).toBe('Crocodile');
    expect(entry.currentHp).toBe(27);
    const bandit = deps.writes[0].creatures.find(c => c.name === 'Bandit 1');
    expect(bandit.speed).toBeUndefined();
    expect(bandit.shapeShiftForm).toBeUndefined();
    const applied = deps.logs.find(e => e.automationType === 'shape_shift_applied');
    expect(applied).toBeTruthy();
    expect(applied.characterName).toBe('Lizardfolk Shaman 1');
    expect(applied.abilityName).toBe('Change Shape (Recharges after a Short or Long Rest)');
    expect(applied.description).toContain('shape-shifts into Crocodile');
    expect(applied.description).toContain('walk 20 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Crocodile'));
  });

  it('True Form revert: clears stamp + marker, logs restored stat-block Speed read from disk', async () => {
    const deps = makeDeps();
    await apply(CROC, deps);
    const setPopupHtml = vi.fn();
    const result = await apply(TRUE_FORM, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(true);
    expect(deps.writes).toHaveLength(2);
    const entry = deps.writes[1].creatures.find(c => c.name === 'Lizardfolk Shaman 1');
    expect(entry.speed).toBeUndefined();
    expect(entry.shapeShiftForm).toBeUndefined();
    const reverted = deps.logs.find(e => e.automationType === 'shape_shift_reverted');
    expect(reverted).toBeTruthy();
    const diskSpeed = shaman.speed;
    expect(reverted.description).toContain(Object.entries(diskSpeed).map(([k, v]) => `${k} ${v}`).join(', '));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('true form'));
  });

  it('already-in-Crocodile re-pick refuses with zero second POST; True-Form-while-true refuses zero-write', async () => {
    const deps = makeDeps();
    await apply(CROC, deps);
    const again = await apply(CROC, deps, vi.fn());
    expect(again).toEqual({ resolved: false, reason: 'already_in_form' });
    expect(deps.writes).toHaveLength(1);
    expect(deps.logs.find(e => e.automationDetail === 'already_in_crocodile_form')).toBeTruthy();
    const deps2 = makeDeps();
    const revert = await apply(TRUE_FORM, deps2, vi.fn());
    expect(revert).toEqual({ resolved: false, reason: 'already_true_form' });
    expect(deps2.writes).toHaveLength(0);
  });

  it('no clock / no expiration / no te anywhere in the flow (§70 honest persistent self-state)', async () => {
    const deps = makeDeps();
    await apply(CROC, deps);
    await apply(TRUE_FORM, deps);
    expect(JSON.stringify(deps.writes)).not.toMatch(/expir|shape_shifted/);
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
  });
});
