import { describe, it, expect } from 'vitest';

import { handle } from './circleOfTheLandSpellsHandler.js';

const campaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Circle of the Land Spells',
        description: 'Prepare spells from your circle\'s spell list.',
        ...overrides,
    };
}

describe('circleOfTheLandSpellsHandler', () => {
    describe('handle', () => {
        it('returns a modal action with the correct modal name', async () => {
            const result = await handle(makeAction(), {}, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('passes the action name to the modal payload', async () => {
            const result = await handle(makeAction(), {}, campaignName);

            expect(result.payload.name).toBe('Circle of the Land Spells');
        });

        it('passes the action description to the modal payload', async () => {
            const result = await handle(makeAction(), {}, campaignName);

            expect(result.payload.description).toBe(
                'Prepare spells from your circle\'s spell list.',
            );
        });

        it('uses empty string when description is missing', async () => {
            const action = makeAction({ description: undefined });
            const result = await handle(action, {}, campaignName);

            expect(result.payload.description).toBe('');
        });

        it('uses empty string when description is null', async () => {
            const action = makeAction({ description: null });
            const result = await handle(action, {}, campaignName);

            expect(result.payload.description).toBe('');
        });

        it('passes an empty string when description key is absent', async () => {
            const action = { name: 'Circle of the Land Spells' };
            const result = await handle(action, {}, campaignName);

            expect(result.payload.description).toBe('');
        });

        it('passes all action data through the payload for the modal', async () => {
            const action = makeAction({
                name: 'My Custom Spell Selection',
                description: 'Select your prepared spells.',
            });
            const result = await handle(action, {}, campaignName);

            expect(result.payload).toEqual({
                name: 'My Custom Spell Selection',
                description: 'Select your prepared spells.',
            });
        });

        it('works with an empty playerStats object', async () => {
            const result = await handle(makeAction(), {}, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('works with null playerStats', async () => {
            const result = await handle(makeAction(), null, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('works with undefined campaignName', async () => {
            const result = await handle(makeAction(), {}, undefined);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('returns the same structure regardless of action.automation content', async () => {
            const action = makeAction({
                automation: {
                    type: 'circle_of_the_land_spells',
                    casting_time: '1 hour',
                },
            });
            const result = await handle(action, {}, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('passes empty string when description is explicitly set to empty string', async () => {
            const action = makeAction({ description: '' });
            const result = await handle(action, {}, campaignName);

            expect(result.payload.description).toBe('');
        });

        it('passes special characters in name through to payload', async () => {
            const action = makeAction({
                name: "Circle of the Land Spells (Druid)",
                description: 'Prepare <em>spells</em> from your circle\'s spell list. [level 1-4]',
            });
            const result = await handle(action, {}, campaignName);

            expect(result.payload.name).toBe("Circle of the Land Spells (Druid)");
            expect(result.payload.description).toBe(
                'Prepare <em>spells</em> from your circle\'s spell list. [level 1-4]',
            );
        });

        it('ignores extra action fields not included in payload', async () => {
            const action = makeAction({
                automation: { type: 'circle_of_the_land_spells' },
                target: 'self',
                range: 'Self',
                casting_time: '1 hour',
                extra_field: 'should_not_appear',
            });
            const result = await handle(action, {}, campaignName);

            expect(result.payload).toEqual({
                name: 'Circle of the Land Spells',
                description: 'Prepare spells from your circle\'s spell list.',
            });
        });

        it('works with undefined playerStats', async () => {
            const result = await handle(makeAction(), undefined, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('works with empty string campaignName', async () => {
            const result = await handle(makeAction(), {}, '');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
        });

        it('works with action that only has a name field', async () => {
            const action = { name: 'Circle of the Land Spells' };
            const result = await handle(action, {}, campaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('circleOfTheLandSpells');
            expect(result.payload.name).toBe('Circle of the Land Spells');
            expect(result.payload.description).toBe('');
        });

        it('returns a plain object with type, modalName, and payload properties', async () => {
            const result = await handle(makeAction(), {}, campaignName);

            expect(Object.keys(result).sort()).toEqual(['modalName', 'payload', 'type']);
            expect(typeof result.type).toBe('string');
            expect(typeof result.modalName).toBe('string');
            expect(typeof result.payload).toBe('object');
        });

        it('returns payload with only name and description keys', async () => {
            const result = await handle(makeAction(), {}, campaignName);

            expect(Object.keys(result.payload).sort()).toEqual(['description', 'name']);
        });
    });
});
