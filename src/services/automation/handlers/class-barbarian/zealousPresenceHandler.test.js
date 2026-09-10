// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ id: 1, timestamp: Date.now() }),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle, confirmZealousPresence } from './zealousPresenceHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'TestBarbarian';

function makeAction(overrides = {}) {
    return {
        name: 'Zealous Presence',
        automation: {
            type: 'passive_rule',
            effect: 'zealous_presence',
            targets: 10,
            duration: 'until_start_of_next_turn',
            ...overrides,
        },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        automation: { passives: [], actions: [] },
        ...overrides,
    };
}

// ── handle() Tests ─────────────────────────────────────────────────

describe('zealousPresenceHandler.handle', () => {
    let action;
    let playerStats;
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();

        action = makeAction();
        playerStats = makePlayerStats();

        // Default: not active, no uses set, no rage set
        useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'zealousPresenceActive') return null;
            return undefined;
        });

        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Enemy1' },
                { name: 'Enemy2' },
                { name: 'Ally1' },
            ],
        });

        consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('already active', () => {
        it('returns info popup when zealousPresenceActive is already true', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return true;
                return undefined;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Zealous Presence is already active.');
            expect(result.payload.name).toBe('Zealous Presence');
            expect(result.payload.automation).toEqual(action.automation);
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(getCombatContext).not.toHaveBeenCalled();
        });
    });

    describe('uses / resource management', () => {
        it('returns modal and decrements uses when uses are available (uses=1, current=1)', async () => {
            action.automation.uses = 1;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'zealouspresenceUses') return 1;
                return undefined;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'zealouspresenceUses',
                0,
                campaignName,
            );
        });

        it('returns popup when uses are exhausted and no recharge', async () => {
            action.automation.uses = 1;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'zealouspresenceUses') return 0;
                return undefined;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('has been used');
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'zealouspresenceUses',
                expect.any(Number),
                campaignName,
            );
        });

        it('uses usesMax when uses is not set', async () => {
            action.automation.usesMax = 2;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                return undefined;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'zealouspresenceUses',
                1,
                campaignName,
            );
        });

        it('uses custom resourceKey from automation when provided', async () => {
            action.automation.resourceKey = 'customUsesKey';
            action.automation.uses = 1;

            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'customUsesKey') return 1;
                return undefined;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'customUsesKey',
                0,
                campaignName,
            );
        });

        it('expend rage when recharge is long_rest_or_expend_rage and rage > 0', async () => {
            action.automation.uses = 1;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'zealouspresenceUses') return 0;
                if (key === 'ragePoints') return 3;
                return undefined;
            });
            action.automation.recharge = 'long_rest_or_expend_rage';

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'ragePoints',
                2,
                campaignName,
            );
        });

        it('returns popup when rage is 0 and recharge requires rage', async () => {
            action.automation.uses = 1;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'zealouspresenceUses') return 0;
                if (key === 'ragePoints') return 0;
                return undefined;
            });
            action.automation.recharge = 'long_rest_or_expend_rage';

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('cannot be used again');
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'ragePoints',
                expect.any(Number),
                campaignName,
            );
        });

        it('uses playerStats._trackedResources.ragePoints as fallback when runtime rage is null', async () => {
            const stats = makePlayerStats({
                _trackedResources: { ragePoints: { current: 2 } },
            });
            action.automation.uses = 1;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'zealouspresenceUses') return 0;
                if (key === 'ragePoints') return null;
                return undefined;
            });
            action.automation.recharge = 'long_rest_or_expend_rage';

            const result = await handle(action, stats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'ragePoints',
                1,
                campaignName,
            );
        });

        it('returns popup when recharge is not long_rest_or_expend_rage and uses exhausted', async () => {
            action.automation.uses = 1;
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                if (key === 'zealouspresenceUses') return 0;
                return undefined;
            });
            action.automation.recharge = 'on_long_rest';

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('cannot be used again');
        });

        it('returns modal when uses is null/undefined but maxUses=0 (no resource tracking)', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'zealousPresenceActive') return null;
                return undefined;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('creature target gathering', () => {
        it('returns modal with creatureTargets excluding self', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestBarbarian' },
                    { name: 'Enemy1' },
                    { name: 'Ally1' },
                ],
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('zealousPresenceTarget');
            expect(result.payload.creatureTargets).toEqual([
                { name: 'Enemy1' },
                { name: 'Ally1' },
            ]);
        });

        it('passes maxTargets from automation config', async () => {
            action.automation.targets = 5;

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.payload.maxTargets).toBe(5);
        });

        it('CLA-394: range-gates chooser targets via isWithinRange at 60 ft (gridless lenient pass)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestBarbarian' },
                    { name: 'AllyNear' },
                    { name: 'AllyFar' },
                ],
            });
            isWithinRange.mockImplementation(async (_src, target, _ft) => {
                if (target === 'AllyFar') return false;
                return true;
            });

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.creatureTargets).toEqual([{ name: 'AllyNear' }]);
            expect(isWithinRange).toHaveBeenCalledWith(playerName, 'AllyNear', 60);
            expect(isWithinRange).toHaveBeenCalledWith(playerName, 'AllyFar', 60);
            expect(isWithinRange).not.toHaveBeenCalledWith(playerName, 'TestBarbarian', expect.anything());
        });

        it('CLA-394: consults the gate for every non-self creature when gridless (all pass lenient)', async () => {
            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.creatureTargets).toEqual([
                { name: 'Enemy1' },
                { name: 'Enemy2' },
                { name: 'Ally1' },
            ]);
            expect(isWithinRange).toHaveBeenCalledTimes(3);
        });

        it('passes action and playerStats into payload', async () => {
            const result = await handle(action, playerStats, campaignName, null);

            expect(result.payload.action).toEqual(action);
            expect(result.payload.playerStats).toEqual(playerStats);
            expect(result.payload.campaignName).toBe(campaignName);
        });
    });
});

