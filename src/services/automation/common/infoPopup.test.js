// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { infoPopup } from './infoPopup.js';

describe('infoPopup', () => {
    describe('basic structure', () => {
        it('returns an object with the correct structure', () => {
            const result = infoPopup('Shadowy Dodge', 'A stealthy evasion', { action: { name: 'Test' } });
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Shadowy Dodge',
                    description: 'A stealthy evasion',
                    automation: { action: { name: 'Test' } },
                },
            });
        });

        it('returns a new object each call', () => {
            const result1 = infoPopup('Action', 'desc', {});
            const result2 = infoPopup('Action', 'desc', {});
            expect(result1).not.toBe(result2);
            expect(result1.payload).not.toBe(result2.payload);
        });
    });

    describe('extraProps merging', () => {
        it('does not merge when extraProps is null or undefined', () => {
            const result1 = infoPopup('Action', 'desc', {}, undefined);
            const result2 = infoPopup('Action', 'desc', {}, null);
            expect(Object.keys(result1)).toEqual(['type', 'payload']);
            expect(Object.keys(result2)).toEqual(['type', 'payload']);
        });

        it('merges extraProps onto the top-level result object', () => {
            const result = infoPopup('Action', 'desc', {}, { defenderHp: 10, defenderName: 'Goblin' });
            expect(result.defenderHp).toBe(10);
            expect(result.defenderName).toBe('Goblin');
        });

        it('does not overwrite payload fields when extraProps contains matching keys', () => {
            const automation = { real: true };
            const result = infoPopup('Real Name', 'Real Desc', automation, {
                name: 'Fake',
                description: 'Fake',
                automation: { fake: true },
            });
            expect(result.payload.name).toBe('Real Name');
            expect(result.payload.description).toBe('Real Desc');
            expect(result.payload.automation).toBe(automation);
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
    });
});
