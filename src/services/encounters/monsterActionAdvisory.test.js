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
