// @maintained-by-ai
// MA-1645: Vampire Nightbringer "Bite" (actions[1], +7 melee, 1d6 + 4
// Piercing plus 3d6 Necrotic) — disk RAW: "The target's Hit Point maximum
// decreases by an amount equal to the Necrotic damage taken, and the vampire
// regains Hit Points equal to that amount." Fix:
// (1) parseHitHpMaxReduce magnitude scope extended to equal_to:"secondary"
//     (plain equal_to:"damage" byte-twin would drain the PRIMARY Piercing-
//     only magnitude — the WRONG pool; §1096 honesty flag in the bug file);
//     every existing equal_to:"damage" row (Specter + succubus-lane twins)
//     stays byte-identical;
// (2) NEW structured hit_attacker_recover key + parseHitAttackerRecover —
//     the ATTACK-lane twin of MA-1639's save_attacker_recover (same grammar,
//     structured-key-only, byte-inert without the key);
// (3) DATA: both keys authored equal_to:"secondary" on the Nightbringer row.
// Trimmed to distinct-branch truth tables: drain/regain CONSUMER behavior
// lives in handlePlainDamage.ma1645-nightbringer-bite-drain.test.js; plain
// clauseless-row null is owned by handlePlainDamage.hitClause.test.js
// (:211-215, specter absent from its HIT_CLAUSE_ROWS by name); other-monster
// fingerprint pins cut per #554.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHitHpMaxReduce, parseHitAttackerRecover, buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const NIGHTBRINGER = monsters.find((m) => m.index === 'vampire-nightbringer');
const BITE = NIGHTBRINGER.actions[1];
const SHADOW_STRIKE = NIGHTBRINGER.actions[2];
const SPECTER_DRAIN = monsters.find((m) => m.index === 'specter').actions[0];

describe('MA-1645 disk fingerprint: vampire-nightbringer Bite rider keys', () => {
    it('keeps the adjudication bytes unchanged (+7 melee, dual pools)', () => {
        expect(BITE.name).toBe('Bite');
        expect(BITE.attack_bonus).toBe(7);
        expect(BITE.reach).toBe('5 ft.');
        expect(BITE.damage_dice_primary).toBe('1d6 + 4');
        expect(BITE.damage_type_primary).toBe('Piercing');
        expect(BITE.damage_dice_secondary).toBe('3d6');
        expect(BITE.damage_type_secondary).toBe('Necrotic');
        expect(BITE.description).toBe('Melee Attack Roll: +7, reach 5 ft. Hit: 7 (1d6 + 4) Piercing damage plus 10 (3d6) Necrotic damage. The target\'s Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.');
    });

    it('authors hit_hp_max_reduce + hit_attacker_recover {equal_to:"secondary"} riders on the Bite row', () => {
        expect(BITE.hit_hp_max_reduce).toEqual({ equal_to: 'secondary' });
        expect(BITE.hit_attacker_recover).toEqual({ equal_to: 'secondary' });
    });

    it('the Shadow Strike twin row on the SAME monster stays rider-free (per-row wording discipline)', () => {
        expect(SHADOW_STRIKE.hit_hp_max_reduce).toBeUndefined();
        expect(SHADOW_STRIKE.hit_attacker_recover).toBeUndefined();
        expect(buildHitConditionClause(SHADOW_STRIKE)).toBeNull();
    });
});

describe('MA-1645 parser truth tables (structured-key-only, hit lane)', () => {
    it('parseHitHpMaxReduce arms damage and secondary scopes; specter twin byte-identical', () => {
        expect(parseHitHpMaxReduce(BITE)).toEqual({ equalTo: 'secondary' });
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'Secondary' } })).toEqual({ equalTo: 'secondary' });
        expect(parseHitHpMaxReduce(SPECTER_DRAIN)).toEqual({ equalTo: 'damage' });
    });

    it('parseHitHpMaxReduce negatives once per branch: no-key / string-row / wrong-pool scope', () => {
        expect(parseHitHpMaxReduce({})).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: 'secondary' })).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'primary' } })).toBeNull();
    });

    it('parseHitAttackerRecover arms ONLY the structured dict (MA-1639 grammar mirror)', () => {
        expect(parseHitAttackerRecover(BITE)).toEqual({ equalTo: 'secondary' });
        expect(parseHitAttackerRecover({ hit_attacker_recover: { equal_to: 'damage' } })).toEqual({ equalTo: 'damage' });
        expect(parseHitAttackerRecover({})).toBeNull();
        expect(parseHitAttackerRecover({ hit_attacker_recover: 'damage' })).toBeNull();
        expect(parseHitAttackerRecover({ hit_attacker_recover: { equal_to: 'half' } })).toBeNull();
    });
});

describe('MA-1645 buildHitConditionClause threading + byte-inertia', () => {
    it('nightbringer clause carries BOTH riders on the standard payload', () => {
        expect(buildHitConditionClause(BITE)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: null,
            hpMaxReduce: { equalTo: 'secondary' },
            attackerRecover: { equalTo: 'secondary' },
        });
    });

    it('specter clause is byte-identical to the pre-fix shape (no attackerRecover key)', () => {
        expect(buildHitConditionClause(SPECTER_DRAIN)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Life Drain',
            targetEffect: null,
            hpMaxReduce: { equalTo: 'damage' },
        });
    });
});
