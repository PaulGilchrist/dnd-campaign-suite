// @maintained-by-ai
// MA-1223 family base (#976 owner ruling, reaffirmed #1084): owns ALL generic
// normal-ACTION advisory machinery — detector admission/truthiness, popup/log
// builder chrome + honest fallback copy, one-press + refire record-only
// resolver. Consumers cite here and hold only their ticket rows.
//
// PRESERVED-CITED-BY (ranges refreshed to post-trim line numbers — ticket
// lanes delete-cite against THESE numbers):
//  - nalfeshnee MA-1224 Pursuit (#1084): detector truthiness (reactions
//    category leg :64), builder chrome :81-102, one-press :121-134, refire :136-146;
//  - uncanny-dodge MA-1285 (#1085): detector truthiness incl. nested-junk
//    decoy :60-79, builder chrome + bare-row fallback :81-117, refire :136-146;
//    its :152-158 owns the reaction-category refire fold (inherited, not
//    re-run here);
//  - seahorse MA-1450 (#1086): detector truthiness :60-79, builder chrome +
//    fallback :81-117, one-press/refire resolver :120-146;
//  - archlich MA-1851 (#1087): detector :60-79, builder chrome :81-93, log
//    record shape :95-101, one-press :121-134, refire :136-146;
//  - thunderbird MA-2018 (#1088): same ranges — detector :60-79, builders
//    :81-117, one-press :121-134, refire :136-146;
//  - ziz MA-2068 (#1089): detector :60-79, builders :81-117, refire :136-146;
//    reaction-category refire folds to ma1285 :152-158 per that lane.
//
// Inertness canonical pin (#934/#1026): an advisory press = popup STRING +
// exactly ONE ability_use log, zero rolls, zero spends, zero refusals, zero
// store writes beyond the log — hosted HERE once (one-press test), tickets
// inherit. Carried rec (#1087): the old orc refire leg (:199-206 pre-trim)
// was the 2nd copy of the base refire mechanism — folded into the generic
// refire test below (row-agnostic: the resolver never reads uses/usage).
//
// old→new: 3 per-monster disk-lock describes (nalfeshnee/nightmare/orc) →
// one disk it.each table (sphinx field-shape lineage rides the detector
// table's legendary leg); detector legs + sibling
// byte-inertness → one detector it.each (#903); popup/log tests per row →
// one builder it.each + exact-chrome pin ONCE (#829) with distinguishable
// fixture bytes per row (#1022); bare-row fallback + degenerate no-name +
// byte-source-swap falsifier (#967/#1036) → one it.each; orc popup-copy and
// orc refire → folded (base tables). Fixtures now selected by advisory key/
// name, not brittle action indices. No wall-clock asserts (#app): the log's
// Date.now() timestamp is never checked. No shared mutable state → no
// afterEach needed (#1007): every vi.fn is test-local.
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  isMonsterActionAdvisoryRow,
  buildMonsterActionAdvisoryPopup,
  buildMonsterActionAdvisoryLog,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const byIndex = (i) => monstersData.find((m) => m.index === i);
const TELEPORT = byIndex('nalfeshnee').actions.find((a) => a.advisory === 'monster_teleport');
const REND = byIndex('nalfeshnee').actions.find((a) => a.name === 'Rend');
const PURSUIT = byIndex('nalfeshnee').reactions.find((a) => a.advisory === 'monster_teleport');
const SPHINX_TELEPORT = byIndex('androsphinx').legendary_actions.find((a) => a.advisory === 'sphinx_teleport');
const ETHEREAL_STRIDE = byIndex('nightmare').actions.find((a) => a.advisory === 'monster_teleport');
const HOOFES = byIndex('nightmare').actions.find((a) => a.name === 'Hooves');
const BATTLE_CRY = byIndex('orc-war-chief').actions.find((a) => a.advisory === 'monster_battle_cry');

describe('MA-1223 advisory row detection — arms ONLY on truthy top-level advisory', () => {
  it.each([
    ['nalfeshnee Teleport (normal action)', TELEPORT, true],
    ['nalfeshnee Pursuit (reaction rides same detector)', PURSUIT, true],
    ['nightmare Ethereal Stride (normal action)', ETHEREAL_STRIDE, true],
    ['orc Battle Cry (usage-carrying row still arms)', BATTLE_CRY, true],
    ['androsphinx legendary Teleport (field-shape lineage)', SPHINX_TELEPORT, true],
    ['junk-key row — advisory is the only admission key', { advisory: 'monster_teleport', attack_bonus: 'six', junk: {} }, true],
    ['Rend (real attack row)', REND, false],
    ['Hooves (real attack row)', HOOFES, false],
    ['Greataxe sibling byte-inert', byIndex('orc-war-chief').actions.find((a) => a.name === 'Greataxe'), false],
    ['Spear sibling byte-inert', byIndex('orc-war-chief').actions.find((a) => a.name === 'Spear'), false],
    ['empty object', {}, false],
    ['null row', null, false],
    ['empty advisory string never arms', { advisory: '' }, false],
    ['nested decoy — top-level field only', { zone: { advisory: 'x' } }, false],
  ])('%s → %s', (_label, row, expected) => {
    expect(isMonsterActionAdvisoryRow(row)).toBe(expected);
  });
});

