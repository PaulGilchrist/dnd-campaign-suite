// MA-1371: Quasit "Shape-Shift" — formerly a junk attack_bonus:0 row rendering
// a lone clickable "+0" chip (zero real affordance, live audit: presses →
// zero log delta). Fix = DATA-only: attack_bonus key REMOVED (§490 "+0" leg
// killed, imp MA-1020 / oni MA-1260 twins have no key) + automation:
// {type:"monster_shape_shift", effect:"shape_shift", forms:[Bat, Centipede,
// Toad, True Form]} authored per the oni MA-1260 byte-shape → ShapeShiftLink
// chooser → resolveMonsterShapeShiftRow ONE merged cs POST stamping
// shapeShiftForm + Speed dict (§39).
// RAW pins: Bat walk 10 ft. fly 40 ft., Centipede walk 40 ft. climb 40 ft.,
// Toad walk 40 ft. — "Swim 40 ft." is an advisory leg shapeShiftSpeedDict
// NEVER consumes (§571(a): NO swim key authored — phantom data). "True Form"
// revert clears the stamp. §70 honest residuals: size/stat swap, revert-on-rest.
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

const quasit = monstersData.find(m => m.index === 'quasit');
const SHAPE_ROW = quasit.actions[3];
const REND_ROW = quasit.actions[0];
const SCARE_ROW = quasit.actions[2];
const SHAPE_DESC = "The quasit <strong>shape-shifts</strong> to resemble a bat (Speed 10 ft., Fly 40 ft.), a centipede (40 ft., Climb 40 ft.), or a toad (40 ft., Swim 40 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.";
const BAT = SHAPE_ROW.automation.forms[0];
const CENTIPEDE = SHAPE_ROW.automation.forms[1];
const TOAD = SHAPE_ROW.automation.forms[2];
const TRUE_FORM = SHAPE_ROW.automation.forms[3];