// ── confirmZealousPresence() Tests ─────────────────────────────────

describe('zealousPresenceHandler.confirmZealousPresence', () => {
    let action;
    let playerStats;
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();

        action = makeAction();
        playerStats = makePlayerStats();

        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
        toggleBuff.mockReturnValue({ isActive: true });
        addExpiration.mockReturnValue(undefined);
        addEntry.mockResolvedValue({ id: 1 });

        consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('activation', () => {
        it('sets zealousPresenceActive to true', async () => {
            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1']);

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'zealousPresenceActive',
                true,
                campaignName,
            );
        });

        it('applies buff to each selected target', async () => {
            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1', 'Enemy2']);

            expect(toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Zealous Presence',
                {
                    effect: 'advantage_attacks_and_saves',
                    duration: 'until_start_of_next_turn',
                },
                campaignName,
                'Enemy1',
            );
            expect(toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Zealous Presence',
                {
                    effect: 'advantage_attacks_and_saves',
                    duration: 'until_start_of_next_turn',
                },
                campaignName,
                'Enemy2',
            );
        });

        it('registers expiration for each target', async () => {
            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1', 'Enemy2']);

            const expCalls = addExpiration.mock.calls;
            expect(expCalls).toHaveLength(2);

            for (const call of expCalls) {
                expect(call[0]).toBe(playerName);
                expect(call[1]).toMatch(/^Enemy\d$/);
                expect(call[2]).toEqual([
                    { type: 'remove_active_buff', buffName: 'Zealous Presence' },
                    { type: 'clear_runtime_value', creatureName: playerName, key: 'zealousPresenceActive' },
                ]);
                expect(call[3]).toBe(campaignName);
                expect(call[4]).toBeUndefined();
                expect(call[5]).toBe(playerName);
            }
        });

        it('logs an ability_use entry', async () => {
            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1', 'Ally1']);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Zealous Presence',
                description: expect.stringContaining('Enemy1, Ally1'),
            }));
        });

        it('returns popup with confirmation details', async () => {
            const result = await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1', 'Enemy2']);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Zealous Presence');
            expect(result.payload.automationType).toBe('passive_rule');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('2 target(s)');
            expect(result.payload.description).toContain('Enemy1, Enemy2');
            expect(result.payload.automation).toEqual(action.automation);
        });

        it('respects max targets from automation config', async () => {
            action.automation.targets = 2;

            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1', 'Enemy2', 'Enemy3']);

            expect(toggleBuff).toHaveBeenCalledTimes(2);
            expect(toggleBuff).toHaveBeenCalledWith(playerName, 'Zealous Presence', expect.any(Object), campaignName, 'Enemy1');
            expect(toggleBuff).toHaveBeenCalledWith(playerName, 'Zealous Presence', expect.any(Object), campaignName, 'Enemy2');
            expect(toggleBuff).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 'Enemy3');
        });

        it('caps targets at maxTargets=1 when specified', async () => {
            action.automation.targets = 1;

            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1', 'Enemy2']);

            expect(toggleBuff).toHaveBeenCalledTimes(1);
            expect(toggleBuff).toHaveBeenCalledWith(playerName, 'Zealous Presence', expect.any(Object), campaignName, 'Enemy1');
        });

        it('handles empty or undefined targetNames', async () => {
            const resultEmpty = await confirmZealousPresence(action, playerStats, campaignName, []);
            const resultUndefined = await confirmZealousPresence(action, playerStats, campaignName, undefined);

            for (const result of [resultEmpty, resultUndefined]) {
                expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'zealousPresenceActive',
                    true,
                    campaignName,
                );
                expect(toggleBuff).not.toHaveBeenCalled();
                expect(addExpiration).not.toHaveBeenCalled();
                expect(result.payload.description).toContain('0 target(s)');
                expect(result.payload.description).toContain('none');
            }
        });

        it('uses custom duration from automation when provided', async () => {
            action.automation.duration = 'one_round';

            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1']);

            expect(toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Zealous Presence',
                {
                    effect: 'advantage_attacks_and_saves',
                    duration: 'one_round',
                },
                campaignName,
                'Enemy1',
            );
        });

        it('falls back to default duration when not in automation', async () => {
            delete action.automation.duration;

            await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1']);

            expect(toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Zealous Presence',
                {
                    effect: 'advantage_attacks_and_saves',
                    duration: 'until_start_of_next_turn',
                },
                campaignName,
                'Enemy1',
            );
        });

        it('handles addEntry promise rejection gracefully', async () => {
            addEntry.mockRejectedValue(new Error('Log service unavailable'));

            const result = await confirmZealousPresence(action, playerStats, campaignName, ['Enemy1']);

            expect(result.type).toBe('popup');
            expect(consoleSpy).toHaveBeenCalledWith('[zealousPresence] Error:', expect.any(Error));
        });
    });
});
