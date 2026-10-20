// @maintained-by-ai
// MA-1224 regression: REACTION-category advisory seam (Nalfeshnee "Pursuit" —
// RAW move-end-triggered teleport reaction, prose-only, zero affordance, double
// inert: no automation.effect → GatedMonsterReaction null AND no move-end
// producer app-wide for the trigger). Fix = advisory fields on reactions[0]
// reusing the EXACT MA-1223 monster_teleport advisory key (detector is pure
// truthiness — isMonsterActionAdvisoryRow never string-matches) + At Will
// sentinel (usage:'At Will'+uses:999+maxUses:999, MA-0006/§6 family). ZERO
// code: reaction rows already ride the same MonsterAction row renderer with
// handleAdvisoryRow threaded (MonsterCardBody reactions section → generic
// MonsterActionSection branch).
//
// Lane: this file pins MA-1224 PRODUCTION bytes only (disk row verbatim +
// the record-only resolver contract on Pursuit). Family map:
// - monsterActionAdvisory.test.js = family base (#976): generic detector
//   truthiness, builder chrome + fallback copy, one-press/refire resolver —
//   not re-machined here; refs to builders/detector cite it.
// - ma1285-uncanny-dodge.test.jsx = reaction-lane twin + RENDER lane
//   (mc-dice-link-advisory chip); its feather_fall/parry te-channel twin
//   falsifier lives there — mirrored here only as the co-located near-miss.
// - Consumers (MonsterCardModal/MonsterAction .jsx) pin RENDERING, not here.
// Inertness note (#934/#1026): an advisory press produces a popup STRING +
// ONE ability_use log — never a roll, spend, or gate refusal; the resolver
// never reads uses, so the At Will sentinel's ungated refire is structural
// and pinned generically by the base (TELEPORT) — not re-run here.
// Old→new map: RAW-bytes KEPT; key+message+AtWill+zero-fields CONSOLIDATED
// into one disk-shape test (message exact-once toBe, fragment regexes cut);
// detector+twins CONSOLIDATED; popup/log builder tests REMOVED (base pins
// builder shapes; Pursuit copy flow strengthened into the resolver popup
// arg); one-press KEPT+STRENGTHENED; refire REMOVED (base + ma1285).
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  isMonsterActionAdvisoryRow,
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

  it('advisory shape: EXACT MA-1223 monster_teleport key + exact honest copy + At Will sentinel, zero mechanical fields (double-inert origin)', () => {
    expect(PURSUIT.advisory).toBe('monster_teleport');
    expect(PURSUIT.advisory).toBe(TELEPORT.advisory); // no invented per-row key
    expect(PURSUIT.advisory_message).toBe('RAW trigger — a visible creature ending its move within 120 ft — has no move-end producer app-wide, and teleport relocation is GM-enforced gridless (CLA-320); pressing this chip records the reaction use: the GM adjudicates trigger and lands the nalfeshnee within 10 ft of the triggering creature. No attack roll, no saving throw, no dice.');
    expect(PURSUIT.usage).toBe('At Will');
    expect(PURSUIT.uses).toBe(999);
    expect(PURSUIT.maxUses).toBe(999);
    expect(PURSUIT.automation).toBeUndefined();
    expect(PURSUIT.zone).toBeUndefined();
    expect(PURSUIT.attack_bonus).toBeUndefined();
    expect(PURSUIT.save_dc).toBeUndefined();
  });
});

describe('MA-1224 detection: the reaction row rides the base advisory seam', () => {
  it('arms on reactions[0] via the truthiness detector; live te-channel reaction twins stay unarmed', () => {
    expect(isMonsterActionAdvisoryRow(PURSUIT)).toBe(true);
    expect(FEATHER_FALL.automation.effect).toBe('feather_fall');
    expect(PARRY.automation.effect).toBe('parry');
    expect(isMonsterActionAdvisoryRow(FEATHER_FALL)).toBe(false);
    expect(isMonsterActionAdvisoryRow(PARRY)).toBe(false);
  });
});

describe('MA-1224 resolveMonsterActionAdvisoryRow on Pursuit — record-only contract', () => {
  it('one press = Pursuit popup string + exactly ONE ability_use record; zero rolls, zero spends, zero refusals', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: PURSUIT, monsterName: 'Nalfeshnee 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    const popup = setPopupHtml.mock.calls[0][0];
    expect(popup).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Pursuit<\/h3>/);
    expect(popup).toMatch(/records the reaction use/);
    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe('Nalfeshnee 1');
    expect(entry.abilityName).toBe('Pursuit');
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
    expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ automationType: expect.stringMatching(/refused|spend/i) }));
  });
});