function makeCs() {
  return {
    round: 1,
    creatures: [
      { name: 'Quasit 1', monsterIndex: 'quasit', currentHp: 25, maxHp: 25 },
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
    monsterName: 'Quasit 1',
    campaignName: 'test-campaign',
    setPopupHtml,
    deps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1371 Quasit Shape-Shift disk data — monster_shape_shift lane per oni MA-1260 byte-shape', () => {
  it('actions[3] authors monster_shape_shift automation with Bat/Centipede/Toad/True Form; description byte-unchanged', () => {
    expect(SHAPE_ROW.name).toBe('Shape-Shift');
    expect(SHAPE_ROW.description).toBe(SHAPE_DESC);
    expect(SHAPE_ROW.automation).toEqual({
      type: 'monster_shape_shift',
      effect: 'shape_shift',
      forms: [
        { name: 'Bat', speed: 10, fly: 40 },
        { name: 'Centipede', speed: 40, climb: 40 },
        { name: 'Toad', speed: 40 },
        { name: 'True Form' },
      ],
    });
    expect(isMonsterShapeShiftRow(SHAPE_ROW)).toBe(true);
    expect(shapeShiftForms(SHAPE_ROW).map(f => f.name)).toEqual(['Bat', 'Centipede', 'Toad', 'True Form']);
  });

  it('attack_bonus key ABSENT — junk "+0" chip can never arm (pre-fix disk had attack_bonus:0)', () => {
    expect('attack_bonus' in SHAPE_ROW).toBe(false);
    expect(SHAPE_ROW.attack_bonus ?? null).toBeNull();
  });

  it('Bat stamps walk 10/fly 40; Centipede walk 40/climb 40; Toad walk 40 NO swim (§571(a)); True Form reverts (null)', () => {
    expect(shapeShiftSpeedDict(BAT)).toEqual({ walk: '10 ft.', fly: '40 ft.' });
    expect(shapeShiftSpeedDict(CENTIPEDE)).toEqual({ walk: '40 ft.', climb: '40 ft.' });
    expect(shapeShiftSpeedDict(TOAD)).toEqual({ walk: '40 ft.' });
    expect(JSON.stringify(SHAPE_ROW.automation)).not.toMatch(/swim/);
    expect(isTrueFormRequest(BAT)).toBe(false);
    expect(isTrueFormRequest(CENTIPEDE)).toBe(false);
    expect(isTrueFormRequest(TOAD)).toBe(false);
    expect(shapeShiftSpeedDict(TRUE_FORM)).toBeNull();
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
    expect(shapeShiftSpeedText(BAT)).toBe('walk 10 ft., fly 40 ft.');
    expect(shapeShiftSpeedText(TOAD)).toBe('walk 40 ft.');
    expect(shapeShiftSpeedText(TRUE_FORM)).toBe('true-form');
  });

  it('At Will RAW: no uses/maxUses/usage authored — MA-0020 gate stays honestly null (§230)', () => {
    expect(SHAPE_ROW.uses).toBeUndefined();
    expect(SHAPE_ROW.maxUses).toBeUndefined();
    expect(SHAPE_ROW.usage).toBeUndefined();
  });

  it('byte-inert siblings: Rend, Scare and the pre-fix prose-only shape never arm', () => {
    expect(isMonsterShapeShiftRow(REND_ROW)).toBe(false);
    expect(isMonsterShapeShiftRow(SCARE_ROW)).toBe(false);
    expect(isMonsterShapeShiftRow({ name: SHAPE_ROW.name, description: SHAPE_DESC, attack_bonus: 0 })).toBe(false);
  });
});

describe('MA-1371 apply — ONE merged cs POST stamps form Speed; revert clears; NO clock, NO te', () => {
  it('Bat: single cs POST with speed dict + shapeShiftForm on the quasit only; other combatants untouched', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(BAT, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(false);
    expect(deps.writes).toHaveLength(1);
    const entry = deps.writes[0].creatures.find(c => c.name === 'Quasit 1');
    expect(entry.speed).toEqual({ walk: '10 ft.', fly: '40 ft.' });
    expect(entry.shapeShiftForm).toBe('Bat');
    expect(entry.currentHp).toBe(25);
    const bandit = deps.writes[0].creatures.find(c => c.name === 'Bandit 1');
    expect(bandit.speed).toBeUndefined();
    expect(bandit.shapeShiftForm).toBeUndefined();
    const applied = deps.logs.find(e => e.automationType === 'shape_shift_applied');
    expect(applied).toBeTruthy();
    expect(applied.characterName).toBe('Quasit 1');
    expect(applied.abilityName).toBe('Shape-Shift');
    expect(applied.description).toContain('shape-shifts into Bat');
    expect(applied.description).toContain('walk 10 ft., fly 40 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Bat'));
  });

  it('Centipede/Toad ride same seam (climb stamped, no swim written); already-in-form refuses with zero second POST', async () => {
    const deps = makeDeps();
    const centipede = await apply(CENTIPEDE, deps, vi.fn());
    expect(centipede.resolved).toBe(true);
    expect(deps.writes[0].creatures.find(c => c.name === 'Quasit 1').speed).toEqual({ walk: '40 ft.', climb: '40 ft.' });
    const again = await apply(CENTIPEDE, deps, vi.fn());
    expect(again).toEqual({ resolved: false, reason: 'already_in_form' });
    expect(deps.writes).toHaveLength(1);
    expect(deps.logs.find(e => e.automationDetail === 'already_in_centipede_form')).toBeTruthy();
    const toad = await apply(TOAD, deps, vi.fn());
    expect(toad.resolved).toBe(true);
    expect(deps.writes[1].creatures.find(c => c.name === 'Quasit 1').speed).toEqual({ walk: '40 ft.' });
    expect(JSON.stringify(deps.writes)).not.toMatch(/swim/);
  });

  it('True Form revert: clears stamp + marker, logs restored stat-block Speed read from disk', async () => {
    const deps = makeDeps();
    await apply(BAT, deps);
    const setPopupHtml = vi.fn();
    const result = await apply(TRUE_FORM, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(true);
    expect(deps.writes).toHaveLength(2);
    const entry = deps.writes[1].creatures.find(c => c.name === 'Quasit 1');
    expect(entry.speed).toBeUndefined();
    expect(entry.shapeShiftForm).toBeUndefined();
    const reverted = deps.logs.find(e => e.automationType === 'shape_shift_reverted');
    expect(reverted).toBeTruthy();
    const diskSpeed = quasit.speed;
    expect(reverted.description).toContain(Object.entries(diskSpeed).map(([k, v]) => `${k} ${v}`).join(', '));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('true form'));
  });

  it('True-Form-while-true refuses zero-write; no clock / no te anywhere in the flow (§70)', async () => {
    const deps = makeDeps();
    const revert = await apply(TRUE_FORM, deps, vi.fn());
    expect(revert).toEqual({ resolved: false, reason: 'already_true_form' });
    expect(deps.writes).toHaveLength(0);
    await apply(BAT, deps);
    await apply(TRUE_FORM, deps);
    expect(JSON.stringify(deps.writes)).not.toMatch(/expir|shape_shifted/);
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
  });
});
