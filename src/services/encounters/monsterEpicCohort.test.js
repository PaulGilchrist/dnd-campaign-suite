// @maintained-by-ai
// CR 25-30 epic cohort — cross-cohort data integrity for the epic-monster
// batch in public/data/monsters.json (official reprints, licensed icons,
// original history/legend blocks).
//
// Feature-family map: per-monster row bytes (legendary delegates, saves,
// recharges, summons) are owned by the .ma*/feature lane tests
// (monsterLegendaryUses.*, saveProcessing.*, monsterRecharge.*, etc.);
// sun-wukong's monkey-clone token is owned by
// monsterSummon.sun-wukong-monkey-clones.test.js (disk-loaded there, token
// AC/HP/attack bytes pinned — no duplicate here). THIS file owns only the
// cohort-wide invariants the engine seams and the encounter builder need:
// DMG 2024 CR-band pins and resolution-through-the-real-consumers.
//
// old→new: "data exists" + "XP/proficiency" + "HP bands" + "defense totals"
// → one band-pin table; "structural card invariants" + "attack/save
// centerpiece" → one engine-seam table (assertions now run through the real
// monsterLegendaryUses.js consumers; the diceAvg burst-floor branch is
// dropped — dice bytes live verbatim in the .ma* lane tests).
import { describe, it, expect } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction,
  legendaryDelegateAction,
  legendaryMaxUses,
  legendaryActionCost,
} from './monsterLegendaryUses.js';

const COHORT = [
  'demogorgon', 'orcus', 'tiamat',
  'archlich', 'cthulhu', 'godzilla', 'king-kong', 'smaug-the-golden',
  'apep', 'behemoth', 'fenrir', 'garuda', 'garmr', 'jormungandr', 'ladon',
  'nidhogg', 'quetzalcoatl', 'scylla', 'simurgh', 'sun-wukong',
  'thunderbird', 'typhon', 'yamata-no-orochi', 'ymir', 'ziz', 'zmey-gorynych',
];

// DMG 2024 Monster Statistics by CR — XP and HP band authored targets.
// Only CRs present in this cohort are tabulated; a future CR-29 member
// fails loudly here until its band is added.
const CR_BAND = {
  '25': { xp: 75000, prof: 8, hpMin: 440, hpMax: 560 },
  '26': { xp: 90000, prof: 8, hpMin: 400, hpMax: 620 },
  '27': { xp: 105000, prof: 8, hpMin: 540, hpMax: 660 },
  '28': { xp: 120000, prof: 8, hpMin: 580, hpMax: 700 },
  '29': { xp: 135000, prof: 9, hpMin: 620, hpMax: 740 },
  '30': { xp: 155000, prof: 9, hpMin: 600, hpMax: 760 },
};

// Named RAW exceptions — canonical casters keep their authored defenses.
// Orcus AC 17 (natural armor), Archlich AC 15 (unarmored mage) / HP floor
// 400 (below its CR-30 band; §384 authoring decision).
const LOW_AC = { orcus: 17, archlich: 15 };
const HP_FLOOR_OVERRIDES = { archlich: 400 };

const SAVE_TYPES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

const byIndex = Object.fromEntries(monstersData.map(m => [m.index, m]));

describe('CR 25-30 epic cohort — DMG band pins', () => {
  it.each(COHORT)('%s exists with XP/prof/HP/AC inside its authored CR band', (idx) => {
    const m = byIndex[idx];
    expect(m, `${idx} missing from monsters.json`).toBeTruthy();
    const cr = Number(m.challenge_rating);
    const band = CR_BAND[m.challenge_rating];
    expect(band, `${idx}: CR ${m.challenge_rating} has no band entry`).toBeTruthy();
    expect(cr).toBeGreaterThanOrEqual(25);
    expect(m.xp, `${idx} xp`).toBe(band.xp);
    expect(m.proficiency_bonus, `${idx} prof`).toBe(band.prof);
    expect(m.hit_points, `${idx} hp`).toBeGreaterThanOrEqual(HP_FLOOR_OVERRIDES[idx] ?? band.hpMin);
    expect(m.hit_points, `${idx} hp`).toBeLessThanOrEqual(band.hpMax);
    expect(m.armor_class, `${idx} ac`).toBeGreaterThanOrEqual(LOW_AC[idx] ?? (cr >= 28 ? 22 : 21));
    expect(m.armor_class, `${idx} ac`).toBeLessThanOrEqual(25);
    expect([...(m.damage_resistances || []), ...(m.damage_immunities || [])].length, `${idx} res+immunity`).toBeGreaterThanOrEqual(1);
    // RAW scaling: legendary resistances join at CR 21+; every CR 28+ epic keeps ≥3.
    if (cr >= 28) expect(m.legendary_resistance, `${idx} LR`).toBeGreaterThanOrEqual(3);
  });
});

