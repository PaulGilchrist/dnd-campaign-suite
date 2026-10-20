// @maintained-by-ai
// MA-1450: Seahorse "Bubble Dash" — RAW pure self-movement row formerly
// carried junk attack_bonus:0 → clickable "+0" chip adjudicating a bogus
// to-hit vs the armed target (live fingerprint 2026-09-28: roll/attack
// name:"Bubble Dash" hit:false — no d20 RAW grants). Fix is DATA-only:
// attack_bonus key REMOVED (Imp precedent, key-absent-not-null — unlike the
// nalfeshnee Teleport twin's attack_bonus:null), advisory + advisory_message
// authored → MA-1223 AdvisoryLink arms mc-dice-link-advisory chip, press =
// record-only ability_use popup + log, zero rolls. save_dc:0/save_type:""
// household noise KEPT (twin disk state mirrored exactly).
//
// Lane (applied-rec #1085 verdict): this .js service ticket file pins the
// MA-1450 DISK ROW verbatim + the distinct detector decoy + the record-only
// resolver press on Bubble Dash. Family cite map:
// - monsterActionAdvisory.test.js = family base (#976): detector truthiness
//   incl. null/nested decoys :51-59, popup/log builder chrome + bare-row
//   fallback :61-85, one-press/refire resolver mechanism :87-108 — not
//   re-machined here.
// - monsterActionAdvisory.ma1224-nalfeshnee-pursuit.test.js = builder-cut +
//   resolver-popup-arg-strengthened exemplar — mirrored here.
// - monsterActionAdvisory.ma1285-uncanny-dodge.test.jsx = reaction-category
//   refire fold owner (#1085).
// - MonsterAction.ma1450-…-advisory-chip.test.jsx owns the RENDER face
//   (one advisory chip, no "+0"/save sibling, press routing) per #467 — no
//   renderer restated here.
// Inertness note (#934/#1026): press produces a popup STRING + ONE ability_use
// log — never a roll, spend, or gate refusal; zero change-data writes beyond
// that entry. Refire is structural (resolver is stateless, row authors no
// uses/automation economy) — pinned by base :100-108 + the ma1285 fold.
// Old→new map: 10 tests → 3. Full-row toEqual (disk-extracted bytes, not
// transcribed #993/#829) absorbs name/attack_bonus-absent/household-noise/
// advisory-copy/zero-fields tests; builders+refire+TELEPORT-twin REMOVED
// (base :61-108 + ma1285); detector kept ONCE with the giant-seahorse Ram
// near-miss decoy (#948); resolver KEPT+STRENGTHENED (popup arg + entry
// bytes + rollType undefined + zero writes).
import { describe, it, expect, vi } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  isMonsterActionAdvisoryRow,
  resolveMonsterActionAdvisoryRow,
} from './monsterActionAdvisory.js';

const SEAHORSE = monstersData.find((m) => m.index === 'seahorse');
const BUBBLE_DASH = SEAHORSE.actions[0];
const GIANT_SEAHORSE = monstersData.find((m) => m.index === 'giant-seahorse');
const RAM = GIANT_SEAHORSE.actions[0];

describe('MA-1450 disk lock: seahorse Bubble Dash is a pure advisory row', () => {
  it('full row byte-verbatim to disk: junk attack_bonus key ABSENT (Imp precedent, key-absent-not-null), save_dc:0/save_type:"" household noise KEPT, advisory + advisory_message exact-once, zero te/zone/automation/usage/uses (§70 residual)', () => {
    expect(BUBBLE_DASH).toEqual({
      "name": "Bubble Dash",
      "description": "While underwater, the seahorse moves up to its Swim Speed without provoking Opportunity Attacks.",
      "save_dc": 0,
      "save_type": "",
      "save_effect": "",
      "range": "",
      "reach": "",
      "recharge": "",
      "advisory": "bubble_dash",
      "advisory_message": "moves up to its Swim Speed without provoking Opportunity Attacks while underwater — advisory record: self-movement and opportunity-attack suppression are GM-enforced, GM moves the token (no movement or opportunity-attack consumer app-wide, §70). No attack roll, no saving throw, no dice.",
    });
    expect('attack_bonus' in BUBBLE_DASH).toBe(false);
  });

  it('detector arms Bubble Dash once; giant-seahorse Ram near-miss decoy stays a byte-inert real attack row (#948)', () => {
    expect(isMonsterActionAdvisoryRow(BUBBLE_DASH)).toBe(true);
    expect(RAM.name).toBe('Ram');
    expect(RAM.attack_bonus).toBe(4);
    expect('advisory' in RAM).toBe(false);
    expect(isMonsterActionAdvisoryRow(RAM)).toBe(false);
  });
});

describe('MA-1450 resolveMonsterActionAdvisoryRow on Bubble Dash — record-only contract', () => {
  it('one press = popup STRING carrying the honest row copy + exactly ONE ability_use record; rollType/roll undefined, zero writes beyond the log (#934/#1026)', async () => {
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const res = await resolveMonsterActionAdvisoryRow({ action: BUBBLE_DASH, monsterName: 'Seahorse 1', campaignName: 'test-campaign', setPopupHtml, deps: { addEntry } });
    expect(res.resolved).toBe(true);
    expect(setPopupHtml).toHaveBeenCalledTimes(1);
    const popup = setPopupHtml.mock.calls[0][0];
    expect(typeof popup).toBe('string');
    expect(popup).toMatch(/^<div class="mc-prerequisite-refusal"><h3>Action — Bubble Dash<\/h3>/);
    expect(popup).toContain(BUBBLE_DASH.advisory_message);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      characterName: 'Seahorse 1',
      abilityName: 'Bubble Dash',
    }));
    const entry = addEntry.mock.calls[0][1];
    expect(entry.description).toContain(`Seahorse 1 uses Bubble Dash: Seahorse 1 ${BUBBLE_DASH.advisory_message}`);
    expect(entry.rollType).toBeUndefined();
    expect(entry.roll).toBeUndefined();
  });
});
