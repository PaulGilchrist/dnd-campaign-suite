// @improved-by-ai
import { describe, it, expect } from 'vitest';

import { buildMasteryDescription } from './weaponMasteryHandler.js';

// ── Tests ────────────────────────────────────────────────────────

describe('buildMasteryDescription', () => {
    it('should return correct description for Push', () => {
        const result = buildMasteryDescription('Push', 'Goblin');
        expect(result).toBe('Push applied to Goblin — pushed up to 10 ft away.');
    });

    it('should return correct description for Topple', () => {
        const result = buildMasteryDescription('Topple', 'Ogre');
        expect(result).toBe('Topple: ready to force a CON save vs Prone.');
    });

    it('should return correct description for Sap', () => {
        const result = buildMasteryDescription('Sap', 'Hobgoblin');
        expect(result).toBe('Sap applied to Hobgoblin — Disadvantage on next attack roll.');
    });

    it('should return correct description for Slow', () => {
        const result = buildMasteryDescription('Slow', 'Bugbear');
        expect(result).toBe('Slow applied to Bugbear — Speed reduced by 10 ft.');
    });

    it('should return correct description for Vex', () => {
        const result = buildMasteryDescription('Vex', 'Goblin');
        expect(result).toBe('Vex applied to Goblin — you have Advantage on next attack.');
    });

    it('should return correct description for Cleave', () => {
        const result = buildMasteryDescription('Cleave', 'Ogre');
        expect(result).toBe('Cleave — make an extra attack against a second creature within 5 ft.');
    });

    it('should return correct description for Graze', () => {
        const result = buildMasteryDescription('Graze', 'Hobgoblin');
        expect(result).toBe('Graze — deal damage equal to ability modifier on a miss.');
    });

    it('should return correct description for Nick', () => {
        const result = buildMasteryDescription('Nick', 'Goblin');
        expect(result).toBe('Nick — make Light weapon extra attack as part of Attack action.');
    });

    it('should use lowercase "target" when targetName is null', () => {
        const result = buildMasteryDescription('Push', null);
        expect(result).toBe('Push applied to target — pushed up to 10 ft away.');
    });

    it('should use lowercase "target" when targetName is undefined', () => {
        const result = buildMasteryDescription('Sap', undefined);
        expect(result).toBe('Sap applied to target — Disadvantage on next attack roll.');
    });

    it('should use lowercase "target" for unknown mastery names (default case)', () => {
        const result = buildMasteryDescription('UnknownEffect', 'Goblin');
        expect(result).toBe('UnknownEffect applied to Goblin.');
    });

    it('should use lowercase "target" for unknown mastery when targetName is null', () => {
        const result = buildMasteryDescription('UnknownEffect', null);
        expect(result).toBe('UnknownEffect applied to target.');
    });

    it('should use "target" as fallback when targetName is empty string', () => {
        const result = buildMasteryDescription('Push', '');
        expect(result).toBe('Push applied to target — pushed up to 10 ft away.');
    });

    it('should handle all known mastery names', () => {
        const knownMasteries = ['Push', 'Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Graze', 'Nick'];
        for (const mastery of knownMasteries) {
            const result = buildMasteryDescription(mastery, 'Target');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        }
    });

    it('should include mastery name in every description', () => {
        const masteries = ['Push', 'Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Graze', 'Nick', 'Fake'];
        for (const mastery of masteries) {
            const result = buildMasteryDescription(mastery, 'Target');
            expect(result).toContain(mastery);
        }
    });

    it('should include target in descriptions for known masteries that use the target', () => {
        const targetMasteries = ['Push', 'Sap', 'Slow', 'Vex'];
        for (const mastery of targetMasteries) {
            const result = buildMasteryDescription(mastery, 'Dragon');
            expect(result).toContain('Dragon');
        }
    });

    it('should NOT include target in Topple description (it uses different format)', () => {
        const result = buildMasteryDescription('Topple', 'Goblin');
        expect(result).toBe('Topple: ready to force a CON save vs Prone.');
        expect(result).not.toContain('Goblin');
    });

    it('should NOT include target in Cleave description (it uses different format)', () => {
        const result = buildMasteryDescription('Cleave', 'Ogre');
        expect(result).toBe('Cleave — make an extra attack against a second creature within 5 ft.');
        expect(result).not.toContain('Ogre');
    });

    it('should NOT include target in Graze description (it uses different format)', () => {
        const result = buildMasteryDescription('Graze', 'Bugbear');
        expect(result).toBe('Graze — deal damage equal to ability modifier on a miss.');
        expect(result).not.toContain('Bugbear');
    });

    it('should NOT include target in Nick description (it uses different format)', () => {
        const result = buildMasteryDescription('Nick', 'Hobgoblin');
        expect(result).toBe('Nick — make Light weapon extra attack as part of Attack action.');
        expect(result).not.toContain('Hobgoblin');
    });
});
