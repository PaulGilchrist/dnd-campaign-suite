// @maintained-by-ai
// MA-1113: Lizardfolk Shaman "Change Shape (Recharges after a Short or Long
// Rest)" — formerly a zero-affordance dead prose row (name + description ONLY;
// live audit: 0 interactive elements in the open .mc-action, 0 popups / 0 log
// delta on fresh-rect clicks). NOW one-field DATA fix mirroring the MA-1020
// imp Shape-Shift byte-shape: automation:{type:"monster_shape_shift",
// effect:"shape_shift", forms:[Crocodile, True Form]} arms ShapeShiftLink
// (MonsterAction.jsx) → ShapeShiftModal chooser → resolveMonsterShapeShiftRow
// (ONE merged cs POST stamping shapeShiftForm + Speed dict, §39).
// RAW pins: Crocodile walk 20 ft. (crocodile disk block walk 20 ft., swim
// 30 ft. — the seam stamps walk/fly/climb only, so the swim leg is NOT
// carried: honest residual, never pin it as working); shaman own disk block
// walk 30 ft., swim 30 ft. restores on revert via loadMonsters read-back.
// Clock-less model by design (§70 / "until shift back") — no expiration, no
// te, no stat-swap. Advisory residuals (do NOT pin as working): swim stamp,
// statistics/size swap, revert-on-death, bonus-action economy, "Recharges
// after a Short or Long Rest" rest-rearm (§70 zero-consumer — name text stays
// cosmetic, no gate to test here).
//
// Lane cite table — shapeShift family (NO base test file; MA-1020 imp is the
// origin lane owning generics, this file stays byte-distinct per #976):
//   imp MA-1020 origin — generics owned THERE, cited not re-driven:
//     discriminator guards + byte-inert census (imp "row guards" test),
//     Speed-dict/text builders incl. walk-only {walk:"20 ft."} and
//     true-form null bytes (imp dict table), refusals it.each already_in_
//     form/already_true_form/no_combat_summary_entry (#903 table), modal
//     seam resolve/decline, whole-DB armed census incl. lizardfolk row,
//     §230 At-Will gate.
//   THIS file owns: Crocodile walk 20 stamp (swim-residual excluded) +
//   shaman own disk revert bytes "swim 30 ft., walk 30 ft." (#1148 verdict).
// Old->new map (consolidations): old "Crocodile speed dict"→1 (ticket dict
// pin; builder generics cite imp); old "byte-inert twins"→removed (imp row
// guards cover no-automation/empty-forms guard); old "no clock/no te"→
// folded into apply (own apply assertions, #1148 rec); old "refusals pair"→
// removed (imp #903 it.each owns the generic vocab).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMonsterShapeShiftRow,
  shapeShiftForms,
  shapeShiftSpeedDict,
  isTrueFormRequest,
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

afterEach(() => {
  vi.restoreAllMocks(); // #1007 — no spy leaks on failed assertions
});

describe('MA-1113 Lizardfolk Shaman Change Shape disk data — MA-1020 byte-shape, Crocodile walk 20 only', () => {
  it('actions[3] authors monster_shape_shift with Crocodile(speed 20)+True Form; description byte-unchanged; croc stamp dict is walk-only (croc disk swim 30 ft. NOT carried)', () => {
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
    expect(shapeShiftSpeedDict(CROC)).toEqual({ walk: '20 ft.' });
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
  });
});

describe('MA-1113 apply/revert — the ticket-owned lane: ONE merged cs POST stamps Crocodile; revert restores shaman disk Speed (§39/§70)', () => {
  it('Crocodile: single cs POST stamps {walk:"20 ft."} + shapeShiftForm on the shaman only; bystander untouched; honest log+popup, no clock no te inline', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(CROC, deps, setPopupHtml);
    expect(result).toMatchObject({ resolved: true, revert: false, form: 'Crocodile', speed: { walk: '20 ft.' } });
    expect(deps.writes).toHaveLength(1); // ONE merged POST (§39)
    const entry = deps.writes[0].creatures.find(c => c.name === 'Lizardfolk Shaman 1');
    expect(entry.speed).toEqual({ walk: '20 ft.' }); // toEqual: swim never stamped (residual)
    expect(entry.shapeShiftForm).toBe('Crocodile');
    expect(entry.currentHp).toBe(27);
    const bandit = deps.writes[0].creatures.find(c => c.name === 'Bandit 1');
    expect(bandit.speed).toBeUndefined();
    expect(bandit.shapeShiftForm).toBeUndefined();
    const applied = deps.logs.find(e => e.automationType === 'shape_shift_applied');
    expect(applied).toBeTruthy();
    expect(applied.characterName).toBe('Lizardfolk Shaman 1');
    expect(applied.abilityName).toBe('Change Shape (Recharges after a Short or Long Rest)');
    expect(applied.automationDetail).toBe('form_crocodile');
    expect(applied.description).toContain('shape-shifts into Crocodile');
    expect(applied.description).toContain('walk 20 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
    expect(JSON.stringify(deps.writes)).not.toMatch(/expir|shape_shifted/); // no clock, no te (§70, folded #1148)
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Crocodile'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('walk 20 ft.'));
  });

  it('True Form revert: clears stamp + marker and logs the restored shaman disk Speed — backstop walk 30 ft./swim 30 ft.', async () => {
    expect(shaman.speed).toEqual({ swim: '30 ft.', walk: '30 ft.' });
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
    expect(reverted.description).toContain('swim 30 ft., walk 30 ft.'); // disk read-back, never computed in-test
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('true form'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('swim 30 ft., walk 30 ft.'));
  });
});
