// @maintained-by-ai
// Backlog (2026-11-12 WY) ai-dress-hides-vocabulary — the dress lane is
// ITEM-ops-only (validateLiveDressPlan rejects structural targets, pinned
// server entitySchemas.test.js:164). These pure predicates drive the modal's
// capability sentinel: fire ONLY for a structure-implied ask answered with an
// items-only proposal, never for plain furniture asks.
import { describe, it, expect } from 'vitest';
import {
    instructionImpliesStructure,
    proposalIncludesStructuralOps,
    dressStructureNotice,
    STRUCTURE_SENTINEL,
} from './dressCapabilities.js';

describe('instructionImpliesStructure', () => {
    it('flags structural asks (the live WY-descent wording and its variants)', () => {
        expect(instructionImpliesStructure('enclose the room with walls')).toBe(true);
        expect(instructionImpliesStructure('Build a WALL around the throne')).toBe(true);
        expect(instructionImpliesStructure('enclose the chamber')).toBe(true);
        expect(instructionImpliesStructure('partition the hall with a barrier')).toBe(true);
        expect(instructionImpliesStructure('add a staircase to the upper level')).toBe(true);
        expect(instructionImpliesStructure('brick up the doorway')).toBe(true);
        expect(instructionImpliesStructure('fence off the clearing')).toBe(true);
        expect(instructionImpliesStructure('make structural changes to the keep')).toBe(true);
    });

    it('stays quiet on item-class asks (no false positives)', () => {
        expect(instructionImpliesStructure('add a table at 10,10 and two chairs')).toBe(false);
        expect(instructionImpliesStructure('add a trapped chest guarding the throne room, then line the gallery with banners')).toBe(false);
        expect(instructionImpliesStructure('add a door at 5,5')).toBe(false); // door is an advertised item TYPE
        expect(instructionImpliesStructure('add a chest beside the window')).toBe(false); // window names a prop too
    });

    it('tolerates junk input', () => {
        expect(instructionImpliesStructure('')).toBe(false);
        expect(instructionImpliesStructure(null)).toBe(false);
        expect(instructionImpliesStructure(undefined)).toBe(false);
        expect(instructionImpliesStructure(42)).toBe(false);
    });
});

describe('proposalIncludesStructuralOps', () => {
    it('recognises the item-class targets the schema validates', () => {
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 1, gridY: 2 },
            { op: 'add', target: 'poi', poi: { name: 'Shrine' }, gridX: 3, gridY: 4 },
            { op: 'add', target: 'token', token: { name: 'Goblin' }, gridX: 5, gridY: 6 },
        ])).toBe(false);
    });

    it('flags any non-item-class target (future-vocabulary honesty)', () => {
        expect(proposalIncludesStructuralOps([{ op: 'add', target: 'wall' }])).toBe(true);
        expect(proposalIncludesStructuralOps([])).toBe(false);
        expect(proposalIncludesStructuralOps(null)).toBe(false);
        expect(proposalIncludesStructuralOps([null])).toBe(false);
    });
});

describe('dressStructureNotice', () => {
    const itemsOnly = { ops: [{ op: 'add', target: 'item', item: { type: 'table' }, gridX: 10, gridY: 10 }] };

    it('sentinels a structure-implied ask answered with items-only ops', () => {
        expect(dressStructureNotice('enclose the room with walls', itemsOnly)).toBe(STRUCTURE_SENTINEL);
        expect(STRUCTURE_SENTINEL).toBe('The model proposed no structural changes (dress supports items only).');
    });

    it('stays silent for purely item-only instructions (criterion 3)', () => {
        expect(dressStructureNotice('add a table at 10,10 and two chairs', itemsOnly)).toBeNull();
        expect(dressStructureNotice('trap the throne room', itemsOnly)).toBeNull();
    });

    it('stays silent before a proposal exists and when ops really are structural', () => {
        expect(dressStructureNotice('enclose the room with walls', null)).toBeNull();
        expect(dressStructureNotice('enclose the room with walls', { ops: [{ op: 'add', target: 'wall' }] })).toBeNull();
    });
});
