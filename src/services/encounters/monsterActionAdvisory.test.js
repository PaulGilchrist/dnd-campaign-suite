// MA-1223 regression: normal-ACTION advisory seam (Nalfeshnee "Teleport").
// Locks the disk row fix (junk attack_bonus:0 → null kills the "+0" to-hit
// lane at the root) + advisory/advisory_message fields (sphinx
// sphinx_teleport legendary twin field shape), and the record-only resolver
// contract: popup + ONE ability_use log per press, zero spends, zero rolls.
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  isMonsterActionAdvisoryRow,
  buildMonsterActionAdvisoryPopup,
  buildMonsterActionAdvisoryLog,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const NALFESHNEE = monstersData.find((m) => m.index === 'nalfeshnee');
const TELEPORT = NALFESHNEE.actions[2];
const REND = NALFESHNEE.actions[1];
const SPHINX_TELEPORT = monstersData.find((m) => m.index === 'androsphinx').legendary_actions.find((a) => a.advisory === 'sphinx_teleport');
const NIGHTMARE = monstersData.find((m) => m.index === 'nightmare');
const ETHEREAL_STRIDE = NIGHTMARE.actions[1];
const HOOFES = NIGHTMARE.actions[0];
const ORC_WAR_CHIEF = monstersData.find((m) => m.index === 'orc-war-chief');
const BATTLE_CRY = ORC_WAR_CHIEF.actions[3];
const ORC_GREATAXE = ORC_WAR_CHIEF.actions[1];
const ORC_SPEAR = ORC_WAR_CHIEF.actions[2];

describe('MA-1223 disk lock: nalfeshnee Teleport is a pure advisory row', () => {
  it('attack_bonus:null (junk "+0" lane dead), save_dc:0 decoy KEPT (MA-1071 pin)', () => {
    expect(TELEPORT.name).toBe('Teleport');
    expect(TELEPORT.attack_bonus).toBeNull();
    expect(TELEPORT.save_dc).toBe(0);
  });

  it('advisory + advisory_message authored in the sphinx advisory field shape', () => {
    expect(TELEPORT.advisory).toBe('monster_teleport');
    expect(SPHINX_TELEPORT.advisory).toBe('sphinx_teleport');
    expect(typeof SPHINX_TELEPORT.advisory_message).toBe('string');
    expect(TELEPORT.advisory_message).toMatch(/GM-enforced/);
    expect(TELEPORT.advisory_message).toMatch(/no grid-position consumer app-wide \(CLA-320\)/);
    expect(TELEPORT.advisory_message).toMatch(/No attack roll, no saving throw, no dice\./);
  });

  it('NO te/zone/automation/usage sentinel authored (record-only, no position consumer)', () => {
    expect(TELEPORT.zone).toBeUndefined();
    expect(TELEPORT.automation).toBeUndefined();
    expect(TELEPORT.usage).toBeUndefined();
    expect(TELEPORT.uses).toBeUndefined();
  });
});

describe('MA-1223 advisory row detection', () => {
  it('arms only on the top-level advisory field', () => {
    expect(isMonsterActionAdvisoryRow(TELEPORT)).toBe(true);
    expect(isMonsterActionAdvisoryRow(REND)).toBe(false);
    expect(isMonsterActionAdvisoryRow({})).toBe(false);
    expect(isMonsterActionAdvisoryRow(null)).toBe(false);
    expect(isMonsterActionAdvisoryRow({ zone: { advisory: 'x' } })).toBe(false);
  });
});

describe('MA-1223 advisory builders', () => {
  it('popup is honest record chrome carrying the row copy', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Nalfeshnee 1', action: TELEPORT });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Teleport<\/h3>/);
    expect(html).toMatch(/Nalfeshnee 1 teleports up to 120 feet to an unoccupied space it can see/);
    expect(html).toMatch(/GM-enforced/);
    expect(html).toMatch(/no grid-position consumer app-wide \(CLA-320\)/);
  });

  it('log is an ability_use record naming the row, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Nalfeshnee 1', action: TELEPORT });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Nalfeshnee 1');
    expect(log.abilityName).toBe('Teleport');
    expect(log.description).toMatch(/Nalfeshnee 1 uses Teleport: Nalfeshnee 1 teleports up to 120 feet/);
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });

  it('row without advisory_message keeps an honest fallback (no fabricated rules text)', () => {
    const bare = { name: 'Ghoststep', advisory: 'monster_teleport' };
    expect(buildMonsterActionAdvisoryPopup({ monsterName: 'X 1', action: bare })).toMatch(/Ghoststep is GM-enforced \(no engine consumer for this mechanic\)/);
    expect(buildMonsterActionAdvisoryLog({ monsterName: 'X 1', action: bare }).description).toMatch(/X 1 uses Ghoststep/);
  });
});

