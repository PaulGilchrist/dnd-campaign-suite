// @maintained-by-ai
// Backlog 2026-10-31 (AP) placeholder-name-accepted — SOFT prompt fix (owner
// ruling: NO validator changes). Every prompt seam that embeds a schema shape
// must carry discriminating name examples AND the explicit anti-kind-word /
// anti-placeholder prohibition, so the model never echoes "quest" as a name.
// The refine seam's copy of this assertion lives in refine.test.js.
import { describe, it, expect } from 'vitest';
import { buildBlueprintMessages, buildSingleEntityMessages, namingRule, NAME_EXAMPLES, KIND_FIELD_RULES } from './designerPrompts.js';
import { ENTITY_KINDS } from './entitySchemas.js';

const PLACEHOLDER_BAN = /NEVER[\s\S]*placeholder/i;

describe('namingRule — shared anti-placeholder fragment', () => {
    it('covers every authorable kind with a discriminating example', () => {
        for (const kind of ENTITY_KINDS) {
            expect(NAME_EXAMPLES[kind], `missing example for ${kind}`).toBeTruthy();
            expect(NAME_EXAMPLES[kind].toLowerCase()).not.toBe(kind.toLowerCase()); // the example must not BE the kind word
        }
    });

    it('kind-targeted line bans the kind word and placeholders', () => {
        const line = namingRule('quest');
        expect(line).toContain('The Sunken Chime');
        expect(line).toMatch(/NEVER "quest"/);
        expect(line).toMatch(PLACEHOLDER_BAN);
        expect(line).toMatch(/TBD|Untitled/i);
    });

    it('roster line (batch) bans every kind word and placeholders', () => {
        const line = namingRule();
        for (const kind of ENTITY_KINDS) expect(line).toContain(`"${kind}"`);
        expect(line).toMatch(PLACEHOLDER_BAN);
        for (const kind of ENTITY_KINDS) expect(line).toContain(NAME_EXAMPLES[kind]);
    });
});

describe('blueprint batch seam — guidance rides the built system message', () => {
    const messages = buildBlueprintMessages({
        storyBible: { party: [] },
        scope: { scope: 'arc', levelRange: { min: 1, max: 3 }, storySummary: 'x' },
        monsterMenu: [], existingNames: {}, history: [],
    });
    const system = messages[0].content;

    it('carries name examples AND the kind-word/placeholder prohibition next to the shapes', () => {
        expect(system).toMatch(/quest "The Sunken Chime"/); // discriminating example beside the quest shape
        expect(system).toMatch(/NEVER name an entity after its kind \("quest"/);
        expect(system).toMatch(PLACEHOLDER_BAN);
        // it sits in the SAME hard-rules block as the embedded shapes
        expect(system.indexOf('NEVER name an entity after its kind')).toBeLessThan(system.indexOf('quest{name'));
    });
});

describe('single-entity resume seam — per-kind guidance in the system message', () => {
    it('quest emit bans naming it "quest" and shows the example', () => {
        const messages = buildSingleEntityMessages({
            scope: { storySummary: 'x' }, kind: 'quest', planNotes: 'a hook',
            siblings: {}, allow: { existingNames: {}, monsters: [], party: [] },
            fieldRule: KIND_FIELD_RULES.quest,
        });
        const system = messages[0].content;
        expect(system).toContain('Shape: quest{');
        expect(system).toContain('like "The Sunken Chime"');
        expect(system).toMatch(/NEVER "quest"/);
        expect(system).toMatch(PLACEHOLDER_BAN);
    });

    it('every kind gets its targeted line (no seam left bare)', () => {
        for (const kind of ENTITY_KINDS) {
            const system = buildSingleEntityMessages({
                scope: {}, kind, siblings: {},
                allow: { existingNames: {}, monsters: [], party: [] },
                fieldRule: KIND_FIELD_RULES[kind],
            })[0].content;
            expect(system).toContain(NAME_EXAMPLES[kind]);
            expect(system).toMatch(new RegExp(`NEVER "${kind}"`));
        }
    });
});