describe('MA-1223 advisory builders — honest record chrome, name/message interpolation', () => {
  it('popup chrome template pinned EXACTLY once (#829)', () => {
    expect(buildMonsterActionAdvisoryPopup({ monsterName: 'Nalfeshnee 1', action: TELEPORT }))
      .toBe(`<div class="mc-prerequisite-refusal"><h3>Action — Teleport</h3><p>Nalfeshnee 1 ${TELEPORT.advisory_message}</p></div>`);
  });

  it.each([
    ['Nalfeshnee 1', TELEPORT, 'Teleport', /GM-enforced.*no grid-position consumer app-wide \(CLA-320\)/],
    ['Nightmare 1', ETHEREAL_STRIDE, 'Ethereal Stride', /no Ethereal-plane state consumer app-wide \(§70\)/],
    ['Orc War Chief 1', BATTLE_CRY, 'Battle Cry', /advantage is not auto-applied because targets are GM-chosen per RAW/],
  ])('%s %s: popup carries row copy, log is ability_use with no roll fields (#1022)', (monsterName, action, name, msgFrag) => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName, action });
    expect(html).toMatch(new RegExp(`^<div class="mc-prerequisite-refusal"><h3>Action — ${name}</h3><p>${monsterName} `));
    expect(html).toMatch(msgFrag);
    const log = buildMonsterActionAdvisoryLog({ monsterName, action });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe(monsterName);
    expect(log.abilityName).toBe(name);
    expect(log.description).toContain(`${monsterName} uses ${name}: ${monsterName} ${action.advisory_message}`);
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it.each([
    ['bare row: honest fallback, no fabricated rules text', { name: 'Ghoststep', advisory: 'monster_teleport' },
      /Ghoststep is GM-enforced \(no engine consumer for this mechanic\)/, /X 1 uses Ghoststep/],
    ['degenerate no-name row (#945 honest)', { advisory: 'monster_teleport' },
      /<h3>Action — Advisory<\/h3>.*this action is GM-enforced/s, /X 1 uses undefined/],
    ['byte-source-swap falsifier (#967/#1036): advisory_message beats description',
      { name: 'Fake', advisory: 'monster_teleport', advisory_message: 'CUSTOM-PRECEDENCE-COPY', description: 'DESCRIPTION-MUST-NOT-APPEAR' },
      /CUSTOM-PRECEDENCE-COPY/, /CUSTOM-PRECEDENCE-COPY/],
  ])('%s', (_label, action, popupExpect, logExpect) => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'X 1', action });
    expect(html).toMatch(popupExpect);
    expect(html).not.toMatch(/DESCRIPTION-MUST-NOT-APPEAR/);
    expect(buildMonsterActionAdvisoryLog({ monsterName: 'X 1', action }).description).toMatch(logExpect);
  });
});

describe('MA-1223 resolveMonsterActionAdvisoryRow — record-only contract', () => {
  it('one press = popup + EXACTLY ONE ability_use log — canonical zero-write pin (#934/#1026)', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: TELEPORT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res).toEqual({ resolved: true });
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(setPopupHtml.mock.calls[0][0]).toMatch(/mc-prerequisite-refusal.*Teleport/s);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ability_use', abilityName: 'Teleport', characterName: 'Nalfeshnee 1' }));
    const entry = addEntry.mock.calls[0][1];
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(entry.automationType).toBeUndefined();
  });

  it('refire press stays record-only — 2nd press logs again, zero spends/refusals (orcs+all inherit)', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const press = (action, monsterName) => resolveMonsterActionAdvisoryRow({ action, monsterName, campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await press(TELEPORT, 'Nalfeshnee 1');
    await press(TELEPORT, 'Nalfeshnee 1');
    await press(BATTLE_CRY, 'Orc War Chief 1'); // folded rec #1087: usage-carrying row refires identically — resolver never reads uses
    expect(addEntry).toHaveBeenCalledTimes(3);
    expect(setPopupHtml).toHaveBeenCalledTimes(3);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});

describe('MA-1232/#1087 disk locks: advisory rows ride the MA-1223 seam', () => {
  it.each([
    ['nalfeshnee Teleport', TELEPORT, 'monster_teleport', null, 0, undefined],
    ['nightmare Ethereal Stride', ETHEREAL_STRIDE, 'monster_teleport', null, 0, undefined],
    ['orc Battle Cry (cosmetic 1/Day usage KEPT, no mechanical gate)', BATTLE_CRY, 'monster_battle_cry', undefined, undefined, { type: 'per day', times: 1 }],
  ])('%s: junk attack_bonus dead (MA-1071 pin), advisory key, no te/zone/automation/uses sentinel', (_label, action, advisory, attackBonus, saveDc, usage) => {
    expect(action.advisory).toBe(advisory);
    expect(typeof action.advisory_message).toBe('string');
    expect(action.advisory_message).toMatch(/GM-enforced/);
    expect(action.attack_bonus).toStrictEqual(attackBonus);
    expect(action.save_dc).toStrictEqual(saveDc);
    expect(action.zone).toBeUndefined();
    expect(action.automation).toBeUndefined();
    expect(action.uses).toBeUndefined();
    expect(action.usage).toStrictEqual(usage);
  });

  it('sibling weapon rows byte-inert — no advisory authored, real attack_bonus kept', () => {
    for (const [name, bonus] of [['Rend', 10], ['Hooves', 6], ['Greataxe', 6], ['Spear', 6]]) {
      const parent = byIndex('nalfeshnee').actions.concat(byIndex('nightmare').actions, byIndex('orc-war-chief').actions);
      const row = parent.find((a) => a.name === name);
      expect(row.attack_bonus).toBe(bonus);
      expect(row.advisory).toBeUndefined();
      expect(isMonsterActionAdvisoryRow(row)).toBe(false);
    }
  });
});
