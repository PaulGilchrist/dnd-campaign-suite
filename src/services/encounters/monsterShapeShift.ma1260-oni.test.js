// @maintained-by-ai
// MA-1260: Oni "Shape-Shift" — formerly a junk attack_bonus:0 row rendering
// a lone clickable "+0" chip that rolled a bogus to-hit (live audit: press →
// roll/attack name:'Shape-Shift', lastAttack ABSENT). Fix = DATA-only:
// attack_bonus key REMOVED (§490 "+0" leg killed, imp MA-1020 twin has no
// key) + automation:{type:"monster_shape_shift", effect:"shape_shift",
// forms:[Humanoid, Giant, True Form]} authored per the Imp/Lizardfolk-Shaman
// byte-shape → ShapeShiftLink chooser → resolveMonsterShapeShiftRow ONE
// merged cs POST stamping shapeShiftForm + Speed dict (§39).
// RAW pins: Humanoid/Giant walk 30 ft. (oni base walk 30 — speed unchanged;
// the two form dicts are byte-IDENTICAL, the form NAME is the only
// differentiator, so the stamp leg is form-agnostic per imp dict-table
// consolidation). "True Form" revert clears the stamp; restored Speed text is
// the literal oni disk dict — junk empty legs and all, never computed
// in-test (#1149 lesson). Economy: At Will per disk (no uses/maxUses/usage
// keys; §230 gate null owned by imp). §70 honest residuals (do NOT pin as
// working): size swap unmodeled (zero consumer), no expiration clock (GM
// re-click), equipment non-transformation stays prose.
//
// Lane cite table — shapeShift family (NO base test file; MA-1020 imp is the
// origin lane owning generics, this file stays byte-distinct per #976):
//   imp MA-1020 origin — generics owned THERE, cited not re-driven:
//     discriminator guards + byte-inert sibling/no-form census (imp "row
//     guards" test), Speed-dict/text builders incl. walk-only dict, true-form
//     null and speed-text bytes (imp "dict table" test), refusals it.each
//     already_in_form/already_true_form/no_combat_summary_entry + refusal
//     popup copy (#903 table), modal seam resolve/decline, whole-DB armed
//     census (oni/Shape-Shift armed-entry pinned THERE), §230 At-Will gate.
//   THIS file owns: oni row verbatim disk bytes + attack_bonus key ABSENT
//   (the MA-1260 junk-"+0" fix), Humanoid→Giant form-switch press (same
//   seam, walk 30 ft. stamp, one POST per press, store-backed latch #949),
//   and the revert disk-backstop literal "walk 30 ft., fly 30 ft. (hover),
//   swim , climb , burrow , other " — ASCII apostrophes verified on disk
//   against SHAPE_DESC (#1149 byte-false precedent). Raw-split verdict:
//   whole-DB fix-byte split NOT unique-worthy — imp's semantic armed census
//   covers the arming set and test 1 pins the fix bytes via parsed JSON;
//   other rows' junk attack_bonus:0 (e.g. oni/Spellcasting) is out of this
//   ticket's scope (#1121 extend-until-count stays imp-side).
// Old->new map (consolidations): old "attack_bonus key ABSENT"→1 (fix-byte
// fold; old `?? null` line was a tautology of the `in` check); old "speed
// dict builders"→1 ticket bytes only (builder generics cite imp dict table);
// old "byte-inert twins Claw/prose-only"→REMOVED (imp row guards cover the
// no-automation/attack_bonus-only guard, #1149 precedent); old "Giant rides
// same seam + already_in_form"→2 form-switch press (refusal vocab cites imp
// #903 it.each); old "True-Form-while-true refuses zero-write + no clock/no
// te census"→REMOVED (imp it.each row 2 owns already_true_form; no-clock
// probe folded inline into 2, #1149 rec).
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

const oni = monstersData.find(m => m.index === 'oni');
const SHAPE_ROW = oni.actions[3];
const SHAPE_DESC = "The oni <strong>shape-shifts</strong> into a Small or Medium Humanoid or a Large Giant, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.";
const HUMANOID = SHAPE_ROW.automation.forms[0];
const GIANT = SHAPE_ROW.automation.forms[1];
const TRUE_FORM = SHAPE_ROW.automation.forms[2];
// Literal disk-backstop (#1149 lesson): the FULL oni.speed dict on disk,
// empty junk legs included — this is exactly what resolveTrueFormSpeedText
// joins into the revert log. Edit disk? this literal changes. Intentional.
const ONI_DISK_SPEED = 'walk 30 ft., fly 30 ft. (hover), swim , climb , burrow , other ';

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
  const box = { cs }; // store-backed latch (#949): double-press refusals read the ADVANCED cs, not a mock
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

