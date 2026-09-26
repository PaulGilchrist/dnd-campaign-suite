// MA-1260: Oni "Shape-Shift" — formerly a junk attack_bonus:0 row rendering
// a lone clickable "+0" chip that rolled a bogus to-hit (live audit: press →
// roll/attack name:'Shape-Shift', lastAttack ABSENT). Fix = DATA-only:
// attack_bonus key REMOVED (§490 "+0" leg killed, imp MA-1020 twin has no
// key) + automation:{type:"monster_shape_shift", effect:"shape_shift",
// forms:[Humanoid, Giant, True Form]} authored per the Imp/Lizardfolk-Shaman
// byte-shape → ShapeShiftLink chooser → resolveMonsterShapeShiftRow ONE
// merged cs POST stamping shapeShiftForm + Speed dict (§39).
// RAW pins: Humanoid/Giant walk 30 ft. (oni base walk 30, speed unchanged);
// "True Form" revert clears the stamp. §70 honest residuals (do NOT pin as
// working): size swap unmodeled (zero consumer), no expiration clock (GM
// re-click), equipment non-transformation stays prose.
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

const oni = monstersData.find(m => m.index === 'oni');
const SHAPE_ROW = oni.actions[3];
const CLAW_ROW = oni.actions[1];
const SHAPE_DESC = "The oni <strong>shape-shifts</strong> into a Small or Medium Humanoid or a Large Giant, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.";
const HUMANOID = SHAPE_ROW.automation.forms[0];
const GIANT = SHAPE_ROW.automation.forms[1];
const TRUE_FORM = SHAPE_ROW.automation.forms[2];

function makeCs() {
  return {
    round: 1,
    creatures: [
      { name: 'Oni 1', monsterIndex: 'oni', currentHp: 119, maxHp: 119 },
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
    monsterName: 'Oni 1',
    campaignName: 'test-campaign',
    setPopupHtml,
    deps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1260 Oni Shape-Shift disk data — monster_shape_shift lane per imp MA-1020 byte-shape', () => {
  it('actions[3] authors monster_shape_shift automation with Humanoid/Giant/True Form; description byte-unchanged', () => {
    expect(SHAPE_ROW.name).toBe('Shape-Shift');
    expect(SHAPE_ROW.description).toBe(SHAPE_DESC);
    expect(SHAPE_ROW.automation).toEqual({
      type: 'monster_shape_shift',
      effect: 'shape_shift',
      forms: [
        { name: 'Humanoid', speed: 30 },
        { name: 'Giant', speed: 30 },
        { name: 'True Form' },
      ],
    });
    expect(isMonsterShapeShiftRow(SHAPE_ROW)).toBe(true);
    expect(shapeShiftForms(SHAPE_ROW).map(f => f.name)).toEqual(['Humanoid', 'Giant', 'True Form']);
  });

  it('attack_bonus key ABSENT — junk "+0" chip can never arm (pre-fix disk had attack_bonus:0)', () => {
    expect('attack_bonus' in SHAPE_ROW).toBe(false);
    expect(SHAPE_ROW.attack_bonus ?? null).toBeNull();
  });

  it('Humanoid/Giant stamps are walk 30 ft. (RAW speed unchanged); True Form reverts (null)', () => {
    expect(shapeShiftSpeedDict(HUMANOID)).toEqual({ walk: '30 ft.' });
    expect(shapeShiftSpeedDict(GIANT)).toEqual({ walk: '30 ft.' });
    expect(isTrueFormRequest(HUMANOID)).toBe(false);
    expect(isTrueFormRequest(GIANT)).toBe(false);
    expect(shapeShiftSpeedDict(TRUE_FORM)).toBeNull();
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
    expect(shapeShiftSpeedText(HUMANOID)).toBe('walk 30 ft.');
    expect(shapeShiftSpeedText(TRUE_FORM)).toBe('true-form');
  });

  it('Byte-inert twins: Claw and the pre-fix prose-only shape never arm', () => {
    expect(isMonsterShapeShiftRow(CLAW_ROW)).toBe(false);
    expect(isMonsterShapeShiftRow({ name: SHAPE_ROW.name, description: SHAPE_DESC, attack_bonus: 0 })).toBe(false);
  });
});

describe('MA-1260 apply — ONE merged cs POST stamps form Speed; revert clears; NO clock, NO te', () => {
  it('Humanoid: single cs POST with speed dict + shapeShiftForm on the oni only; other combatants untouched', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(HUMANOID, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(false);
    expect(deps.writes).toHaveLength(1);
    const entry = deps.writes[0].creatures.find(c => c.name === 'Oni 1');
    expect(entry.speed).toEqual({ walk: '30 ft.' });
    expect(entry.shapeShiftForm).toBe('Humanoid');
    expect(entry.currentHp).toBe(119);
    const bandit = deps.writes[0].creatures.find(c => c.name === 'Bandit 1');
    expect(bandit.speed).toBeUndefined();
    expect(bandit.shapeShiftForm).toBeUndefined();
    const applied = deps.logs.find(e => e.automationType === 'shape_shift_applied');
    expect(applied).toBeTruthy();
    expect(applied.characterName).toBe('Oni 1');
    expect(applied.abilityName).toBe('Shape-Shift');
    expect(applied.description).toContain('shape-shifts into Humanoid');
    expect(applied.description).toContain('walk 30 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Humanoid'));
  });

  it('Giant form rides same seam; already-in-form refuses with zero second POST', async () => {
    const deps = makeDeps();
    const giant = await apply(GIANT, deps, vi.fn());
    expect(giant.resolved).toBe(true);
    expect(deps.writes[0].creatures.find(c => c.name === 'Oni 1').shapeShiftForm).toBe('Giant');
    const again = await apply(GIANT, deps, vi.fn());
    expect(again).toEqual({ resolved: false, reason: 'already_in_form' });
    expect(deps.writes).toHaveLength(1);
    expect(deps.logs.find(e => e.automationDetail === 'already_in_giant_form')).toBeTruthy();
  });

  it('True Form revert: clears stamp + marker, logs restored stat-block Speed read from disk', async () => {
    const deps = makeDeps();
    await apply(GIANT, deps);
    const setPopupHtml = vi.fn();
    const result = await apply(TRUE_FORM, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(true);
    expect(deps.writes).toHaveLength(2);
    const entry = deps.writes[1].creatures.find(c => c.name === 'Oni 1');
    expect(entry.speed).toBeUndefined();
    expect(entry.shapeShiftForm).toBeUndefined();
    const reverted = deps.logs.find(e => e.automationType === 'shape_shift_reverted');
    expect(reverted).toBeTruthy();
    const diskSpeed = oni.speed;
    expect(reverted.description).toContain(Object.entries(diskSpeed).map(([k, v]) => `${k} ${v}`).join(', '));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('true form'));
  });

  it('True-Form-while-true refuses zero-write; no clock / no te anywhere in the flow (§70)', async () => {
    const deps = makeDeps();
    const revert = await apply(TRUE_FORM, deps, vi.fn());
    expect(revert).toEqual({ resolved: false, reason: 'already_true_form' });
    expect(deps.writes).toHaveLength(0);
    await apply(HUMANOID, deps);
    await apply(TRUE_FORM, deps);
    expect(JSON.stringify(deps.writes)).not.toMatch(/expir|shape_shifted/);
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
  });
});
