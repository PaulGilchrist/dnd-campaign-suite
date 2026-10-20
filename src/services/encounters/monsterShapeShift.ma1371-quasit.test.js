// @maintained-by-ai
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
// NEVER consumes (§571(a) no-swim core, #1148 verdict "Bat-Centipede-Toad
// no-swim §571(a)"): honest ABSENT-key pins (#945), never empty strings,
// across disk dict, stamp POSTs, and logs. "True Form" revert clears the
// stamp; restored Speed text is the LITERAL quasit disk dict — junk empty
// legs included, never computed in-test (#1149/#1150 VERBATIM lesson).
// §70 honest residuals (do NOT pin as working): size/stat swap, revert-on-rest.
//
// Lane cite table — shapeShift family (NO base test file; MA-1020 imp is the
// origin lane owning generics, this file stays byte-distinct per #976):
//   imp MA-1020 origin — generics owned THERE, cited not re-driven:
//     discriminator guards + byte-inert sibling/no-form/foreign zero-write
//     census (imp "row guards" test, #1035/#1026), Speed-dict/text builders
//     incl. walk-only dict, walk+climb dict (imp Spider stamp via modal
//     seam — so Centipede's apply ride is form-agnostic, cited), true-form
//     null + 'true-form' text, refusals it.each already_in_form/
//     already_true_form/no_combat_summary_entry + refusal popup copy/titles
//     (#903/#910 table), modal seam resolve/decline, whole-DB armed census
//     ("quasit/Shape-Shift" armed entry pinned THERE, §216), §230 At-Will
//     gate (monsterAbilitySaveUsesGate null), te golden #1012.
//   THIS file owns: quasit row verbatim disk bytes + attack_bonus key ABSENT
//   (the MA-1371 junk-"+0" fix), the §571(a) NO-swim absent-key core in
//   dict + stamp + logs, Bat→Toad honest-distinct form-switch press (walk
//   10+fly40 → walk 40, real dict change — oni #1150 same-mechanism but
//   byte-identical dicts; here the switch carries DISTINCT bytes), and the
//   revert disk-backstop literal "walk 40 ft., fly , swim , climb , burrow ,
//   other " — ASCII apostrophes audited on disk vs SHAPE_DESC (#1149
//   byte-false precedent). selfBuff quasit-invisibility.test.js (#1142)
//   owns ITS Invisibility mirror cut — the shape bytes are HERE.
// Old->new map (consolidations): old "disk automation+desc"+old "attack_bonus
// ABSENT"+old "At Will §230"+old "dict builders table"→1 (disk verbatim BY
// NAME fold #1086/#1094/#993; old `?? null` line was a tautology of the `in`
// check, dropped #1150); old "byte-inert siblings Rend/Scare/prose-only"→
// REMOVED (imp row guards own the no-automation/attack_bonus-only guard,
// #1148/#1149/#1150 precedent); old "Bat apply"→2 (no-clock/no-te probe
// folded inline #1149; form_slug detail 'form_bat' added #1149); old
// "Centipede/Toad ride + already_in_form"→2 form-switch press Bat→Toad
// (refusal vocab cites imp #903; Centipede apply rides imp's form-agnostic
// stamp — its disk bytes stay pinned in 1); old "True Form revert"→3
// (computed Object.entries().join() tautology replaced with literal bytes
// #1149/#1150); old "True-Form-while-true refuses + no clock/no te census"→
// REMOVED (imp it.each row 2 owns already_true_form; clock probe folded
// inline into 2/3).
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

const quasit = monstersData.find(m => m.index === 'quasit');
const SHAPE_ROW = quasit.actions[3];
const SHAPE_DESC = "The quasit <strong>shape-shifts</strong> to resemble a bat (Speed 10 ft., Fly 40 ft.), a centipede (40 ft., Climb 40 ft.), or a toad (40 ft., Swim 40 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.";
const BAT = SHAPE_ROW.automation.forms[0];
const CENTIPEDE = SHAPE_ROW.automation.forms[1];
const TOAD = SHAPE_ROW.automation.forms[2];
const TRUE_FORM = SHAPE_ROW.automation.forms[3];
// Literal disk-backstop (#1149/#1150 VERBATIM): the FULL quasit.speed dict on
// disk, empty junk legs included — exactly what resolveTrueFormSpeedText joins
// into the revert log. Edit disk? this literal changes. Intentional.
const QUASIT_DISK_SPEED = 'walk 40 ft., fly , swim , climb , burrow , other ';

function makeCs() {
  return {
    round: 1,
    creatures: [
      { name: 'Quasit 1', monsterIndex: 'quasit', currentHp: 25, maxHp: 25 },
      { name: 'Bandit 1', monsterIndex: 'bandit', currentHp: 11, maxHp: 11 }, // decoy bystander #948/#1057
    ],
  };
}

