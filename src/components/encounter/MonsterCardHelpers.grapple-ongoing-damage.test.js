// @maintained-by-ai: 2026-10-18
// MA-1842: Apep Constrict ongoing grapple-damage rider — parser seam lock.
// grapple_ongoing_damage:{dice,damage_type} arms ONLY on the structured key
// (MA-0367/MA-0639 STRUCTURED-KEY-ONLY precedent); the parsed rider rides the
// MA-0010 hit-clause transport (buildHitConditionClause) beside escape_dc so
// handlePlainDamage can register the tick te on the resolved grapple hit.
// Turn-seam ticking lives in the consumer lanes (handlePlainDamage producer +
// constrictGrappleService turn-start tick — never a wall-clock clock here);
// Apep/Ladon disk fingerprints are owned by monsterHitConditions.ma1939.
import { describe, it, expect } from 'vitest';
import { parseGrappleOngoingDamage, buildHitConditionClause } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const APEP_CONSTRICT = monsters.find(m => m.name === 'Apep')?.actions?.find(a => a.name === 'Constrict');
const VINE_CONSTRICT = monsters.find(m => m.name === 'Vine Blight')?.actions?.find(a => a.name === 'Constricting Vine');

describe('MA-1842 parseGrappleOngoingDamage', () => {
    it('compiles the structured key branch table (dice normalised lowercase/trim, damage type default)', () => {
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: { dice: ' 4D8 ', damage_type: 'Piercing' } }))
            .toEqual({ dice: '4d8', damageType: 'Piercing' });
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: { dice: '4d8' } }))
            .toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
        expect(parseGrappleOngoingDamage({ grapple_ongoing_damage: { dice: '4d8', damage_type: '   ' } }))
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

describe('MA-1842 buildHitConditionClause threading', () => {
    it('threads the Apep Constrict disk row: grappled + escapeDc 26 + compiled rider (BY-name fixture)', () => {
        const clause = buildHitConditionClause(APEP_CONSTRICT);
        expect(clause.conditions).toEqual(['grappled']);
        expect(clause.escapeDc).toBe(26);
        expect(clause.grappleOngoingDamage).toEqual({ dice: '4d8', damageType: 'Bludgeoning' });
    });

    it('leaves the Vine Blight sibling byte-inert — clause carries grappled + escapeDc 12, key absent (disk)', () => {
        const clause = buildHitConditionClause(VINE_CONSTRICT);
        expect(clause).not.toHaveProperty('grappleOngoingDamage');
        expect(clause.conditions).toEqual(['grappled']);
        expect(clause.escapeDc).toBe(12);
    });

    it('arms a clause from the rider alone when no conditions are listed (guard, never over-grants)', () => {
        const clause = buildHitConditionClause({ name: 'Test', grapple_ongoing_damage: { dice: '2d6', damage_type: 'Piercing' } });
        expect(clause).toBeTruthy();
        expect(clause.conditions).toEqual([]);
        expect(clause.grappleOngoingDamage).toEqual({ dice: '2d6', damageType: 'Piercing' });
    });
});
