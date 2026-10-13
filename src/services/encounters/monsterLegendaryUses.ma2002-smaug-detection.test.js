// MA-2002: Smaug the Golden "Detection" (legendary_actions[4]) DATA fingerprint.
// The MA-1974 ACTIVE-TRAP family: prose-only row starved of the MA-0051
// ability_check key — the generic Expend chip spent a legendary use, hit the
// console.error "no resolvable mechanic" dead-end, and rolled NOTHING.
// One-field fix: ability_check:{ability:"wisdom",skill:"perception"} —
// Garuda MA-1910 / Quetzalcoatl MA-1974 byte-twin (name→ability_check→
// description key order). BONUS-LANE NUANCE: Smaug authors skills as BARE
// numbers (flat "Perception": 11), not the canonical dict {modifier:N}
// (Adult Blue Dracolich +14) — legendaryCheckBonus now coerces bare-number
// skill entries (entry?.modifier ?? entry) so the chip resolves the honest
// stat-block +11 instead of collapsing to +0.
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
  it('rides the MA-0051 skill-check lane (Garuda/Quetzalcoatl byte-twin)', () => {
    expect(DETECT.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(JSON.stringify(DETECT.ability_check)).toBe('{"ability":"wisdom","skill":"perception"}');
    expect(legendaryCheckRow(DETECT)).toEqual({ ability: 'wisdom', skill: 'perception' });
  });

  it('name/description byte-locked; key order name→ability_check→description', () => {
    expect(DETECT.name).toBe('Detection');
    expect(DETECT.description).toBe('Smaug makes one Perception check.');
    expect(DETECT.delegates_to).toBeUndefined();
    expect(Object.keys(DETECT)).toEqual(['name', 'ability_check', 'description']);
  });

  it('bonus resolves honest +11 via flat-number skills hit (beats wis +3 fallback)', () => {
    // Smaug skills are the bare-number minority shape (10/384), not dict.
    expect(SMAUG.skills.Perception).toBe(11);
    expect(SMAUG.ability_score_modifiers.wis).toBe(3);
    expect(legendaryCheckBonus(SMAUG, DETECT)).toBe(11);
    expect(legendaryCheckLabel(DETECT)).toBe('Wisdom (Perception)');
  });

  it('legendaryCheckBonus shape tolerance: dict precedence, bare number, fallback, null', () => {
    const check = { ability_check: { ability: 'wisdom', skill: 'perception' } };
    expect(legendaryCheckBonus({ skills: { Perception: { modifier: 14 } } }, check)).toBe(14);
    expect(legendaryCheckBonus({ skills: { PeRcEPTION: 11 } }, check)).toBe(11);
    expect(legendaryCheckBonus({ skills: { Perception: -2 } }, check)).toBe(-2);
    expect(legendaryCheckBonus({ skills: { Perception: {} } }, check)).toBe(0);
    expect(legendaryCheckBonus({ skills: {}, ability_score_modifiers: { wis: 3 } }, check)).toBe(3);
    expect(legendaryCheckBonus({}, check)).toBeNull();
  });

  it('sibling legendary rows untouched (header economy, Claw/Tail delegates, Flame Lash numerics)', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(CLAW.delegates_to).toBe('Claw');
    expect(TAIL.delegates_to).toBe('Tail');
    expect(CLAW.ability_check).toBeUndefined();
    expect(TAIL.ability_check).toBeUndefined();
    expect(LASH.attack_bonus).toBe(15);
    expect(LASH.damage_dice_primary).toBe('6d10');
    expect(LASH.damage_type_primary).toBe('Fire');
    expect(LEGENDARY.length).toBe(5);
  });

  it('garuda/quetzalcoatl twin rows byte-intact (MA-1910/MA-1974 lanes)', () => {
    const garuda = monsters.find((m) => m.index === 'garuda');
    const quetzal = monsters.find((m) => m.index === 'quetzalcoatl');
    const gd = garuda.legendary_actions.find((a) => a.name === 'Detection');
    const qd = quetzal.legendary_actions.find((a) => a.name === 'Detection');
    expect(gd.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(qd.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    // Neither lists Perception in skills → honest +4 wis fallback held.
    expect(legendaryCheckBonus(garuda, gd)).toBe(4);
    expect(legendaryCheckBonus(quetzal, qd)).toBe(4);
  });
});
