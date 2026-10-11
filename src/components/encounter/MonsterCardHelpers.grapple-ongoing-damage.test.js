// MA-1842: Apep Constrict ongoing grapple-damage rider — parser seam lock.
// grapple_ongoing_damage:{dice,damage_type} arms ONLY on the structured key
// (MA-0367/MA-0639 STRUCTURED-KEY-ONLY precedent); the parsed rider rides the
// MA-0010 hit-clause transport (buildHitConditionClause) beside escape_dc so
// handlePlainDamage can register the tick te on the resolved grapple hit.
import { describe, it, expect } from 'vitest';
import { parseGrappleOngoingDamage, buildHitConditionClause } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const APEP_CONSTRICT = monsters.find(m => m.name === 'Apep')?.actions?.find(a => a.name === 'Constrict');

describe('MA-1842 parseGrappleOngoingDamage', () => {
    it('parses the structured rider key with dice + damage type', () => {
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: { dice: '4d8', damage_type: 'Bludgeoning' } }))
            .toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
    });

    it('defaults the damage type to Bludgeoning (grapple family) when omitted', () => {
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: { dice: '4d8' } }))
            .toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
    });

    it('is byte-inert null without the structured key (prose never arms)', () => {
        expect(parseGrappleOngoingDamage(undefined)).toBeNull();
        expect(parseGrappleOngoingDamage({ name: 'Constrict', description: 'takes 18 (4d8) Bludgeoning damage at the start of every turn' })).toBeNull();
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: {} })).toBeNull();
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: { dice: '  ' } })).toBeNull();
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: '4d8' })).toBeNull();
    });
});

describe('MA-1842 Apep Constrict disk row', () => {
    it('authors escape_dc 26 + structured ongoing 4d8 Bludgeoning (Vine Blight byte-shape + rider)', () => {
        expect(APEP_CONSTRICT).toBeTruthy();
        expect(APEP_CONSTRICT.attack_bonus).toBe(18);
        expect(APEP_CONSTRICT.hit_conditions).toEqual(['grappled']);
        expect(APEP_CONSTRICT.escape_dc).toBe(26);
        expect(APEP_CONSTRICT.grapple_ongoing_damage).toEqual({ dice: '4d8', damage_type: 'Bludgeoning' });
    });

    it('keeps sibling constrict rows byte-untouched by the rider key', () => {
        const vine = monsters.find(m => m.name === 'Vine Blight')?.actions?.find(a => a.name === 'Constricting Vine');
        expect(vine?.escape_dc).toBe(12);
        expect(vine?.grapple_ongoing_damage).toBeUndefined();
    });
});

describe('MA-1842 buildHitConditionClause threading', () => {
    it('carries grappleOngoingDamage + escapeDc on the Apep clause', () => {
        const clause = buildHitConditionClause(APEP_CONSTRICT);
        expect(clause.conditions).toEqual(['grappled']);
        expect(clause.escapeDc).toBe(26);
        expect(clause.grappleOngoingDamage).toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
    });

    it('omits the grappleOngoingDamage key entirely for unauthored rows (byte-inert)', () => {
        const clause = buildHitConditionClause({ name: 'Tentacle Lash', attack_bonus: 7, hit_conditions: ['grappled'], escape_dc: 14 });
        expect(clause).not.toHaveProperty('grappleOngoingDamage');
    });

    it('arms a clause from the rider alone when no conditions are listed (guard, never over-grants)', () => {
        const clause = buildHitConditionClause({ name: 'Test', grapple_ongoing_damage: { dice: '2d6', damage_type: 'Piercing' } });
        expect(clause).toBeTruthy();
        expect(clause.conditions).toEqual([]);
        expect(clause.grappleOngoingDamage).toEqual({ dice: '2d6', damageType: 'Piercing' });
    });
});
