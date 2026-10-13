// MA-2054: Yamata no Orochi "Head's Vigil" (legendary_actions[2]) DATA fingerprint.
// The MA-1974/MA-2002 ACTIVE-TRAP family: prose-only row starved of the MA-0051
// ability_check key — the generic Expend chip spent a legendary use, hit the
// console.error "no resolvable mechanic" dead-end, and rolled NOTHING.
// One-field fix: ability_check:{ability:"wisdom",skill:"perception"} —
// Garuda MA-1910 / Quetzalcoatl MA-1974 / Smaug MA-2002 byte-twin
// (name→ability_check→description key order). BONUS-LANE NUANCE: Orochi ships
// skills:{} so the MA-2002 bare-number skill branch never fires — the honest
// bonus is the ability_score_modifiers.wis fallback = +2 (NOT +2+PB8: the
// check lane reads stat-block totals only, never re-adds proficiency).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel } from './monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ORO = monsters.find((m) => m.index === 'yamata-no-orochi');
const LEGENDARY = ORO.legendary_actions;
const HEADER = LEGENDARY[0];
const BITE = LEGENDARY[1];
const VIGIL = LEGENDARY[2];
const COIL = LEGENDARY[3];

describe('MA-2054 disk fingerprint: Orochi Head\'s Vigil ability_check authored', () => {
  it('rides the MA-0051 skill-check lane (Garuda/Quetzalcoatl/Smaug byte-twin)', () => {
    expect(VIGIL.ability_check).toEqual({ ability: 'wisdom', skill: 'perception' });
    expect(JSON.stringify(VIGIL.ability_check)).toBe('{"ability":"wisdom","skill":"perception"}');
    expect(legendaryCheckRow(VIGIL)).toEqual({ ability: 'wisdom', skill: 'perception' });
  });

  it('name/description byte-locked; key order name→ability_check→description', () => {
    expect(VIGIL.name).toBe("Head's Vigil");
    expect(VIGIL.description).toBe('Orochi makes one Perception check.');
    expect(VIGIL.delegates_to).toBeUndefined();
    expect(Object.keys(VIGIL)).toEqual(['name', 'ability_check', 'description']);
  });

  it('bonus resolves honest +2 via wis fallback — skills:{} ships no skill entry', () => {
    // Disk truth: Orochi skills is an EMPTY object (no bare-number entries
    // post-MA-2002 tolerance to trip), so the lane falls through to
    // ability_score_modifiers.wis = 2. PB (8) is never re-added by this lane.
    expect(ORO.skills).toEqual({});
    expect(ORO.skills.Perception).toBeUndefined();
    expect(ORO.ability_score_modifiers.wis).toBe(2);
    expect(ORO.proficiency_bonus).toBe(8);
    expect(legendaryCheckBonus(ORO, VIGIL)).toBe(2);
    expect(legendaryCheckLabel(VIGIL)).toBe('Wisdom (Perception)');
  });

  it('sibling legendary rows untouched (header economy, Bite delegate, Coil numerics)', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(HEADER.ability_check).toBeUndefined();
    expect(BITE.delegates_to).toBe('Bite');
    expect(BITE.ability_check).toBeUndefined();
    expect(COIL.name).toBe('Crushing Coil (Costs 2 Actions)');
    expect(COIL.ability_check).toBeUndefined();
    expect(COIL.attack_bonus).toBe(18);
    expect(COIL.damage_dice_primary).toBe('4d10 + 9');
    expect(COIL.damage_type_primary).toBe('Bludgeoning');
    expect(COIL.hit_conditions).toEqual(['grappled']);
    expect(LEGENDARY.length).toBe(4);
  });

  it('detection-lane twins byte-intact (MA-1910 Garuda / MA-1974 Quetzalcoatl / MA-2002 Smaug)', () => {
    const garuda = monsters.find((m) => m.index === 'garuda');
    const quetzal = monsters.find((m) => m.index === 'quetzalcoatl');
    const smaug = monsters.find((m) => m.index === 'smaug-the-golden');
    for (const [mon, label] of [[garuda, 'Garuda'], [quetzal, 'Quetzalcoatl'], [smaug, 'Smaug']]) {
      const det = mon.legendary_actions.find((a) => a.name === 'Detection');
      expect(det.ability_check, label).toEqual({ ability: 'wisdom', skill: 'perception' });
      expect(Object.keys(det), label).toEqual(['name', 'ability_check', 'description']);
    }
    // Garuda/Quetzal fall back to wis (+4); Smaug ships bare-number skills (+11).
    expect(legendaryCheckBonus(garuda, garuda.legendary_actions.find((a) => a.name === 'Detection'))).toBe(4);
    expect(legendaryCheckBonus(quetzal, quetzal.legendary_actions.find((a) => a.name === 'Detection'))).toBe(4);
    expect(legendaryCheckBonus(smaug, smaug.legendary_actions.find((a) => a.name === 'Detection'))).toBe(11);
  });
});
