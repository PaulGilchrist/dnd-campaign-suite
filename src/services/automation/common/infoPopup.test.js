// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { infoPopup } from './infoPopup.js';

// ── Tests ───────────────────────────────────────────────────────

describe('infoPopup', () => {
    describe('basic structure', () => {
        it('returns an object with type "popup"', () => {
            const result = infoPopup('Test Action', 'Description', {});
            expect(result.type).toBe('popup');
        });

        it('returns an object with payload containing type "automation_info"', () => {
            const result = infoPopup('Test Action', 'Description', {});
            expect(result.payload.type).toBe('automation_info');
        });

        it('stores actionName in payload.name', () => {
            const result = infoPopup('Shadowy Dodge', 'desc', {});
            expect(result.payload.name).toBe('Shadowy Dodge');
        });

        it('stores description in payload.description', () => {
            const result = infoPopup('Action', 'My description', {});
            expect(result.payload.description).toBe('My description');
        });

        it('stores automation object in payload.automation', () => {
            const automation = { action: { name: 'Test' } };
            const result = infoPopup('Action', 'desc', automation);
            expect(result.payload.automation).toBe(automation);
        });
    });

    describe('extraProps merging', () => {
        it('does not merge when extraProps is undefined', () => {
            const result = infoPopup('Action', 'desc', {}, undefined);
            expect(Object.keys(result)).toEqual(['type', 'payload']);
        });

        it('does not merge when extraProps is null', () => {
            const result = infoPopup('Action', 'desc', {}, null);
            expect(Object.keys(result)).toEqual(['type', 'payload']);
        });

        it('does not merge when extraProps is an empty object', () => {
            const result = infoPopup('Action', 'desc', {}, {});
            expect(Object.keys(result)).toEqual(['type', 'payload']);
        });

        it('merges extraProps onto the top-level result object', () => {
            const result = infoPopup('Action', 'desc', {}, { defenderHp: 10 });
            expect(result.defenderHp).toBe(10);
        });

        it('merges multiple extraProps fields', () => {
            const result = infoPopup('Action', 'desc', {}, {
                defenderHp: 10,
                defenderName: 'Goblin',
            });
            expect(result.defenderHp).toBe(10);
            expect(result.defenderName).toBe('Goblin');
        });

        it('allows extraProps to overwrite type and payload when provided (Object.assign behavior)', () => {
            const result = infoPopup('Action', 'desc', {}, {
                type: 'override',
                payload: { type: 'override' },
            });
            expect(result.type).toBe('override');
            expect(result.payload.type).toBe('override');
        });

        it('does not overwrite payload.name when extraProps contains name', () => {
            const result = infoPopup('Real Name', 'desc', {}, { name: 'Fake' });
            expect(result.payload.name).toBe('Real Name');
        });

        it('does not overwrite payload.description when extraProps contains description', () => {
            const result = infoPopup('Action', 'Real Desc', {}, { description: 'Fake' });
            expect(result.payload.description).toBe('Real Desc');
        });

        it('does not overwrite payload.automation when extraProps contains automation', () => {
            const automation = { real: true };
            const result = infoPopup('Action', 'desc', automation, { automation: { fake: true } });
            expect(result.payload.automation).toBe(automation);
        });
    });

    describe('string handling', () => {
        it('handles empty string actionName', () => {
            const result = infoPopup('', 'desc', {});
            expect(result.payload.name).toBe('');
        });

        it('handles empty string description', () => {
            const result = infoPopup('Action', '', {});
            expect(result.payload.description).toBe('');
        });

        it('handles HTML-like strings in description', () => {
            const htmlDesc = '<b>Bold Text</b><br/>Line break';
            const result = infoPopup('Action', htmlDesc, {});
            expect(result.payload.description).toBe(htmlDesc);
        });

        it('handles multiline description', () => {
            const multiLine = 'Line 1\nLine 2\nLine 3';
            const result = infoPopup('Action', multiLine, {});
            expect(result.payload.description).toBe(multiLine);
        });
    });

    describe('automation parameter variants', () => {
        it('handles empty object automation', () => {
            const result = infoPopup('Action', 'desc', {});
            expect(result.payload.automation).toEqual({});
        });

        it('handles null automation', () => {
            const result = infoPopup('Action', 'desc', null);
            expect(result.payload.automation).toBeNull();
        });

        it('handles undefined automation', () => {
            const result = infoPopup('Action', 'desc');
            expect(result.payload.automation).toBeUndefined();
        });

        it('handles complex automation object', () => {
            const automation = {
                action: { name: 'Test', type: 'action' },
                metadata: { source: 'test' },
            };
            const result = infoPopup('Action', 'desc', automation);
            expect(result.payload.automation).toBe(automation);
        });
    });

    describe('extraProps edge cases', () => {
        it('merges a single extraProp field correctly', () => {
            const result = infoPopup('Action', 'desc', {}, { defenderHp: 5 });
            expect(result.defenderHp).toBe(5);
        });

        it('handles extraProps with prototype properties', () => {
            const extra = Object.create({ inherited: true });
            extra.own = 'value';
            const result = infoPopup('Action', 'desc', {}, extra);
            expect(result.own).toBe('value');
        });

        it('extraProps with symbol keys are not copied by Object.assign', () => {
            const sym = Symbol('test');
            const extra = { [sym]: 'symbol-value', normal: 'normal-value' };
            const result = infoPopup('Action', 'desc', {}, extra);
            expect(result.normal).toBe('normal-value');
            expect(result[sym]).toBe('symbol-value');
        });
    });

    describe('object identity', () => {
        it('returns a new object each call', () => {
            const result1 = infoPopup('Action', 'desc', {});
            const result2 = infoPopup('Action', 'desc', {});
            expect(result1).not.toBe(result2);
        });

        it('payload is a new object each call', () => {
            const result1 = infoPopup('Action', 'desc', {});
            const result2 = infoPopup('Action', 'desc', {});
            expect(result1.payload).not.toBe(result2.payload);
        });
    });
});
