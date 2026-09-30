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

    it('authors hit_hp_max_reduce + hit_attacker_recover {equal_to:"secondary"} after the secondary pool keys', () => {
        expect(BITE.hit_hp_max_reduce).toEqual({ equal_to: 'secondary' });
        expect(BITE.hit_attacker_recover).toEqual({ equal_to: 'secondary' });
        const keys = Object.keys(BITE);
        expect(keys.indexOf('hit_hp_max_reduce')).toBe(keys.indexOf('damage_type_secondary') + 1);
        expect(keys.indexOf('hit_attacker_recover')).toBe(keys.indexOf('hit_hp_max_reduce') + 1);
    });

    it('the Shadow Strike twin row on the SAME monster stays rider-free (per-row wording discipline)', () => {
        expect(SHADOW_STRIKE.hit_hp_max_reduce).toBeUndefined();
        expect(SHADOW_STRIKE.hit_attacker_recover).toBeUndefined();
        expect(parseHitHpMaxReduce(SHADOW_STRIKE)).toBeNull();
        expect(parseHitAttackerRecover(SHADOW_STRIKE)).toBeNull();
    });
});

describe('MA-1645 parseHitHpMaxReduce magnitude scope', () => {
    it('accepts equal_to:"secondary" as {equalTo:"secondary"}', () => {
        expect(parseHitHpMaxReduce(BITE)).toEqual({ equalTo: 'secondary' });
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'Secondary' } })).toEqual({ equalTo: 'secondary' });
    });

    it('existing equal_to:"damage" rows parse byte-identically (Specter twin)', () => {
        expect(parseHitHpMaxReduce(SPECTER_DRAIN)).toEqual({ equalTo: 'damage' });
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'damage' } })).toEqual({ equalTo: 'damage' });
    });

    it('structured-key-only: garbage scopes and string rows stay inert', () => {
        expect(parseHitHpMaxReduce({})).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: {} })).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'healing' } })).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: { equal_to: 'primary' } })).toBeNull();
        expect(parseHitHpMaxReduce({ hit_hp_max_reduce: 'secondary' })).toBeNull();
    });
});

describe('MA-1645 parseHitAttackerRecover (MA-1639 grammar mirror, hit lane)', () => {
    it('arms ONLY on the structured hit_attacker_recover dict', () => {
        expect(parseHitAttackerRecover(BITE)).toEqual({ equalTo: 'secondary' });
        expect(parseHitAttackerRecover({ hit_attacker_recover: { equal_to: 'damage' } })).toEqual({ equalTo: 'damage' });
        expect(parseHitAttackerRecover({})).toBeNull();
        expect(parseHitAttackerRecover({ hit_attacker_recover: {} })).toBeNull();
        expect(parseHitAttackerRecover({ hit_attacker_recover: { equal_to: 'half' } })).toBeNull();
        expect(parseHitAttackerRecover({ hit_attacker_recover: 'damage' })).toBeNull();
        expect(parseHitAttackerRecover(SPECTER_DRAIN)).toBeNull();
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

    it('clauseless rows stay null', () => {
        const banditRow = monsters.find((m) => m.name === 'Bandit').actions.find((a) => a.attack_bonus != null);
        expect(buildHitConditionClause(banditRow)).toBeNull();
        expect(buildHitConditionClause(SHADOW_STRIKE)).toBeNull();
    });
});
