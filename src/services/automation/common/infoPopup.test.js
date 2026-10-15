// @maintained-by-ai
// Pure, deterministic contract test for the infoPopup() helper:
// builds an automation_info popup and Object.assign()s extraProps onto the
// TOP-LEVEL result (never into payload; automation is passed by reference).
// Stable contract — no churn expected as the app evolves.
import { describe, it, expect } from 'vitest';
import { infoPopup } from './infoPopup.js';

describe('infoPopup', () => {
    it('builds an automation_info popup and assigns extraProps at the top level, never into payload', () => {
        const automation = { action: { name: 'Test' } };
        const result = infoPopup('Shadowy Dodge', 'A stealthy evasion', automation, {
            defenderHp: 10,
            // extraProps with conflicting names land top-level and must not clobber payload
            name: 'Fake',
            description: 'Fake',
            automation: { fake: true },
        });
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Shadowy Dodge',
                description: 'A stealthy evasion',
                automation,
            },
            defenderHp: 10,
            name: 'Fake',
            description: 'Fake',
            automation: { fake: true },
        });
        expect(result.payload.automation).toBe(automation);
    });

    it('omits extra keys when extraProps is not provided', () => {
        const result = infoPopup('Name', 'Desc', { x: 1 });
        expect(Object.keys(result)).toEqual(['type', 'payload']);
    });
});
