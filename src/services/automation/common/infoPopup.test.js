// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { infoPopup } from './infoPopup.js';

describe('infoPopup', () => {
    it('returns a popup object with correct structure and merges extraProps', () => {
        const result = infoPopup('Shadowy Dodge', 'A stealthy evasion', { action: { name: 'Test' } }, { defenderHp: 10 });
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shadowy Dodge',
                description: 'A stealthy evasion',
                automation: { action: { name: 'Test' } },
            },
            defenderHp: 10,
        });
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
