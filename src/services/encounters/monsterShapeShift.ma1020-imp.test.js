// MA-1020: Imp "Shape-Shift" — formerly a zero-affordance dead prose row
// (name + description ONLY; MA-1020 audit: 0 buttons/chips/pointer children,
// 0 whole-log shape-shift transport). NOW a dedicated `monster_shape_shift`
// automation lane (orchestrator-sanctioned new consumer, mirroring the
// MA-0655 monsterSelfBuff byte-shape + the MA-0275 chooser chrome): chip
// press → ShapeShiftModal form chooser → ONE row click stamps the chosen
// form's Speed dict onto the combatSummary combatant via ONE merged
// storage.set('combatSummary') POST (§39). LIVE consumer evidence:
// createNpcClickHandler → NPC_FORM_HANDLERS runMonster honors
// runtimeCreature.speed (npcClickFormHandlers.js:188) → MonsterCardBody
// Speed row renders Object.entries(monster.speed) (MonsterCardBody.jsx:147)
// — the stamped dict is exactly what the card shows on reopen.
// RAW pins: forms Rat 20 walk / Raven 20+Fly60 / Spider 20+Climb20 / true
// form; statistics same except Speed; At Will → no uses/maxUses, MA-0020
// gate null (§230); duration "until it shifts back" → NO addExpiration clock
// (§70 persistent self-state, honest). te `shape_shift` stays ONLY the
// save-modifier context key (conditionEffectsInternal.js) — no te registered
// or stamped here. "True Form" deletes the stamp so runMonster restores the
// authored stat-block Speed (imp disk block: walk 20 ft., fly 40 ft.).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterShapeShiftRow,
  shapeShiftForms,
  shapeShiftSpeedDict,
  isTrueFormRequest,
  shapeShiftSpeedText,
  resolveMonsterShapeShiftRow,
  resolveShapeShiftSelection,
  declineShapeShiftSelection,
  buildShapeShiftAppliedLog,
  buildShapeShiftRefusalPopup,
} from './monsterShapeShift.js';
import { monsterAbilitySaveUsesGate } from './monsterAbilityUses.js';
import { isUtilitySpellCastRow } from '../../components/encounter/MonsterCardHelpers.js';
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

const imp = monstersData.find(m => m.index === 'imp');
const SHAPE_ROW = imp.actions[2];
const STING_ROW = imp.actions[0];
const INVIS_ROW = imp.actions[1];
const SHAPE_DESC = "The imp <strong>shape-shifts</strong> to resemble a rat (Speed 20 ft.), a raven (20 ft., Fly 60 ft.), or a spider (20 ft., Climb 20 ft.), or it returns to its true form. Its game statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.";
const RAT = SHAPE_ROW.automation.forms[0];
const RAVEN = SHAPE_ROW.automation.forms[1];
const SPIDER = SHAPE_ROW.automation.forms[2];
const TRUE_FORM = SHAPE_ROW.automation.forms[3];

