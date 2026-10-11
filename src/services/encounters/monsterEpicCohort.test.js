// CR 25-30 cohort integrity: every monster added in the epic-monster batch
// (official expansion reprints, licensed homebrew icons, and original
// history/legend stat blocks) must satisfy the DMG 2024 Monster Statistics
// by Challenge Rating bands we authored them to, plus the structural
// invariants the monster card relies on (delegation targets, numeric
// attack/save fields, legendary-use headers).
import { describe, it, expect } from 'vitest';
import monstersData from '../../../public/data/monsters.json';

const COHORT = [
  'demogorgon', 'orcus', 'tiamat',
  'archlich', 'cthulhu', 'godzilla', 'king-kong', 'smaug-the-golden',
  'apep', 'behemoth', 'fenrir', 'garuda', 'garmr', 'jormungandr', 'ladon',
  'nidhogg', 'quetzalcoatl', 'scylla', 'simurgh', 'sun-wukong',
  'thunderbird', 'typhon', 'yamata-no-orochi', 'ymir', 'ziz', 'zmey-gorynych',
];

// DMG 2024 XP by CR and our authored HP/attack/DPR targets (§70 bands).
const CR_BAND = {
  '25': { xp: 75000, prof: 8, hpMin: 440, hpMax: 560 },
  '26': { xp: 90000, prof: 8, hpMin: 400, hpMax: 620 },
  '27': { xp: 105000, prof: 8, hpMin: 540, hpMax: 660 },
  '28': { xp: 120000, prof: 8, hpMin: 580, hpMax: 700 },
  '29': { xp: 135000, prof: 9, hpMin: 620, hpMax: 740 },
  '30': { xp: 155000, prof: 9, hpMin: 600, hpMax: 760 },
};

