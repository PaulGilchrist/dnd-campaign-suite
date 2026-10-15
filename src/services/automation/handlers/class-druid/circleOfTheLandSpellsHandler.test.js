// @maintained-by-ai: 2026-10-15
// Pure modal-opener contract: handle() returns exactly
// { type: 'modal', modalName: 'circleOfTheLandSpells',
//   payload: { name, description } } and ignores playerStats/campaignName.
// Deterministic — no AI churn needed when the app changes.

import { describe, it, expect } from 'vitest';

import { handle } from './circleOfTheLandSpellsHandler.js';

const campaignName = 'test-campaign';

describe('circleOfTheLandSpellsHandler', () => {
    describe('handle', () => {
        // Exact-key pin: full result shape in one shot.
        it('returns the circleOfTheLandSpells modal action with a name/description-only payload', async () => {
            const action = {
                name: 'Circle of the Land Spells',
                description: "Prepare spells from your circle's spell list.",
                automation: { type: 'circle_of_the_land_spells' },
                casting_time: '1 hour',
                extra_field: 'should_not_appear',
            };
            const result = await handle(action, {}, campaignName);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'circleOfTheLandSpells',
                payload: {
                    name: 'Circle of the Land Spells',
                    description: "Prepare spells from your circle's spell list.",
                },
            });
        });

        // Strict table for the `description || ''` fallback branch.
        it.each([
            ['undefined', undefined, ''],
            ['null', null, ''],
            ['empty string', '', ''],
            [
                'markdown/special characters pass through untouched',
                'Prepare <em>spells</em> from your circle\'s spell list. [level 1-4]',
                'Prepare <em>spells</em> from your circle\'s spell list. [level 1-4]',
            ],
        ])('coerces description %s to %s', async (_label, description, expected) => {
            const result = await handle({ name: 'Circle of the Land Spells', description }, {}, campaignName);

            expect(result.payload).toEqual({
                name: 'Circle of the Land Spells',
                description: expected,
            });
        });

        // playerStats and campaignName are ignored by the handler.
        it.each([
            ['empty playerStats, undefined campaignName', {}, undefined],
            ['null playerStats, empty campaignName', null, ''],
        ])('works with %s', async (_label, playerStats, campaign) => {
            const result = await handle({ name: 'Circle of the Land Spells' }, playerStats, campaign);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'circleOfTheLandSpells',
                payload: { name: 'Circle of the Land Spells', description: '' },
            });
        });
    });
});