afterEach(() => {
  vi.restoreAllMocks(); // #1007 — no spy leaks on failed assertions
});

describe('MA-1260 Oni Shape-Shift disk data — junk "+0" chip replaced, MA-1020 byte-shape', () => {
  it('actions[3] verbatim by name: monster_shape_shift Humanoid/Giant walk 30 + True Form; attack_bonus key ABSENT (junk chip can never re-arm); description byte-unchanged; At Will per disk (§230 gate imp-owned)', () => {
    expect(SHAPE_ROW.name).toBe('Shape-Shift');
    expect(SHAPE_ROW.description).toBe(SHAPE_DESC); // ASCII apostrophe — byte-matches disk (#1149 check)
    expect('attack_bonus' in SHAPE_ROW).toBe(false); // key-absent-not-null: pre-fix disk had attack_bonus:0
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
    expect(SHAPE_ROW.uses).toBeUndefined(); // At Will, honest disk read
    // Ticket dict bytes (RAW: base walk 30, unchanged; builders' generics cite imp dict table):
    expect(shapeShiftSpeedDict(HUMANOID)).toEqual({ walk: '30 ft.' });
    expect(shapeShiftSpeedDict(GIANT)).toEqual({ walk: '30 ft.' }); // byte-identical form dicts
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
  });
});

describe('MA-1260 apply — ONE merged cs POST per press, form-switch same seam; NO clock, NO te', () => {
  it('Humanoid press stamps {walk:"30 ft."} + form_humanoid on the oni only; re-press switches to Giant via the same seam (one POST each); bystander byte-untouched; logs+popup honest, no clock no te inline (§39/§70)', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(HUMANOID, deps, setPopupHtml);
    expect(result).toMatchObject({ resolved: true, revert: false, form: 'Humanoid', speed: { walk: '30 ft.' } });
    expect(deps.writes).toHaveLength(1); // ONE merged POST (§39)
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
    expect(applied.automationDetail).toBe('form_humanoid'); // form_slug detail (#1149 shape)
    expect(applied.description).toContain('shape-shifts into Humanoid');
    expect(applied.description).toContain('walk 30 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Humanoid'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('walk 30 ft.'));
    // Form-switch press (in-Humanoid → Giant): distinct-name branch of the SAME
    // form-agnostic stamp leg, giant byte walk 30. already_in_form/already_true_form
    // refusal vocab + popup copy + zero-write census are imp #903 it.each-owned.
    const giant = await apply(GIANT, deps, vi.fn());
    expect(giant).toMatchObject({ resolved: true, revert: false, form: 'Giant', speed: { walk: '30 ft.' } });
    expect(deps.writes).toHaveLength(2); // exactly one POST per press, store-backed latch read (#949)
    expect(deps.writes[1].creatures.find(c => c.name === 'Oni 1').shapeShiftForm).toBe('Giant');
    expect(deps.logs.filter(e => e.automationType === 'shape_shift_applied')).toHaveLength(2);
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true); // zero ability_use spend, At Will
    expect(JSON.stringify(deps.writes)).not.toMatch(/expir|shape_shifted/); // no clock, no te (§70, folded inline #1149)
  });
});

describe('MA-1260 revert — True Form clears the stamp, log restores the LITERAL oni disk Speed', () => {
  it('True Form after a shift: ONE POST clears speed + marker, logs disk-backstop "walk 30 ft., fly 30 ft. (hover), swim , climb , burrow , other" — literal, never computed (#1149 lesson)', async () => {
    expect(oni.speed).toEqual({ walk: '30 ft.', fly: '30 ft. (hover)', swim: '', climb: '', burrow: '', other: [] }); // disk-backstop for the literal below
    const deps = makeDeps();
    await apply(HUMANOID, deps);
    const setPopupHtml = vi.fn();
    const result = await apply(TRUE_FORM, deps, setPopupHtml);
    expect(result).toMatchObject({ resolved: true, revert: true, speed: null });
    expect(deps.writes).toHaveLength(2); // shift + revert, one POST each
    const entry = deps.writes[1].creatures.find(c => c.name === 'Oni 1');
    expect(entry.speed).toBeUndefined();
    expect(entry.shapeShiftForm).toBeUndefined();
    const reverted = deps.logs.find(e => e.automationType === 'shape_shift_reverted');
    expect(reverted).toBeTruthy();
    expect(reverted.automationDetail).toBe('revert_true_form');
    expect(reverted.description).toContain(ONI_DISK_SPEED); // junk empty legs honestly logged
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('true form'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(ONI_DISK_SPEED));
  });
});
