// @maintained-by-ai
// Contract: every base action listed in public/data/actions.json resolves to a
// non-empty hover tooltip, and Dodge is ruleset-aware (2024 drops the Dex-save
// advantage clause — mirrors handleDodgeAction's dexSaveClause branch).
import { describe, it, expect } from 'vitest';
import actionsJson from '../../../public/data/actions.json';
import { BASE_ACTION_DESCRIPTIONS, getBaseActionTooltip } from './baseActionDescriptions.js';

describe('baseActionDescriptions', () => {
    it.each(actionsJson)('provides a tooltip for every actions.json entry: %s', (name) => {
        const tooltip = getBaseActionTooltip(name, '5e');
        expect(tooltip).toBeTruthy();
        expect(typeof tooltip).toBe('string');
    });

    it('returns undefined for unknown action names', () => {
        expect(getBaseActionTooltip('Not An Action', '5e')).toBeUndefined();
    });

    it('grants 2014 Dodge the Dexterity saving throw clause', () => {
        expect(getBaseActionTooltip('Dodge', '5e')).toContain('Dexterity saving throws');
    });

    it('omits the Dexterity saving throw clause from 2024 Dodge', () => {
        const tooltip = getBaseActionTooltip('Dodge', '2024');
        expect(tooltip).toBeTruthy();
        expect(tooltip).not.toContain('Dexterity saving throws');
    });

    it('keeps the clickable-lane actions hinting at their click behaviour', () => {
        expect(getBaseActionTooltip('Hide', '5e')).toContain('Click to roll');
        expect(getBaseActionTooltip('Grapple', '5e')).toContain('Click to roll');
    });

    it('has no orphan entries beyond the Dodge2024 ruleset variant', () => {
        const orphans = Object.keys(BASE_ACTION_DESCRIPTIONS).filter(
            key => !actionsJson.includes(key) && key !== 'Dodge2024'
        );
        expect(orphans).toEqual([]);
    });
});