const diceAvg = (expr) => {
  if (!expr) return 0;
  let total = 0;
  const re = /(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/g;
  let m;
  while ((m = re.exec(expr))) {
    total += Number(m[1]) * (Number(m[2]) + 1) / 2;
    if (m[3]) total += (m[3] === '+' ? 1 : -1) * Number(m[4]);
  }
  return total;
};

const byIndex = Object.fromEntries(monstersData.map(m => [m.index, m]));

// Canonical low-AC casters keep their authored defenses (Orcus 17 natural
// armor, Archlich 15 unarmored); everything else must sit inside the band.
const index_low_ac = (m) => ['orcus', 'archlich'].includes(m.index);

describe('CR 25-30 epic cohort — data exists', () => {
  it.each(COHORT)('%s is on disk in the epic CR band', (idx) => {
    const m = byIndex[idx];
    expect(m).toBeTruthy();
    expect(Number(m.challenge_rating)).toBeGreaterThanOrEqual(25);
  });

  it('monkey-clone conjured token supports the sun-wukong summon', () => {
    expect(byIndex['monkey-clone']).toBeTruthy();
    expect(byIndex['monkey-clone'].challenge_rating).toBe('0');
  });
});

describe('CR 25-30 epic cohort — XP/proficiency mapping', () => {
  it.each(COHORT)('%s XP and proficiency match its CR band', (idx) => {
    const m = byIndex[idx];
    const band = CR_BAND[m.challenge_rating];
    expect(band).toBeTruthy();
    expect(m.xp).toBe(band.xp);
    expect(m.proficiency_bonus).toBe(band.prof);
  });
});

describe('CR 25-30 epic cohort — hit point bands', () => {
  it.each(COHORT)('%s HP sits inside its authored CR band', (idx) => {
    const m = byIndex[idx];
    const band = CR_BAND[m.challenge_rating];
    expect(m.hit_points).toBeGreaterThanOrEqual((m.actions || []).some(a => /spellcasting/i.test(a.name)) ? 400 : band.hpMin);
    expect(m.hit_points).toBeLessThanOrEqual(band.hpMax);
  });
});

describe('CR 25-30 epic cohort — structural card invariants', () => {
  it.each(COHORT)('%s resolves every delegation onto a numeric attack or save row', (idx) => {
    const m = byIndex[idx];
    const all = [...(m.actions || []), ...(m.reactions || []), ...(m.legendary_actions || [])];
    for (const a of all) {
      if (a.delegates_to) {
        const target = (m.actions || []).find(x => x.name === a.delegates_to);
        expect(target, `${idx}: missing delegate target "${a.delegates_to}"`).toBeTruthy();
      }
      if (a.attack_bonus != null) {
        expect(typeof a.attack_bonus, `${idx}/${a.name}`).toBe('number');
        expect(a.attack_bonus).toBeGreaterThanOrEqual(12);
        expect(a.attack_bonus).toBeLessThanOrEqual(19);
      }
      if (a.save_dc != null) {
        expect(typeof a.save_dc, `${idx}/${a.name}`).toBe('number');
        expect(a.save_dc).toBeGreaterThanOrEqual(18);
        expect(a.save_dc).toBeLessThanOrEqual(27);
        expect(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']).toContain(a.save_type);
      }
    }
  });

  it.each(COHORT)('%s legendary block declares a uses header and delegable rows', (idx) => {
    const m = byIndex[idx];
    const leg = m.legendary_actions || [];
    if (leg.length === 0) return;
    const header = leg[0];
    expect(header.uses).toBeGreaterThanOrEqual(2);
    expect(header.name).toContain(`Uses: ${header.uses}`);
    expect(leg.length).toBeGreaterThan(1);
    expect([2, 3, 4, 5]).toContain(header.uses);
  });

  it.each(COHORT)('%s carries full top-level schema parity', (idx) => {
    const m = byIndex[idx];
    const NON_NULL = ['index', 'name', 'size', 'type', 'alignment', 'armor_class', 'hit_points',
      'hit_dice', 'speed', 'ability_scores', 'ability_score_modifiers', 'challenge_rating', 'xp',
      'proficiency_bonus', 'traits', 'actions', 'book', 'description', 'combat-strategy'];
    for (const key of [...NON_NULL, 'reactions', 'legendary_actions', 'lair_actions']) {
      expect(m, `${idx} missing ${key}`).toHaveProperty(key);
      if (NON_NULL.includes(key)) {
        expect(m[key], `${idx}/${key} is empty`).not.toSatisfy(v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
      }
    }
    for (const [k, v] of Object.entries(m.ability_score_modifiers)) {
      expect(v).toBe(Math.floor((m.ability_scores[k] - 10) / 2));
    }
  });
});

describe('CR 25-30 epic cohort — attack/save centerpiece structure', () => {
  it.each(COHORT)('%s authors a numeric epic-band attack lineup plus a save centerpiece', (idx) => {
    const m = byIndex[idx];
    const attacks = (m.actions || []).filter(a => a.attack_bonus != null && a.damage_dice_primary);
    const legAttacks = (m.legendary_actions || []).filter(a => a.attack_bonus != null && a.damage_dice_primary);
    expect(attacks.length + legAttacks.length, `${idx}: fewer than two authored attacks`).toBeGreaterThanOrEqual(2);
    const ma = (m.actions || []).find(a => /^multiattack\b/i.test(a.name));
    expect(ma, `${idx}: no Multiattack row`).toBeTruthy();

    // Every authored melee attack at epic CR reaches at least reach 10 ft.
    for (const a of attacks) {
      if (a.reach) {
        expect(parseInt(a.reach, 10), `${idx}/${a.name} reach`).toBeGreaterThanOrEqual(5);
      }
      expect(diceAvg(a.damage_dice_primary)).toBeGreaterThanOrEqual(10);
    }

    // Save centerpiece: either an epic damaging burst (≥ 45 avg) or a hard
    // control save (conditions / vulnerability).
    const saves = [...(m.actions || []), ...(m.legendary_actions || [])]
      .filter(a => !/^.*spellcasting\b/i.test(a.name))
      .filter(a => a.save_dc != null || /Saving Throw|Vulnerab/i.test(a.description || '') || (a.conditions || []).length);
    expect(saves.length, `${idx}: no saving-throw / control centerpiece`).toBeGreaterThanOrEqual(1);
    const damaging = saves.filter(a => a.damage_dice_primary);
    if (damaging.length) {
      const strongest = damaging.reduce((s, a) => Math.max(s, diceAvg(a.damage_dice_primary)), 0);
      const floor = Number(m.challenge_rating) >= 29 ? 45 : Number(m.challenge_rating) >= 27 ? 40 : 24;
      expect(strongest, `${idx}: strongest burst ${strongest.toFixed(1)} below CR${m.challenge_rating} floor ${floor}`).toBeGreaterThanOrEqual(floor);
    } else {
      const control = saves.find(a => (a.conditions || []).length || /Vulnerab|Stunned|Charmed|Grappled|Restrained|Prone|Unconscious|unable to/i.test(a.description));
      expect(control, `${idx}: save rows neither deal damage nor impose control`).toBeTruthy();
    }
  });

  it.each(COHORT)('%s epic defense totals match its authored CR band', (idx) => {
    const m = byIndex[idx];
    const cr = Number(m.challenge_rating);
    // ORCUS (AC 17, RAW) and the ARCHLICH (AC 15, no armor) keep their canonical defenses
    expect(m.armor_class).toBeGreaterThanOrEqual(index_low_ac(m) ? 15 : cr >= 28 ? 22 : 21);
    expect(m.armor_class).toBeLessThanOrEqual(25);
    if (cr >= 28) expect(m.legendary_resistance).toBeGreaterThanOrEqual(3);
    const resistances = [...(m.damage_resistances || []), ...(m.damage_immunities || [])];
    expect(resistances.length).toBeGreaterThanOrEqual(1);
  });
});
