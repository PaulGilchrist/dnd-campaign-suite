// @maintained-by-ai
// MA-1974: Quetzalcoatl "Detection" (legendary_actions[2]) DATA fingerprint.
// Press burned a legendary use, rolled NOTHING, console error
// delegates_to:"undefined" — the MA-0051 skill-check lane
// (legendaryCheckRow/legendaryCheckBonus → handleCheck → rollSkillCheck) was
// starved of its structured key. One-field fix: ability_check:{ability:
// "wisdom",skill:"perception"} — Garuda MA-1910 byte-twin (Modal spends 1
// then rolls). BONUS-LANE NUANCE (disk read 2026-10-20): Quetzalcoatl ships
// NON-EMPTY skills {Arcana:13,Persuasion:15,Religion:13} with NO Perception —
// the case-insensitive skill lookup honestly misses and the bonus resolves +4
// via the ability_score_modifiers abbr fallback lane (distinct from Garuda's
// skills:{} starvation and Smaug MA-2002's bare-number Perception hit).
//
// Family cites (not re-driven here):
//   monsterLegendaryUses.test.js:79-110     — MA-0021 expend gate vocabulary
//   monsterLegendaryUses.test.js:433-464    — MA-0051 check-row/bonus/label generics
//   ma1907-ma1910-garuda.test.js            — Garuda Detection fingerprint owner
//   ma2002-smaug-detection.test.js          — MA-2002 bare-number skills lane owner
//   ma1883-demogorgon-cast-a-spell.test.js — "Costs N Actions" cost grammar
//   monsterRecharge.ma1970-quetzalcoatl-hurricane-breath.test.js — Hurricane
//     Breath recharge/save_dc/20d6/save_effect bytes owner (old t5 deleted)
//   monsterEpicCohort.test.js               — cohort band pins, real-consumer seam (#1092)
//
// Dup-map (old 5 → new 3):
//   old t1 lane-ride + old t3 row-lock → new t1 (JSON.stringify dupe deleted —
//     toEqual already locks the deep bytes)
//   old t2 bonus/+4 → new t2 (+non-empty-skills provenance)
//   old t4 siblings + old t5 Hurricane/Wing → new t3 (Hurricane bytes deleted,
//     cited ma1970; Wing Defense #1089 twin honestly locked — no reaction owner)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from './monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const QUETZALCOATL = monsters.find((m) => m.index === 'quetzalcoatl');
const LEGENDARY = QUETZALCOATL.legendary_actions;
const HEADER = LEGENDARY[0];
const TALON = LEGENDARY[1];
const DETECT = LEGENDARY.find((a) => a.name === 'Detection');
const WIND_STEP = LEGENDARY.find((a) => a.name.startsWith('Wind Step'));
const WING = QUETZALCOATL.reactions.find((a) => a.name === 'Wing Defense');

describe('MA-1974 disk fingerprint: Detection ability_check authored', () => {
  it('fix bytes exact-once via name lookup — ability_check rides the row, no delegate hijack', () => {
    expect(DETECT.name).toBe('Detection');
    expect(DETECT.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    // key-set locks the fix appears EXACTLY ONCE (no duplicate/hijack keys)
    expect(Object.keys(DETECT)).toEqual(['name', 'ability_check', 'description']);
    expect(DETECT.description).toBe('Quetzalcoatl makes one Perception check.');
    expect(DETECT.delegates_to).toBeUndefined();
    expect(legendaryCheckRow(DETECT)).toEqual(DETECT.ability_check);
  });

  it('bonus +4 honest: non-empty skills WITHOUT Perception misses the skill lane, abbr wis:4 resolves it', () => {
    expect(QUETZALCOATL.skills).toEqual({ Arcana: 13, Persuasion: 15, Religion: 13 });
    expect(QUETZALCOATL.skills.Perception).toBeUndefined();
    expect(QUETZALCOATL.ability_score_modifiers.wis).toBe(4);
    expect(legendaryCheckBonus(QUETZALCOATL, DETECT)).toBe(4);
    expect(legendaryCheckLabel(DETECT)).toBe('Wisdom (Perception)');
  });

  it('sibling rows inert: header economy, Talon + Wind Step delegates (MA-1975 flip), Wing Defense twin bytes', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(TALON.delegates_to).toBe('Talon');
    expect(TALON.ability_check).toBeUndefined();
    expect(WIND_STEP.name).toBe('Wind Step (Costs 2 Actions)');
    // MA-1975 same-pass pin flip: Wind Step now delegates its Talon leg.
    expect(WIND_STEP.delegates_to).toBe('Talon');
    expect(WIND_STEP.ability_check).toBeUndefined();
    expect(LEGENDARY.length).toBe(4);
    // #1089 no-affordance reaction twin — disk ships structured save bytes
    // with no reaction-lane owner test; locked honestly here.
    expect(WING.save_dc).toBe(25);
    expect(WING.dc_success).toBe('none');
  });
});
