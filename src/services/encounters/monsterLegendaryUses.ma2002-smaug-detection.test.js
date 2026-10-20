// @maintained-by-ai
// MA-2002: Smaug the Golden "Detection" (legendary_actions[4]) DATA fingerprint.
// The MA-1974 ACTIVE-TRAP family: prose-only row starved of the MA-0051
// ability_check key — the generic Expend chip spent a legendary use, hit the
// console.error "no resolvable mechanic" dead-end, and rolled NOTHING.
// One-field fix: ability_check:{ability:"wisdom",skill:"perception"} rides the
// check-row consumer lane. BONUS-LANE NUANCE (disk read 2026-10-20): Smaug
// authors ALL SIX skills as BARE numbers ({Perception:11}, not the canonical
// dict {modifier:N} of Adult Blue Dracolich +14). legendaryCheckBonus
// coerces both shapes via `entry?.modifier ?? entry`
// (monsterLegendaryUses.js:215-235) — a dict-only read collapsed the bare
// +11 to +0 (dishonest RAW), and the wis:3 ability fallback diverges from
// the authored skill +11.
//
// Family cites (not re-driven here):
//   monsterLegendaryUses.test.js:79-110    — MA-0021 expend gate/refusal vocabulary
//   monsterLegendaryUses.test.js:432-471   — MA-0051 check-row qualification,
//     dict precedence (real dracolich +14), case-insensitive dict lookup,
//     ability fallback, unresolvable null, label vocabulary
//   ma1883-demogorgon-cast-a-spell.test.js — "Costs N Actions" cost grammar
//   ma1907-ma1910-garuda.test.js:59-74     — Garuda Detection fingerprint owner (+4)
//   ma1974-quetzalcoatl.test.js:44-61      — Quetzalcoatl Detection fingerprint owner (+4)
//
// Dup-map (old 6 → new 3):
//   old t1 lane-ride + old t2 name/desc/key-lock → new t1 (JSON.stringify dupe
//     deleted — toEqual already locks the deep bytes; key-set locks the fix
//     appearing exactly once, #1086)
//   old t3 bonus/+11 + old t4 synthetic shape tolerance → new t2 (synthetics
//     deleted — dict precedence/fallback/null cited at family file :450-458;
//     case-insensitive lookup proven through production lowercase ac.skill →
//     disk "Perception" key, #1057 disk-only determinism)
//   old t5 siblings → new t3 (gate/latch mechanics cited MA-0021, never
//     re-driven; Flame Lash cost grammar cited MA-1883)
//   old t6 garuda/quetzal twin sweep → DELETED, citing BOTH owners (#1108 +
//     #1112 — each owner file already flagged ma2002:71-81 as the duplicate)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from './monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SMAUG = monsters.find((m) => m.index === 'smaug-the-golden');
const LEGENDARY = SMAUG.legendary_actions;
const HEADER = LEGENDARY[0];
const CLAW = LEGENDARY[1];
const TAIL = LEGENDARY[2];
const LASH = LEGENDARY[3];
const DETECT = LEGENDARY.find((a) => a.name === 'Detection');

describe('MA-2002 disk fingerprint: Smaug Detection ability_check authored', () => {
  it('fix bytes exact-once via name lookup — ability_check rides the row, no delegate hijack, consumer resolves', () => {
    expect(DETECT.name).toBe('Detection');
    expect(DETECT.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    // key-set locks the fix appearing EXACTLY ONCE (no duplicate/hijack keys)
    expect(Object.keys(DETECT)).toEqual(['name', 'ability_check', 'description']);
    expect(DETECT.description).toBe('Smaug makes one Perception check.');
    // pre-fix regression: the prose-only row resolved nothing — the fix is the
    // structured ability_check, never a delegates_to shortcut
    expect(DETECT.delegates_to).toBeUndefined();
    expect(legendaryCheckRow(DETECT)).toEqual(DETECT.ability_check);
  });

  it('bonus +11 honest: full bare-number skills block pinned, skill lane beats the wis:3 fallback', () => {
    // MA-2002's distinct lane: bare-number skills WITH Perception present
    // (vs Garuda skills:{} starvation, Quetzalcoatl skills-without-Perception).
    expect(SMAUG.skills).toEqual({ Arcana: 14, Deception: 15, Insight: 11, Intimidation: 15, Perception: 11, Persuasion: 15 });
    expect(SMAUG.ability_score_modifiers.wis).toBe(3);
    // lowercase ac.skill "perception" → disk "Perception" via the MA-0051
    // case-insensitive lookup; bare number coerces honest +11 (dict-only read
    // would collapse it to +0, and the abbr fallback would understate +3).
    expect(legendaryCheckBonus(SMAUG, DETECT)).toBe(11);
    expect(legendaryCheckLabel(DETECT)).toBe('Wisdom (Perception)');
  });

  it('sibling rows inert: header economy bytes, Claw/Tail delegates, Flame Lash numerics (cost grammar cited MA-1883)', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(CLAW.delegates_to).toBe('Claw');
    expect(TAIL.delegates_to).toBe('Tail');
    expect(CLAW.ability_check).toBeUndefined();
    expect(TAIL.ability_check).toBeUndefined();
    expect(LASH.name).toBe('Flame Lash (Costs 2 Actions)');
    expect(LASH.attack_bonus).toBe(15);
    expect(LASH.damage_dice_primary).toBe('6d10');
    expect(LASH.damage_type_primary).toBe('Fire');
    expect(LEGENDARY.length).toBe(5);
  });
});