describe('MA-1223 resolveMonsterActionAdvisoryRow — record-only contract', () => {
  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: TELEPORT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Teleport');
  });

  it('refire press stays record-only: second log, still popup-only, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: TELEPORT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: TELEPORT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});

describe('MA-1232 disk lock: nightmare Ethereal Stride rides the MA-1223 advisory seam', () => {
  it('attack_bonus:null (junk "+0" lane dead), save_dc:0 decoy KEPT (MA-1071 pin)', () => {
    expect(ETHEREAL_STRIDE.name).toBe('Ethereal Stride');
    expect(ETHEREAL_STRIDE.attack_bonus).toBeNull();
    expect(ETHEREAL_STRIDE.save_dc).toBe(0);
  });

  it('advisory + advisory_message authored in the nalfeshnee Teleport byte-shape', () => {
    expect(ETHEREAL_STRIDE.advisory).toBe('monster_teleport');
    expect(typeof ETHEREAL_STRIDE.advisory_message).toBe('string');
    expect(ETHEREAL_STRIDE.advisory_message).toMatch(/GM-enforced/);
    expect(ETHEREAL_STRIDE.advisory_message).toMatch(/No attack roll, no saving throw, no dice\./);
    expect(ETHEREAL_STRIDE.advisory).toBe(TELEPORT.advisory);
  });

  it('NO te/zone/automation/usage/legendaryGate authored — AdvisoryLink arms, chip-arms gate open', () => {
    expect(ETHEREAL_STRIDE.zone).toBeUndefined();
    expect(ETHEREAL_STRIDE.automation).toBeUndefined();
    expect(ETHEREAL_STRIDE.usage).toBeUndefined();
    expect(ETHEREAL_STRIDE.uses).toBeUndefined();
    expect(isMonsterActionAdvisoryRow(ETHEREAL_STRIDE)).toBe(true);
    expect(isMonsterActionAdvisoryRow(HOOFES)).toBe(false);
  });

  it('resolver press stays record-only: popup + ONE ability_use, zero rolls', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: ETHEREAL_STRIDE, monsterName: 'Nightmare 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Ethereal Stride');
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
  });
});

describe('MA-1268 disk lock: orc war chief Battle Cry rides the MA-1223 advisory seam', () => {
  it('advisory + advisory_message authored in the MA-1232 Ethereal Stride byte-shape (Option A one-field)', () => {
    expect(BATTLE_CRY.name).toBe('Battle Cry');
    expect(BATTLE_CRY.advisory).toBe('monster_battle_cry');
    expect(typeof BATTLE_CRY.advisory_message).toBe('string');
    expect(BATTLE_CRY.advisory_message).toMatch(/advisory record/);
    expect(BATTLE_CRY.advisory_message).toMatch(/GM-enforced/);
    expect(isMonsterActionAdvisoryRow(BATTLE_CRY)).toBe(true);
  });

  it('name/description/usage KEPT byte-identical — cosmetic (1/Day) usage untouched, no mechanical gate', () => {
    expect(BATTLE_CRY.description).toMatch(/Each creature of the war chief's choice that is within 30 feet/);
    expect(BATTLE_CRY.usage).toEqual({ type: 'per day', times: 1 });
    expect(BATTLE_CRY.attack_bonus).toBeUndefined();
    expect(BATTLE_CRY.save_dc).toBeUndefined();
    expect(BATTLE_CRY.automation).toBeUndefined();
    expect(BATTLE_CRY.uses).toBeUndefined();
  });

  it('sibling Greataxe/Spear rows byte-inert — no advisory authored', () => {
    expect(isMonsterActionAdvisoryRow(ORC_GREATAXE)).toBe(false);
    expect(isMonsterActionAdvisoryRow(ORC_SPEAR)).toBe(false);
    expect(ORC_GREATAXE.attack_bonus).toBe(6);
    expect(ORC_SPEAR.attack_bonus).toBe(6);
    expect(ORC_GREATAXE.advisory).toBeUndefined();
    expect(ORC_SPEAR.advisory).toBeUndefined();
  });

  it('resolver press is record-only: popup + ONE ability_use, zero rolls, zero spends/refusals', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: BATTLE_CRY, monsterName: 'Orc War Chief 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Battle Cry');
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
  });

  it('popup carries the honest advisory copy, no fabricated rules text', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Orc War Chief 1', action: BATTLE_CRY });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Battle Cry<\/h3>/);
    expect(html).toMatch(/grants advantage on ATTACK ROLLS to creatures of the war chief's choice within 30 ft/);
    expect(html).toMatch(/advantage is not auto-applied because targets are GM-chosen per RAW/);
  });

  it('refire press stays record-only: another honest log, no mechanical double-dip', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: BATTLE_CRY, monsterName: 'Orc War Chief 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: BATTLE_CRY, monsterName: 'Orc War Chief 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