function makeDeps({ cs = makeCs(), loadMonsters = monstersData } = {}) {
  const box = { cs }; // store-backed latch (#949): second press reads the ADVANCED cs, not a mock
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
    campaignName: 'test-campaign', // #932/#1019 campaign tuple
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

describe('MA-1371 Quasit Shape-Shift disk data — verbatim by name, junk "+0" killed, §571(a) NO swim authored', () => {
  it('actions[3] verbatim: monster_shape_shift Bat/Centipede/Toad/True Form; attack_bonus key ABSENT (junk chip can never re-arm); description byte-unchanged ASCII; Toad dict honest NO swim key (§571(a)); At Will per disk (§230 gate imp-owned)', () => {
    expect(SHAPE_ROW.name).toBe('Shape-Shift');
    expect(SHAPE_ROW.description).toBe(SHAPE_DESC); // ASCII apostrophe — byte-matches disk (#1149 audit)
    expect('attack_bonus' in SHAPE_ROW).toBe(false); // key-absent-not-null: pre-fix disk had attack_bonus:0
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
    expect(isMonsterShapeShiftRow(SHAPE_ROW)).toBe(true); // armed entry also census-pinned imp-side (whole-DB §216)
    expect(shapeShiftForms(SHAPE_ROW).map(f => f.name)).toEqual(['Bat', 'Centipede', 'Toad', 'True Form']);
    // Ticket dict bytes (builder generics + speedText cite imp dict table):
    expect(shapeShiftSpeedDict(BAT)).toEqual({ walk: '10 ft.', fly: '40 ft.' });
    expect(shapeShiftSpeedDict(CENTIPEDE)).toEqual({ walk: '40 ft.', climb: '40 ft.' });
    expect(shapeShiftSpeedDict(TOAD)).toEqual({ walk: '40 ft.' }); // honest ABSENT-key, not swim:'' (#945) — §571(a) core
    expect(JSON.stringify(SHAPE_ROW.automation)).not.toMatch(/swim/i); // advisory prose says "Swim 40 ft."; data never does
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
    expect(SHAPE_ROW.uses).toBeUndefined(); // At Will, honest disk read; gate null pin imp-owned (§230)
    expect(SHAPE_ROW.maxUses).toBeUndefined();
  });
});

describe('MA-1371 apply — ONE merged cs POST per press, honest-distinct form switch, NO swim ever written (§571(a))', () => {
  it('Bat press stamps {walk:"10 ft.",fly:"40 ft."} + form_bat on the quasit only; re-press switches to Toad via same seam (walk 40, DISTINCT bytes — no swim); bystander byte-untouched; logs+popup honest, no clock no te inline (§39/§70)', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(BAT, deps, setPopupHtml);
    expect(result).toMatchObject({ resolved: true, revert: false, form: 'Bat', speed: { walk: '10 ft.', fly: '40 ft.' } });
    expect(deps.writes).toHaveLength(1); // ONE merged POST (§39)
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
    expect(applied.automationDetail).toBe('form_bat'); // form_slug detail (#1149 shape)
    expect(applied.description).toContain('shape-shifts into Bat');
    expect(applied.description).toContain('walk 10 ft., fly 40 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Bat'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('walk 10 ft., fly 40 ft.'));
    // Form-switch press (in-Bat → Toad): honest-DISTINCT dicts (fly leg
    // drops), the §571(a) apply-side core — Toad stamps walk-only and NO
    // swim byte appears in ANY POST. already_in_form/already_true_form
    // refusal vocab + popup copy are imp #903 it.each-owned (cited).
    const toad = await apply(TOAD, deps, vi.fn());
    expect(toad).toMatchObject({ resolved: true, revert: false, form: 'Toad', speed: { walk: '40 ft.' } });
    expect(deps.writes).toHaveLength(2); // exactly one POST per press, store-backed latch read (#949)
    const toadEntry = deps.writes[1].creatures.find(c => c.name === 'Quasit 1');
    expect(toadEntry.speed).toEqual({ walk: '40 ft.' }); // ABSENT swim key in the stamp, not swim:'' (#945)
    expect(toadEntry.shapeShiftForm).toBe('Toad');
    expect(deps.logs.filter(e => e.automationType === 'shape_shift_applied')).toHaveLength(2);
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true); // zero ability_use spend, At Will
    expect(JSON.stringify(deps.writes)).not.toMatch(/swim/i); // §571(a): swim NEVER written
    expect(JSON.stringify(deps.writes)).not.toMatch(/expir|shape_shifted/); // no clock, no te (§70, folded inline #1149)
  });
});

describe('MA-1371 revert — True Form clears the stamp, log restores the LITERAL quasit disk Speed (#1149/#1150)', () => {
  it('True Form after a shift: ONE POST clears speed + marker, logs disk-backstop "walk 40 ft., fly , swim , climb , burrow , other" — literal, never computed (#1149 lesson)', async () => {
    expect(quasit.speed).toEqual({ walk: '40 ft.', fly: '', swim: '', climb: '', burrow: '', other: [] }); // disk-backstop for the literal below
    const deps = makeDeps();
    await apply(BAT, deps);
    const setPopupHtml = vi.fn();
    const result = await apply(TRUE_FORM, deps, setPopupHtml);
    expect(result).toMatchObject({ resolved: true, revert: true, speed: null });
    expect(deps.writes).toHaveLength(2); // shift + revert, one POST each
    const entry = deps.writes[1].creatures.find(c => c.name === 'Quasit 1');
    expect(entry.speed).toBeUndefined();
    expect(entry.shapeShiftForm).toBeUndefined();
    const reverted = deps.logs.find(e => e.automationType === 'shape_shift_reverted');
    expect(reverted).toBeTruthy();
    expect(reverted.automationDetail).toBe('revert_true_form');
    expect(reverted.description).toContain(QUASIT_DISK_SPEED); // junk empty legs honestly logged — literal bytes, no Object.entries join tautology (#1149)
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('true form'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining(QUASIT_DISK_SPEED));
  });
});