function makeCs() {
  return {
    round: 2,
    creatures: [
      { name: 'Imp 1', monsterIndex: 'imp', currentHp: 21, maxHp: 21 },
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
    monsterName: 'Imp 1',
    campaignName: 'test-campaign',
    setPopupHtml,
    deps,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MA-1020 Imp Shape-Shift disk data — dedicated monster_shape_shift lane, At Will', () => {
  it('imp actions[2] authors monster_shape_shift automation with the four RAW forms; description byte-unchanged', () => {
    expect(SHAPE_ROW.name).toBe('Shape-Shift');
    expect(SHAPE_ROW.description).toBe(SHAPE_DESC);
    expect(SHAPE_ROW.automation).toEqual({
      type: 'monster_shape_shift',
      effect: 'shape_shift',
      forms: [
        { name: 'Rat', speed: 20 },
        { name: 'Raven', speed: 20, fly: 60 },
        { name: 'Spider', speed: 20, climb: 20 },
        { name: 'True Form' },
      ],
    });
    expect(isMonsterShapeShiftRow(SHAPE_ROW)).toBe(true);
    expect(shapeShiftForms(SHAPE_ROW).map(f => f.name)).toEqual(['Rat', 'Raven', 'Spider', 'True Form']);
  });

  it('At Will RAW: no uses/maxUses/usage authored — MA-0020 gate stays honestly null (§230)', () => {
    expect(SHAPE_ROW.uses).toBeUndefined();
    expect(SHAPE_ROW.maxUses).toBeUndefined();
    expect(SHAPE_ROW.usage).toBeUndefined();
    expect(monsterAbilitySaveUsesGate(SHAPE_ROW, {})).toBeNull();
  });

  it('siblings byte-inert + the MA-1014 utility census never arms this row (automation exclusion §429)', () => {
    expect(isMonsterShapeShiftRow(STING_ROW)).toBe(false);
    expect(isMonsterShapeShiftRow(INVIS_ROW)).toBe(false);
    expect(isMonsterShapeShiftRow({ name: 'X', automation: { type: 'monster_shape_shift' } })).toBe(false);
    expect(isMonsterShapeShiftRow({ name: 'X', automation: { type: 'monster_shape_shift', forms: [] } })).toBe(false);
    expect(isUtilitySpellCastRow(SHAPE_ROW)).toBe(false);
  });

  it('whole-database scan: monster_shape_shift arms imp/Shape-Shift + MA-1113 lizardfolk-shaman/Change Shape + MA-1260 oni/Shape-Shift (pin inverted post-MA-1113/MA-1260 §216)', () => {
    const armed = [];
    for (const mo of monstersData) {
      for (const key of ['actions', 'legendary_actions', 'reactions']) {
        for (const a of Array.isArray(mo[key]) ? mo[key] : []) {
          if (a && typeof a === 'object' && isMonsterShapeShiftRow(a)) armed.push(`${mo.index}/${a.name}`);
        }
      }
    }
    expect(armed).toEqual(['imp/Shape-Shift', 'lizardfolk-shaman/Change Shape (Recharges after a Short or Long Rest)', 'oni/Shape-Shift']);
  });
});

describe('MA-1020 Speed dict builders — stat-block shape the card renderer reads', () => {
  it('rat / raven / spider stamp walk+mode dicts; True Form reverts (null)', () => {
    expect(shapeShiftSpeedDict(RAT)).toEqual({ walk: '20 ft.' });
    expect(shapeShiftSpeedDict(RAVEN)).toEqual({ walk: '20 ft.', fly: '60 ft.' });
    expect(shapeShiftSpeedDict(SPIDER)).toEqual({ walk: '20 ft.', climb: '20 ft.' });
    expect(shapeShiftSpeedDict(TRUE_FORM)).toBeNull();
    expect(isTrueFormRequest(TRUE_FORM)).toBe(true);
    expect(isTrueFormRequest(RAVEN)).toBe(false);
    expect(shapeShiftSpeedText(RAVEN)).toBe('walk 20 ft., fly 60 ft.');
    expect(shapeShiftSpeedText(TRUE_FORM)).toBe('true-form');
  });

  it('imp authored true-form Speed on disk is walk 20 ft., fly 40 ft. (revert backstop)', () => {
    expect(imp.speed).toEqual({ walk: '20 ft.', fly: '40 ft.' });
  });
});

describe('MA-1020 apply — ONE merged cs POST stamps the Speed dict; NO clock, NO te', () => {
  it('Raven: single full-store cs POST with speed dict + shapeShiftForm on the Imp only; other combatants byte-untouched', async () => {
    const deps = makeDeps();
    const setPopupHtml = vi.fn();
    const result = await apply(RAVEN, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(false);
    expect(deps.writes).toHaveLength(1); // ONE merged POST (§39)
    const impEntry = deps.writes[0].creatures.find(c => c.name === 'Imp 1');
    expect(impEntry.speed).toEqual({ walk: '20 ft.', fly: '60 ft.' });
    expect(impEntry.shapeShiftForm).toBe('Raven');
    expect(impEntry.currentHp).toBe(21);
    const banditEntry = deps.writes[0].creatures.find(c => c.name === 'Bandit 1');
    expect(banditEntry.speed).toBeUndefined();
    expect(banditEntry.shapeShiftForm).toBeUndefined();
    const applied = deps.logs.find(e => e.automationType === 'shape_shift_applied');
    expect(applied).toBeTruthy();
    expect(applied.characterName).toBe('Imp 1');
    expect(applied.abilityName).toBe('Shape-Shift');
    expect(applied.description).toContain('walk 20 ft., fly 60 ft.');
    expect(applied.description).toContain('no expiration clock');
    expect(deps.logs.some(e => e.type === 'ability_use')).toBe(false); // At Will zero spend
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Raven'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('walk 20 ft., fly 60 ft.'));
  });

  it('Rat stamps walk-only; Spider stamps walk+climb (no stray fly)', async () => {
    const deps = makeDeps();
    await apply(RAT, deps);
    expect(deps.writes[0].creatures.find(c => c.name === 'Imp 1').speed).toEqual({ walk: '20 ft.' });
    const deps2 = makeDeps();
    await apply(SPIDER, deps2);
    expect(deps2.writes[0].creatures.find(c => c.name === 'Imp 1').speed).toEqual({ walk: '20 ft.', climb: '20 ft.' });
  });

  it('True Form: clears stamp + marker with ONE POST and logs the restored stat-block Speed read from disk', async () => {
    const deps = makeDeps();
    await apply(RAT, deps);
    const setPopupHtml = vi.fn();
    const result = await apply(TRUE_FORM, deps, setPopupHtml);
    expect(result.resolved).toBe(true);
    expect(result.revert).toBe(true);
    expect(deps.writes).toHaveLength(2);
    const impEntry = deps.writes[1].creatures.find(c => c.name === 'Imp 1');
    expect(impEntry.speed).toBeUndefined();
    expect(impEntry.shapeShiftForm).toBeUndefined();
    const reverted = deps.logs.find(e => e.automationType === 'shape_shift_reverted');
    expect(reverted).toBeTruthy();
    expect(reverted.description).toContain('walk 20 ft., fly 40 ft.');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('walk 20 ft., fly 40 ft.'));
  });

  it('no clock, no te, no targetEffects write anywhere in the flow (RAW persists until shift-back §70)', async () => {
    const deps = makeDeps();
    await apply(RAVEN, deps);
    expect(deps.writes).toHaveLength(1);
    expect(JSON.stringify(deps.writes[0])).not.toMatch(/expir|shape_shifted/);
    expect(deps.logs.every(e => e.type === 'automation')).toBe(true);
  });
});

describe('MA-1020 refusals — zero-write, zero-spend, honest popup+log', () => {
  it('re-pick of the standing form: shape_shift_refused / already_in_raven_form, no second POST', async () => {
    const deps = makeDeps();
    await apply(RAVEN, deps);
    const setPopupHtml = vi.fn();
    const again = await apply(RAVEN, deps, setPopupHtml);
    expect(again).toEqual({ resolved: false, reason: 'already_in_form' });
    expect(deps.writes).toHaveLength(1);
    const refusal = deps.logs.find(e => e.automationType === 'shape_shift_refused');
    expect(refusal).toBeTruthy();
    expect(refusal.automationDetail).toBe('already_in_raven_form');
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Shape-Shift Refused'));
  });

  it('True Form while already true: already_true_form refusal, zero writes', async () => {
    const deps = makeDeps();
    const result = await apply(TRUE_FORM, deps);
    expect(result).toEqual({ resolved: false, reason: 'already_true_form' });
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs.find(e => e.automationDetail === 'already_true_form')).toBeTruthy();
  });

  it('missing cs combatant: console.error + honest refusal, zero POST', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps({ cs: null });
    const result = await apply(RAVEN, deps);
    expect(result).toEqual({ resolved: false, reason: 'no_combat_summary_entry' });
    expect(deps.writes).toHaveLength(0);
    expect(errSpy).toHaveBeenCalled();
    expect(deps.logs.find(e => e.automationDetail === 'no_combat_summary_entry')).toBeTruthy();
    errSpy.mockRestore();
  });

  it('non-shape-shift rows and formless resolves are byte-inert', async () => {
    const deps = makeDeps();
    expect(await resolveMonsterShapeShiftRow({ action: STING_ROW, form: RAVEN, monsterName: 'Imp 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), deps })).toEqual({ resolved: false, reason: 'not-shape-shift' });
    expect(await resolveMonsterShapeShiftRow({ action: SHAPE_ROW, form: null, monsterName: 'Imp 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), deps })).toEqual({ resolved: false, reason: 'no-form' });
    expect(await resolveMonsterShapeShiftRow()).toEqual({ resolved: false, reason: 'not-shape-shift' });
    expect(deps.writes).toHaveLength(0);
    expect(deps.logs).toHaveLength(0);
  });
});

describe('MA-1020 modal seam — chooser resolve/decline wrappers', () => {
  it('resolveShapeShiftSelection closes the chooser then stamps the picked form', async () => {
    const deps = makeDeps();
    const setChooser = vi.fn();
    const chooser = { action: SHAPE_ROW };
    const result = await resolveShapeShiftSelection({ chooser, form: SPIDER, monsterName: 'Imp 1', campaignName: 'test-campaign', setPopupHtml: vi.fn(), setChooser, deps });
    expect(setChooser).toHaveBeenCalledWith(null);
    expect(result.resolved).toBe(true);
    expect(deps.writes[0].creatures.find(c => c.name === 'Imp 1').speed).toEqual({ walk: '20 ft.', climb: '20 ft.' });
  });

  it('declineShapeShiftSelection: zero writes, shape_shift_declined record; empty chooser logs nothing', async () => {
    const deps = makeDeps();
    const setChooser = vi.fn();
    await declineShapeShiftSelection({ chooser: { action: SHAPE_ROW }, monsterName: 'Imp 1', campaignName: 'test-campaign', setChooser, deps });
    expect(setChooser).toHaveBeenCalledWith(null);
    expect(deps.writes).toHaveLength(0);
    const decline = deps.logs.find(e => e.automationType === 'shape_shift_declined');
    expect(decline).toBeTruthy();
    expect(decline.automationDetail).toBe('chooser_cancelled');
    const deps2 = makeDeps();
    await declineShapeShiftSelection({ chooser: null, monsterName: 'Imp 1', campaignName: 'test-campaign', setChooser: vi.fn(), deps: deps2 });
    expect(deps2.logs).toHaveLength(0);
  });

  it('popup refusal copy names the form and the At-Will re-click path', () => {
    const popup = buildShapeShiftRefusalPopup({ monsterName: 'Imp 1', form: RAVEN, reason: 'already_in_raven_form' });
    expect(popup).toContain('already in raven form');
    expect(popup).toContain('Raven');
    const grant = buildShapeShiftAppliedLog({ monsterName: 'Imp 1', action: SHAPE_ROW, form: RAT, speedText: 'walk 20 ft.' });
    expect(grant.description).toContain('shape-shifts into Rat');
    expect(grant.description).toContain('§70');
  });
});