describe('CR 25-30 epic cohort — engine seams resolve through real consumers', () => {
  // monsterLegendaryUses.js is the production reader of these fields; a
  // shape it cannot consume is a dead button on the monster card.
  it.each(COHORT)('%s legendary economy: real header reader, every child affordable, every delegate lands on a numeric row', (idx) => {
    const m = byIndex[idx];
    expect(m, `${idx} missing from monsters.json`).toBeTruthy();
    const leg = m.legendary_actions || [];
    expect(leg.length, `${idx}: epic monster without legendary actions`).toBeGreaterThanOrEqual(2);

    const header = legendaryHeaderAction(m);
    expect(header, `${idx}: legendaryHeaderAction found no uses header at [0]`).toBe(leg[0]);
    const max = legendaryMaxUses(header, {});
    expect(max).toBeGreaterThanOrEqual(2);
    expect(max).toBeLessThanOrEqual(5);
    // Card displays the header row's name — the count must be readable there.
    expect(header.name, `${idx} header label`).toContain(`Uses: ${max}`);

    for (const child of leg.slice(1)) {
      // A child whose parsed cost exceeds the pool can never be pressed.
      expect(legendaryActionCost(child), `${idx}/${child.name} cost > pool ${max}`).toBeLessThanOrEqual(max);
    }

    const rows = [...(m.actions || []), ...(m.reactions || []), ...leg];
    for (const row of rows.filter(a => a.delegates_to)) {
      const target = legendaryDelegateAction(m, row);
      expect(target, `${idx}: delegates_to "${row.delegates_to}" dangles`).toBeTruthy();
      expect(target.attack_bonus != null || target.save_dc != null,
        `${idx}/${row.name} delegates to non-numeric row "${target.name}"`).toBe(true);
    }
  });

  it.each(COHORT)('%s attacks and saves carry engine-consumable numeric fields in epic bands', (idx) => {
    const m = byIndex[idx];
    const rows = [...(m.actions || []), ...(m.reactions || []), ...(m.legendary_actions || [])];
    const attacks = rows.filter(a => a.attack_bonus != null);
    const saves = rows.filter(a => a.save_dc != null);
    for (const a of attacks) {
      expect(typeof a.attack_bonus, `${idx}/${a.name}`).toBe('number');
      expect(a.attack_bonus).toBeGreaterThanOrEqual(12);
      expect(a.attack_bonus).toBeLessThanOrEqual(19);
    }
    for (const a of saves) {
      expect(typeof a.save_dc, `${idx}/${a.name}`).toBe('number');
      expect(a.save_dc).toBeGreaterThanOrEqual(18);
      expect(a.save_dc).toBeLessThanOrEqual(27);
      expect(SAVE_TYPES, `${idx}/${a.name} save_type`).toContain(a.save_type);
    }
    expect(attacks.length, `${idx}: fewer than two attack rows`).toBeGreaterThanOrEqual(2);
    expect(saves.length, `${idx}: no saving-throw row`).toBeGreaterThanOrEqual(1);
    expect((m.actions || []).some(a => /^multiattack\b/i.test(a.name)), `${idx}: no Multiattack row`).toBe(true);
  });
});

describe('CR 25-30 epic cohort — card schema parity', () => {
  it.each(COHORT)('%s carries the full stat-block schema the monster card reads', (idx) => {
    const m = byIndex[idx];
    const NON_EMPTY = ['index', 'name', 'size', 'type', 'alignment', 'armor_class', 'hit_points',
      'hit_dice', 'speed', 'ability_scores', 'ability_score_modifiers', 'challenge_rating', 'xp',
      'proficiency_bonus', 'traits', 'actions', 'book', 'description', 'combat-strategy'];
    for (const key of [...NON_EMPTY, 'reactions', 'legendary_actions', 'lair_actions']) {
      expect(m, `${idx} missing ${key}`).toHaveProperty(key);
      const v = m[key];
      if (!NON_EMPTY.includes(key)) continue;
      expect(v, `${idx}.${key} is empty`).not.toSatisfy(x => x === undefined || x === null || x === '' || (Array.isArray(x) && x.length === 0));
    }
    // Card-derived modifiers must match the RAW scores they display beside.
    for (const [k, v] of Object.entries(m.ability_score_modifiers)) {
      expect(v, `${idx}.${k}`).toBe(Math.floor((m.ability_scores[k] - 10) / 2));
    }
  });
});
