// MA-1224 regression: REACTION-category advisory seam (Nalfeshnee "Pursuit" —
// RAW move-end-triggered teleport reaction, prose-only, zero affordance, double
// inert: no automation.effect → GatedMonsterReaction null AND no move-end
// producer app-wide for the trigger). Fix = advisory fields on reactions[0]
// reusing the EXACT MA-1223 monster_teleport advisory key (detector is pure
// truthiness — isMonsterActionAdvisoryRow never string-matches) + At Will
// sentinel (usage:'At Will'+uses:999+maxUses:999, MA-0006/§6 family). ZERO
// code: reaction rows already ride the same MonsterAction row renderer with
// handleAdvisoryRow threaded (MonsterCardBody reactions section → generic
// MonsterActionSection branch). Locks byte-identical name/trigger/description
// and the record-only resolver contract: popup + ONE ability_use log per
// press, zero rolls, zero spends; feather_fall/parry te-channel twins byte-inert.
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  isMonsterActionAdvisoryRow,
  buildMonsterActionAdvisoryPopup,
  buildMonsterActionAdvisoryLog,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const NALFESHNEE = monstersData.find((m) => m.index === 'nalfeshnee');
const PURSUIT = NALFESHNEE.reactions[0];
const TELEPORT = NALFESHNEE.actions[2];
const FEATHER_FALL = monstersData.find((m) => m.index === 'aarakocra-aeromancer').reactions[0];
const PARRY = monstersData.find((m) => m.index === 'bandit-captain').reactions[0];

describe('MA-1224 disk lock: nalfeshnee Pursuit reaction is a pure advisory row', () => {
  it('name/trigger/description byte-identical to the RAW row', () => {
    expect(PURSUIT.name).toBe('Pursuit');
    expect(PURSUIT.trigger).toBe('Another creature the nalfeshnee can see ends its move within 120 feet of the nalfeshnee');
    expect(PURSUIT.description).toBe('The nalfeshnee uses Teleport, but its destination space must be within 10 feet of the triggering creature.');
  });

  it('advisory reuses the EXACT MA-1223 monster_teleport key (no invented per-row key)', () => {
    expect(PURSUIT.advisory).toBe('monster_teleport');
    expect(TELEPORT.advisory).toBe('monster_teleport');
  });

  it('advisory_message carries the honest move-end-residual + CLA-320 copy', () => {
    expect(PURSUIT.advisory_message).toMatch(/RAW trigger — a visible creature ending its move within 120 ft — has no move-end producer app-wide/);
    expect(PURSUIT.advisory_message).toMatch(/teleport relocation is GM-enforced gridless \(CLA-320\)/);
    expect(PURSUIT.advisory_message).toMatch(/pressing this chip records the reaction use/);
    expect(PURSUIT.advisory_message).toMatch(/lands the nalfeshnee within 10 ft of the triggering creature/);
    expect(PURSUIT.advisory_message).toMatch(/No attack roll, no saving throw, no dice\./);
  });

  it('At Will sentinel (§6/MA-0006): usage At Will + uses/maxUses 999', () => {
    expect(PURSUIT.usage).toBe('At Will');
    expect(PURSUIT.uses).toBe(999);
    expect(PURSUIT.maxUses).toBe(999);
  });

  it('NO automation/te/zone authored (no gated-effect consumer fits)', () => {
    expect(PURSUIT.automation).toBeUndefined();
    expect(PURSUIT.zone).toBeUndefined();
    expect(PURSUIT.attack_bonus).toBeUndefined();
    expect(PURSUIT.save_dc).toBeUndefined();
  });
});

describe('MA-1224 advisory detection on reaction rows', () => {
  it('arms on reactions[0] via the same truthiness detector', () => {
    expect(isMonsterActionAdvisoryRow(PURSUIT)).toBe(true);
  });

  it('te-channel reaction twins stay unarmed (byte-inert §37)', () => {
    expect(FEATHER_FALL.automation.effect).toBe('feather_fall');
    expect(PARRY.automation.effect).toBe('parry');
    expect(isMonsterActionAdvisoryRow(FEATHER_FALL)).toBe(false);
    expect(isMonsterActionAdvisoryRow(PARRY)).toBe(false);
  });
});

describe('MA-1224 advisory builders on the Pursuit row', () => {
  it('popup is honest record chrome carrying the RAW trigger note', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Nalfeshnee 1', action: PURSUIT });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Pursuit<\/h3>/);
    expect(html).toMatch(/has no move-end producer app-wide/);
    expect(html).toMatch(/GM-enforced gridless \(CLA-320\)/);
  });

  it('log is an ability_use record naming Pursuit, no roll fields', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Nalfeshnee 1', action: PURSUIT });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Nalfeshnee 1');
    expect(log.abilityName).toBe('Pursuit');
    expect(log.rollType).toBeUndefined();
    expect(log.roll).toBeUndefined();
  });
});

describe('MA-1224 resolveMonsterActionAdvisoryRow on Pursuit — record-only contract', () => {
  it('one press = popup + exactly ONE ability_use log; no other writes', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: PURSUIT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Pursuit');
    expect(entry.description).toMatch(/records the reaction use/);
  });

  it('refire press stays record-only (At Will ungated): two logs, zero spends', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: PURSUIT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: PURSUIT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(setPopupHtml).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
