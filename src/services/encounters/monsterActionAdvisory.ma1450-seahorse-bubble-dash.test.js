// MA-1450: Seahorse "Bubble Dash" — RAW pure self-movement row formerly
// carried junk attack_bonus:0 → clickable "+0" chip adjudicating a bogus
// to-hit vs the armed target (live fingerprint 2026-09-28: roll/attack
// name:"Bubble Dash" hit:false — no d20 RAW grants). Fix is DATA-only,
// MA-1232 nightmare Ethereal Stride / nalfeshnee Teleport byte-shape: junk
// attack_bonus key REMOVED (Imp precedent, key absent not null), advisory +
// advisory_message authored → MA-1223 AdvisoryLink arms mc-dice-link-advisory
// chip, press = record-only ability_use popup + log, zero rolls. save_dc:0/
// save_type:"" household noise KEPT (twin disk state mirrored exactly).
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  isMonsterActionAdvisoryRow,
  buildMonsterActionAdvisoryPopup,
  buildMonsterActionAdvisoryLog,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const SEAHORSE = monstersData.find((m) => m.index === 'seahorse');
const BUBBLE_DASH = SEAHORSE.actions[0];
const NALFESHNEE = monstersData.find((m) => m.index === 'nalfeshnee');
const TELEPORT = NALFESHNEE.actions[2];
const GIANT_SEAHORSE = monstersData.find((m) => m.index === 'giant-seahorse');
const RAM = GIANT_SEAHORSE.actions[0];

describe('MA-1450 disk lock: seahorse Bubble Dash is a pure advisory row', () => {
  it('attack_bonus key ABSENT (junk "+0" lane dead, Imp precedent key-absent-not-null)', () => {
    expect(BUBBLE_DASH.name).toBe('Bubble Dash');
    expect('attack_bonus' in BUBBLE_DASH).toBe(false);
    expect(BUBBLE_DASH.attack_bonus).toBeUndefined();
  });

  it('save_dc:0/save_type:"" household noise KEPT — nalfeshnee Teleport twin byte-state mirrored', () => {
    expect(BUBBLE_DASH.save_dc).toBe(0);
    expect(BUBBLE_DASH.save_type).toBe('');
    expect(BUBBLE_DASH.save_effect).toBe('');
    expect(BUBBLE_DASH.range).toBe('');
    expect(BUBBLE_DASH.reach).toBe('');
    expect(BUBBLE_DASH.recharge).toBe('');
  });

  it('advisory + advisory_message authored in the MA-1232/MA-1223 advisory field shape', () => {
    expect(BUBBLE_DASH.advisory).toBe('bubble_dash');
    expect(typeof BUBBLE_DASH.advisory_message).toBe('string');
    expect(BUBBLE_DASH.advisory_message).toMatch(/moves up to its Swim Speed/);
    expect(BUBBLE_DASH.advisory_message).toMatch(/GM-enforced/);
    expect(BUBBLE_DASH.advisory_message).toMatch(/no movement or opportunity-attack consumer app-wide/);
    expect(BUBBLE_DASH.advisory_message).toMatch(/No attack roll, no saving throw, no dice\./);
    expect(isMonsterActionAdvisoryRow(BUBBLE_DASH)).toBe(true);
  });

  it('description byte-kept, RAW movement-only text intact', () => {
    expect(BUBBLE_DASH.description).toBe('While underwater, the seahorse moves up to its Swim Speed without provoking Opportunity Attacks.');
  });

  it('NO te/zone/automation/usage/uses authored — record-only, zero movement consumers (§70 residual)', () => {
    expect(BUBBLE_DASH.zone).toBeUndefined();
    expect(BUBBLE_DASH.automation).toBeUndefined();
    expect(BUBBLE_DASH.usage).toBeUndefined();
    expect(BUBBLE_DASH.uses).toBeUndefined();
  });

  it('giant-seahorse Ram sibling row byte-inert — real attack row untouched', () => {
    expect(RAM.name).toBe('Ram');
    expect(RAM.attack_bonus).toBe(4);
    expect(isMonsterActionAdvisoryRow(RAM)).toBe(false);
  });
});

describe('MA-1450 advisory press is record-only: popup + ability_use, zero roll entries', () => {
  it('one press = popup + exactly ONE ability_use log; no roll fields', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: BUBBLE_DASH, monsterName: 'Seahorse 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.abilityName).toBe('Bubble Dash');
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
  });

  it('popup carries the honest advisory copy, no fabricated rules text', () => {
    const html = buildMonsterActionAdvisoryPopup({ monsterName: 'Seahorse 1', action: BUBBLE_DASH });
    expect(html).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Bubble Dash<\/h3>/);
    expect(html).toMatch(/Seahorse 1 moves up to its Swim Speed/);
    expect(html).toMatch(/GM-enforced/);
  });

  it('log description names the row honestly', () => {
    const log = buildMonsterActionAdvisoryLog({ monsterName: 'Seahorse 1', action: BUBBLE_DASH });
    expect(log.type).toBe('ability_use');
    expect(log.characterName).toBe('Seahorse 1');
    expect(log.abilityName).toBe('Bubble Dash');
    expect(log.description).toMatch(/Seahorse 1 uses Bubble Dash: Seahorse 1 moves up to its Swim Speed/);
  });

  it('refire press stays record-only: another honest log, zero spends/refusals', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    await resolveMonsterActionAdvisoryRow({ action: BUBBLE_DASH, monsterName: 'Seahorse 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    await resolveMonsterActionAdvisoryRow({ action: BUBBLE_DASH, monsterName: 'Seahorse 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ rollType: expect.anything() }));
  });

  it('advisory key is generic passthrough — bubble_dash rides the same seam as monster_teleport twin', () => {
    expect(isMonsterActionAdvisoryRow(TELEPORT)).toBe(true);
    expect(TELEPORT.advisory).toBe('monster_teleport');
    expect(BUBBLE_DASH.advisory).not.toBe(TELEPORT.advisory);
    expect(isMonsterActionAdvisoryRow({ advisory: 'bubble_dash' })).toBe(true);
  });
});
