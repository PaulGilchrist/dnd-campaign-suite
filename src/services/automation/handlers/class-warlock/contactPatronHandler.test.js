// @maintained-by-ai
// Producer-lane unit tests for contactPatronHandler (Contact Patron free-cast latch):
// depleted-path no-write guard, decrement pinned to the exact runtime key
// (_<FeatureName>_freeCastCount, spaces → underscores), usesMax/null fallback,
// Number() coercion of stored counts, and popup copy pinned as full-string own-composition.
// Pure functions over a keyed mock runtime — deterministic, no DOM, no timers, turn-based only.
// The contact_patron_auto_save passive is covered in useLoggedDiceRollDamage.auto-save.test.js;
// automation-object construction is owned by automationInfoBuilder/spell.test.js and the type
// list by automationCollector.types.test.js. This handler never touches pactMagicUtils.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './contactPatronHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const campaignName = 'campaign';
const PLAYER = 'TestWarlock';
const KEY = '_Contact_Patron_freeCastCount';

const DEPLETED_DESCRIPTION = 'No free casts remaining. Finish a Long Rest to regain them.';

function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Contact Patron',
        automation: { type: 'contact_patron', ...automationOverrides },
        ...rest,
    };
}

// Keyed router: only the exact (player, key, campaign) triple resolves — a
// mis-derived read key yields null, so every stored count is provably consumed
// from the pinned latch key.
function mockStoredCount(value, key = KEY) {
    runtimeState.getRuntimeValue.mockImplementation(
        (name, k, campaign) => (name === PLAYER && k === key && campaign === campaignName ? value : null)
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
});

describe('contactPatronHandler', () => {
    describe('depleted latch', () => {
        it('returns info popup and never writes when stored count is 0', async () => {
            mockStoredCount(0);

            const action = makeAction();
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, campaignName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Contact Patron',
                    description: DEPLETED_DESCRIPTION,
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup and never writes when stored count is negative', async () => {
            mockStoredCount(-3);

            const action = makeAction();
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Contact Patron',
                    description: DEPLETED_DESCRIPTION,
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('successful activation', () => {
        it('decrements stored count 1 to 0 and returns full success popup', async () => {
            mockStoredCount(1);

            const action = makeAction();
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, campaignName);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Contact Patron',
                    description: "Contact Patron: Contact Other Plane is prepared and ready to cast without expending a spell slot. You automatically succeed on the spell's saving throw. (0 remaining).",
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, 0, campaignName);
        });

        it('decrements a partially consumed stored count', async () => {
            mockStoredCount(5);

            const action = makeAction({ automation: { uses: 5 } });
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Contact Patron',
                    description: "Contact Patron: Contact Other Plane is prepared and ready to cast without expending a spell slot. You automatically succeed on the spell's saving throw. (4 remaining).",
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, 4, campaignName);
        });

        it('coerces a stringified stored count to a number before decrementing', async () => {
            mockStoredCount('2');

            const result = await handle(makeAction(), { name: PLAYER }, campaignName);

            expect(result.payload.description).toContain('(1 remaining)');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, 1, campaignName);
        });

        it('falls back to automation.uses when no stored count exists', async () => {
            mockStoredCount(null);

            const action = makeAction({ automation: { uses: 3 } });
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(result.payload.description).toContain('(2 remaining)');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, 2, campaignName);
        });

        it('defaults uses to 1 when automation.uses is missing', async () => {
            mockStoredCount(null);

            const action = makeAction();
            expect(action.automation.uses).toBeUndefined();
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(result.payload.description).toContain('(0 remaining)');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, 0, campaignName);
        });

        it('uses a custom action name in the popup and derives the runtime key from it', async () => {
            mockStoredCount(1, '_My_Patron_Contact_freeCastCount');

            const action = makeAction({ name: 'My Patron Contact' });
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'My Patron Contact',
                    description: "My Patron Contact: Contact Other Plane is prepared and ready to cast without expending a spell slot. You automatically succeed on the spell's saving throw. (0 remaining).",
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, '_My_Patron_Contact_freeCastCount', 0, campaignName);
        });

        it('falls back to the default feature name when action.name is missing', async () => {
            mockStoredCount(1);

            const action = { automation: { type: 'contact_patron' } };
            const result = await handle(action, { name: PLAYER }, campaignName);

            expect(result.payload.name).toBe('Contact Patron');
            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(PLAYER, KEY, 0, campaignName);
        });
    });
});
