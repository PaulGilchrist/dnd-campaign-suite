// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { infoPopup } from './infoPopup.js';

describe('infoPopup', () => {
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
