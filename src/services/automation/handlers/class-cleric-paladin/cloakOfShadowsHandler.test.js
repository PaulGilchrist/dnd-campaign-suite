// @maintained-by-ai: 2026-10-15
// Unit lane for the Cloak of Shadows handler (monk Way of Shadow, 3-focus toggle).
// Pins the toggle semantics: activation deducts 3 focus (runtime focusPoints takes
// precedence over class_levels.focus_points, with getClassFeatures().maxFocusPoints
// then 0 as fallbacks), stamps the cloak_of_shadows buff (exact key incl. duration
// passthrough vs '1_minute' default), and this handler's OWN invisibility stamps —
// invisible condition and the campaign '_activeInvisibility_<player>' tracking key —
// plus addExpiration shape and campaign-log entries. Deactivation removes the buff by
// action name, strips invisible without touching other conditions, clears the tracking
// key, and logs. This handler does NOT delegate to invisibilityShared; the shared
// invisibility lanes live in buffs/invisibilityHandler suites (canonical there).
// Consumers (stale-effect expiry, CharSummary badge rendering, automationCollector
// typing, automationInfoBuilder temp handlers) are covered in their own suites.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './cloakOfShadowsHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { getClassFeatures } = await import('../../../character/classFeatures.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'TestCampaign';
const playerName = 'TestMonk';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 17,
        class: {
            class_levels: [{ level: 17, focus_points: 4 }],
            ...overrides.class,
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Cloak of Shadows',
        automation: {
            type: 'cloak_of_shadows',
            duration: '1_minute',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// getRuntimeValue router: resolves the player's stored keys (activeBuffs /
// activeConditions / focusPoints) from the given values; anything else is null.
function mockRuntime(playerValues = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === playerName) return playerValues[key] ?? null;
        return null;
    });
}

describe('cloakOfShadowsHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deactivation (toggle off)', () => {
        const active = {
            activeBuffs: [{ name: 'Cloak of Shadows', effect: 'cloak_of_shadows' }],
        };

        it('removes the buff and returns info popup when feature is active', async () => {
            mockRuntime({
                activeBuffs: [...active.activeBuffs, { name: 'Other Buff' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Cloak of Shadows ended');
            expect(result.payload.name).toBe('Cloak of Shadows');
            expect(result.payload.automationType).toBe('cloak_of_shadows');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [{ name: 'Other Buff' }],
                campaignName,
            );
        });

        it('removes invisible condition on deactivation', async () => {
            mockRuntime({
                ...active,
                activeConditions: ['invisible', 'frightened'],
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeConditions',
                ['frightened'],
                campaignName,
            );
        });

        it('does not modify conditions if invisible is not present', async () => {
            mockRuntime({ ...active, activeConditions: ['frightened'] });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'activeConditions',
                expect.anything(),
                campaignName,
            );
        });

        it('clears invisibility tracking key on deactivation', async () => {
            mockRuntime(active);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeInvisibility_${playerName}`,
                null,
                campaignName,
            );
        });

        it('logs deactivation to campaign log', async () => {
            mockRuntime(active);

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Cloak of Shadows',
                description: 'TestMonk ended Cloak of Shadows.',
            });
        });
    });

    describe('focus point validation', () => {
        it('returns error when focus points are below 3', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 2 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Not enough Focus Points. Need 3, have 2.',
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('focus point fallback', () => {
        const noFocus = { activeBuffs: [], focusPoints: null };

        it('uses getClassFeatures maxFocusPoints when class_levels is missing', async () => {
            mockRuntime(noFocus);
            getClassFeatures.mockReturnValue({ maxFocusPoints: 3 });

            const stats = makePlayerStats({ class: null });
            const result = await handle(makeAction(), stats, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(getClassFeatures).toHaveBeenCalledWith(stats);
            // maxFocus 3 (fallback) minus 3 cost — proves the fallback funded the cast
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'focusPoints',
                0,
                campaignName,
            );
        });

        it('defaults to 0 focus when no class data or fallback available', async () => {
            mockRuntime(noFocus);
            getClassFeatures.mockReturnValue({});

            const result = await handle(
                makeAction(),
                makePlayerStats({ class: null }),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Not enough Focus Points. Need 3, have 0.',
            );
        });
    });

    describe('activation', () => {
        it('spends 3 focus points and adds buff to empty buffs', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            // runtime focusPoints (5→2) wins over class_levels focus_points (4→1)
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'focusPoints',
                2,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Cloak of Shadows',
                        effect: 'cloak_of_shadows',
                        duration: '1_minute',
                        hasAutomation: true,
                    }),
                ]),
                campaignName,
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Cloak of Shadows activated. You gain Invisibility, can move through occupied spaces, and Flurry of Blows costs no Focus Points.',
            );
        });

        it('appends buff to existing buffs', async () => {
            mockRuntime({ activeBuffs: [{ name: 'Existing Buff' }], focusPoints: 5 });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Existing Buff' }),
                    expect.objectContaining({ name: 'Cloak of Shadows' }),
                ]),
                campaignName,
            );
        });

        it('treats non-array activeBuffs as empty array', async () => {
            mockRuntime({ activeBuffs: 'not-an-array', focusPoints: 5 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Cloak of Shadows' }),
                ]),
                campaignName,
            );
        });

        it('uses custom duration from automation config', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5 });

            await handle(
                makeAction({ automation: { duration: 'until_end_of_turn' } }),
                makePlayerStats(),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'until_end_of_turn' }),
                ]),
                campaignName,
            );
        });

        it('uses default duration when automation has no duration', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5 });

            await handle(
                makeAction({ automation: {} }),
                makePlayerStats(),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_minute' }),
                ]),
                campaignName,
            );
        });

        it('sets invisible condition on activation', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5, activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeConditions',
                ['invisible'],
                campaignName,
            );
        });

        it('does not duplicate invisible if already present', async () => {
            mockRuntime({
                activeBuffs: [],
                focusPoints: 5,
                activeConditions: ['invisible', 'frightened'],
            });

            await handle(makeAction(), makePlayerStats(), campaignName);

            const activeCondCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions'
            );
            expect(activeCondCalls).toHaveLength(0);
        });

        it('sets invisibility tracking key on activation', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5, activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeInvisibility_${playerName}`,
                playerName,
                campaignName,
            );
        });

        it('registers initiative expiration via addExpiration', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5, activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: playerName, effects: [{ type: 'condition', condition: 'invisible' }], campaignName, rounds: undefined, expireOnCreatureName: playerName });
        });

        it('logs activation to campaign log', async () => {
            mockRuntime({ activeBuffs: [], focusPoints: 5, activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Cloak of Shadows',
                description: 'TestMonk activated Cloak of Shadows. You gain Invisibility, can move through occupied spaces, and Flurry of Blows costs no Focus Points.',
            });
        });
    });
});
