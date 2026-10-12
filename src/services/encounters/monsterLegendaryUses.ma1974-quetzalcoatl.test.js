// MA-1974: Quetzalcoatl "Detection" (legendary_actions[2]) DATA fingerprint.
// Press burned a legendary use, rolled NOTHING, console error
// delegates_to:"undefined" — the MA-0051 skill-check lane
// (legendaryCheckRow/legendaryCheckBonus → handleCheck → rollSkillCheck) was
// starved of its structured key. One-field fix: ability_check:{ability:
// "wisdom",skill:"perception"} — Garuda MA-1910 identically-prose Detection
// byte-twin (Modal spends 1 then rolls). Quetzalcoatl skills lists no
// Perception entry → bonus resolves +4 via the ability_score_modifiers abbr
// fallback lane (legendaryCheckBonus skill-less leg).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const QUETZALCOATL = monsters.find((m) => m.index === 'quetzalcoatl');
const LEGENDARY = QUETZALCOATL.legendary_actions;
const HEADER = LEGENDARY[0];
const TALON = LEGENDARY[1];
const DETECT = LEGENDARY.find((a) => a.name === 'Detection');
const WIND_STEP = LEGENDARY.find((a) => a.name.startsWith('Wind Step'));
const HURRICANE = QUETZALCOATL.actions.find((a) => a.name.startsWith('Hurricane Breath'));
const WING = QUETZALCOATL.reactions.find((a) => a.name === 'Wing Defense');

describe('MA-1974 disk fingerprint: Detection ability_check authored', () => {
  it('rides the MA-0051 skill-check lane (Garuda MA-1910 byte-shape twin)', () => {
    expect(DETECT.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(JSON.stringify(DETECT.ability_check)).toBe('{"ability":"wisdom","skill":"perception"}');
    expect(legendaryCheckRow(DETECT)).toEqual({ ability: 'wisdom', skill: 'perception' });
  });

  it('bonus resolves +4 via ability_score_modifiers abbr fallback (skills has no Perception)', () => {
    expect(QUETZALCOATL.skills.Perception).toBeUndefined();
    expect(QUETZALCOATL.ability_score_modifiers.wis).toBe(4);
    expect(legendaryCheckBonus(QUETZALCOATL, DETECT)).toBe(4);
    expect(legendaryCheckLabel(DETECT)).toBe('Wisdom (Perception)');
  });

  it('name/description byte-locked; delegates_to untouched (no-delegate hijack lane)', () => {
    expect(DETECT.name).toBe('Detection');
    expect(DETECT.description).toBe('Quetzalcoatl makes one Perception check.');
    expect(DETECT.delegates_to).toBeUndefined();
    expect(Object.keys(DETECT)).toEqual(['name', 'ability_check', 'description']);
  });

  it('sibling legendary rows untouched (header economy, Talon delegate, Wind Step)', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(TALON.delegates_to).toBe('Talon');
    expect(TALON.ability_check).toBeUndefined();
    expect(WIND_STEP.ability_check).toBeUndefined();
    expect(WIND_STEP.delegates_to).toBeUndefined();
    expect(LEGENDARY.length).toBe(4);
  });

  it('today MA-1970/MA-1971 Quetz edits byte-intact', () => {
    expect(HURRICANE.recharge).toBe('5-6');
    expect(HURRICANE.save_dc).toBe(25);
    expect(HURRICANE.damage_dice_primary).toBe('20d6');
    expect(HURRICANE.damage_type_primary).toBe('Thunder');
    expect(HURRICANE.save_effect).toBe('The target is also knocked Prone and Deafened for 1 minute on a failed save.');
    expect(WING.dc_success).toBe('none');
  });
});
