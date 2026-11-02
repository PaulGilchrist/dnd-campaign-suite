// @maintained-by-ai
// Lane: creatureControl.js controller resolution (Phase 2). Precedence table:
// explicit assignment > player-sourced summoned te > form sources > summonedBy
// (player caster only) > null. Owned elsewhere: assignment writes + logging
// (createCreatureHandlers.control.test.js), card gating (CreatureCard.control.test.jsx).
import { describe, it, expect } from 'vitest';
import { getCreatureController, isCreatureControlled } from './creatureControl.js';

const players = [
    { name: 'Alice', type: 'player' },
    { name: 'Bob', type: 'player' },
];
const roster = [...players, { name: 'Zombie', type: 'npc' }, { name: 'Drow Mage 1', type: 'npc' }];

describe('getCreatureController', () => {
    it('null creature → null', () => {
        expect(getCreatureController(null, roster)).toBeNull();
    });

    it('unassigned NPC with no lanes → null (GM only)', () => {
        expect(getCreatureController({ name: 'Zombie', type: 'npc' }, roster)).toBeNull();
    });

    it('explicit controller wins over every derived lane', () => {
        const zombie = { name: 'Zombie', type: 'npc', controller: 'Bob', summonedBy: 'Alice' };
        const te = [{ effect: 'summoned', source: 'Alice' }];
        expect(getCreatureController(zombie, roster, te)).toBe('Bob');
    });

    it('player-sourced summoned te controls non-player creatures', () => {
        const fairy = { name: 'Fairy', type: 'npc' };
        expect(getCreatureController(fairy, roster, [{ effect: 'summoned', source: 'Alice' }])).toBe('Alice');
    });

    it('summoned te from a non-player source is ignored', () => {
        const imp = { name: 'Imp', type: 'npc' };
        expect(getCreatureController(imp, roster, [{ effect: 'summoned', source: 'Drow Mage 1' }])).toBeNull();
    });

    it('wild-shape / shapechange forms resolve to their player source', () => {
        expect(getCreatureController({ name: 'Wolf Form', type: 'npc', wildShapeSource: 'Alice' }, roster)).toBe('Alice');
        expect(getCreatureController({ name: 'Giant Ape', type: 'npc', shapechangeSource: 'Bob' }, roster)).toBe('Bob');
    });

    it('summonedBy resolves only when the caster is a player on the roster', () => {
        expect(getCreatureController({ name: 'Skeleton', type: 'npc', summonedBy: 'Alice' }, roster)).toBe('Alice');
        expect(getCreatureController({ name: 'Monkey Clone', type: 'npc', summonedBy: 'Drow Mage 1' }, roster)).toBeNull();
    });

    it('a plain player row (no form source) stays uncontrolled', () => {
        expect(getCreatureController({ name: 'Alice', type: 'player' }, roster, [{ effect: 'summoned', source: 'Bob' }])).toBeNull();
    });

    it('explicit controller may be released to null and falls through to derived lanes', () => {
        const summoned = { name: 'Fairy', type: 'npc', controller: null, summonedBy: 'Alice' };
        expect(getCreatureController(summoned, roster)).toBe('Alice');
    });
});

describe('isCreatureControlled', () => {
    it('boolean mirror of the resolver', () => {
        expect(isCreatureControlled({ name: 'Zombie', type: 'npc', controller: 'Bob' }, roster)).toBe(true);
        expect(isCreatureControlled({ name: 'Zombie', type: 'npc' }, roster)).toBe(false);
    });
});
