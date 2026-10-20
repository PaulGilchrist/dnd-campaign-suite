// @maintained-by-ai
// MA-2054: Yamata no Orochi "Head's Vigil" (legendary_actions[2]) DATA fingerprint.
// The MA-1974/MA-2002 ACTIVE-TRAP family: prose-only row starved of the MA-0051
// ability_check key — the generic Expend chip spent a legendary use, hit the
// console.error "no resolvable mechanic" dead-end, and rolled NOTHING.
// One-field fix: ability_check:{ability:"wisdom",skill:"perception"}.
// BONUS-LANE NUANCE (owner-only, reads Yamata disk bytes): Orochi ships skills:{}
// so the MA-2002 bare-number skill branch never fires — the honest bonus is the
// ability_score_modifiers.wis fallback = +2 (NOT +2+PB8: the check lane reads
// stat-block totals only, never re-adds proficiency).
//
// Owner-cite table (cited, never re-driven here):
//   ma1907-ma1910-garuda.test.js:62,63,72    — Garuda Detection ability_check + key order + bonus +4 owner
//   ma1974-quetzalcoatl.test.js:47,49,59      — Quetzalcoatl Detection ability_check + key order + bonus +4 owner
//   ma2002-smaug-detection.test.js:53,55,71   — Smaug Detection ability_check + key order + bonus +11 owner
//   monsterLegendaryUses.test.js:79-110       — MA-0021 spend gate / refusal vocabulary
//   ma1579-tarrasque-general.test.js:39        — header CANON uses:3
//
// old->new map (MA-2054 maintenance pass, recs #1108/#1112/#1114):
//   old it "rides the MA-0051 lane" + it "name/description byte-locked"
//     -> consolidated into one name-lookup fix-bytes test (inner-key JSON
//        byte-lock dropped per #1100 key-set-not-key-order class)
//   old it "detection-lane twins byte-intact" (:65-78) -> DELETED whole sweep;
//     garuda/+4, quetzal/+4, smaug/+11 rows verified byte-live in each owner
//     file above before cutting (verified-before-delete, #1038)
//   old it "bonus resolves honest +2" -> KEEP (Yamata-distinct bonus-lane nuance)
//   old it "sibling legendary rows untouched" -> trimmed to name-decoys (#948):
//     Coil attack/damage numerics unpin (out of lane, separate concern); the
//     in-lane guard is that no OTHER Yamata row carries ability_check
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from './monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ORO = monsters.find((m) => m.index === 'yamata-no-orochi');
const LEGENDARY = ORO.legendary_actions;
const VIGIL = LEGENDARY.find((a) => a.name === "Head's Vigil");

describe('MA-2054 disk fingerprint: Orochi Head\'s Vigil ability_check authored', () => {
  it('fix bytes exact-once via name lookup — ability_check rides the Vigil row, no sibling hijack', () => {
    expect(VIGIL.name).toBe("Head's Vigil");
    expect(VIGIL.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(VIGIL.description).toBe('Orochi makes one Perception check.');
    expect(VIGIL.delegates_to).toBeUndefined();
    expect(Object.keys(VIGIL)).toEqual(['name', 'ability_check', 'description']);
    expect(legendaryCheckRow(VIGIL)).toEqual(VIGIL.ability_check);
    // Name-decoys within Yamata (#948): the fix landed on exactly one row.
    // Header CANON uses:3 @ma1579:39, spend gate @MA-0021:79-110 — cited only.
    expect(LEGENDARY.length).toBe(4);
    expect(LEGENDARY.filter((a) => a.ability_check).map((a) => a.name)).toEqual(["Head's Vigil"]);
    expect(LEGENDARY.find((a) => a.name === 'Bite').delegates_to).toBe('Bite');
  });

  it('bonus resolves honest +2 via wis fallback — skills:{} ships no skill entry', () => {
    // Disk truth (Yamata's own bytes, don't copy sibling provenance): skills is
    // an EMPTY object so the MA-2002 bare-number branch never fires; the lane
    // falls through to ability_score_modifiers.wis = 2. PB (8) is never re-added.
    expect(ORO.skills).toEqual({});
    expect(ORO.skills.Perception).toBeUndefined();
    expect(ORO.ability_score_modifiers.wis).toBe(2);
    expect(ORO.proficiency_bonus).toBe(8);
    expect(legendaryCheckBonus(ORO, VIGIL)).toBe(2);
    expect(legendaryCheckLabel(VIGIL)).toBe('Wisdom (Perception)');
  });
});
