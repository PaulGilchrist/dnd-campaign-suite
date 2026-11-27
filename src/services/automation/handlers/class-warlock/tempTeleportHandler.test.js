// @maintained-by-ai 2026-11-26
// L5-003 §8.1: token-move seam — default OFF keeps legacy prose byte-identical.
// Swap-with-illusion (CLA-366) coverage lives in tempTeleportHandler.cla366-transposition.test.js;
// this file owns the plain/shadow/moonlight main lane, slot economy, and extended-flag contract.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle, confirmTeleport, clearExtendedFlag, isExtendedAvailable } from './tempTeleportHandler.js';

// ── Mocks (no factory-baked impls — every default is re-seeded in beforeEach) ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../combat/teleportService.js', () => ({
    applyTeleportTokenMove: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';
import { applyTeleportTokenMove } from '../../../combat/teleportService.js';

// ── Constants ──────────────────────────────────────────────────

const CAMPAIGN_NAME = 'test-campaign';
const PLAYER_NAME = 'TestHero';
const FROZEN_NOW = 1750000000000;

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    const { automation: autoOverrides, ...rest } = overrides;
    return {
        name: 'Shadow of Moil',
        description: 'Teleport ability.',
        automation: {
            type: 'teleport',
            distance: '60 ft',
            effect: 'teleport',
            ...autoOverrides,
        },
        ...rest,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: PLAYER_NAME,
        proficiency: 3,
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        automation: { passives: [] },
        ...overrides,
    };
}

function setupMoonlightStepMocks(uses) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'moonlightStepUses') return uses;
        if (key === 'targetEffects') return [];
        if (key === 'spell_slots_level_2') return 3;
        if (key === 'spell_slots_level_3') return 2;
        return null;
    });
}

/** All `campaign/targetEffects` list writes made so far, newest last. */
function targetEffectWrites() {
    return setRuntimeValue.mock.calls
        .filter(c => c[0] === 'campaign' && c[1] === 'targetEffects')
        .map(c => c[2]);
}

/** All setRuntimeValue writes to a given key, as raw [name, key, value, campaign] rows. */
function writesFor(key) {
    return setRuntimeValue.mock.calls.filter(c => c[1] === key);
}

// ── Tests ──────────────────────────────────────────────────────

describe('tempTeleportHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockResolvedValue(undefined);
        evaluateAutoExpression.mockReturnValue(3);
        buildSaveDc.mockReturnValue(13);
        createSaveListener.mockReturnValue({ promptId: 'test-id' });
        resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
        addEntry.mockResolvedValue(undefined);
        applyTeleportTokenMove.mockResolvedValue({ moved: false, reason: 'token-moving-off' });
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    afterEach(() => {
        // Drain any save-result listener still registered by the handler so a
        // mock-promptId match cannot leak into a later test (success:true skips
        // the write leg and only unsubscribes).
        window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'test-id', success: true } }));
        document.dispatchEvent(new Event('cleanup'));
        vi.restoreAllMocks();
    });

    describe('handle', () => {
        it('returns the teleport modal with the exact payload and touches nothing', async () => {
            const action = makeAction();
            const stats = makePlayerStats();

            const result = await handle(action, stats, CAMPAIGN_NAME, 'test-map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'teleport',
                payload: { action, playerStats: stats, campaignName: CAMPAIGN_NAME },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('opens the teleport modal for a null action', async () => {
            const result = await handle(null, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(result.payload.action).toBeNull();
        });

        it('refuses moonlight_step at zero uses with no slots: info popup, zero writes', async () => {
            getRuntimeValue.mockReturnValue(0);
            const result = await handle(
                makeAction({ automation: { effect: 'moonlight_step_teleport' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                'test-map'
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Shadow of Moil',
                    automationType: 'teleport',
                    description: 'Shadow of Moil has no uses remaining. Recharges on a Long Rest.',
                    automation: { type: 'teleport', distance: '60 ft', effect: 'moonlight_step_teleport' },
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it.each([
            ['both levels open at runtime', { 2: 3, 3: 2 }, 2],
            ['level 2 exhausted at runtime, level 3 live', { 2: 0, 3: 1 }, 3],
        ])('opens moonlightStepFallback at slot level %i when %s', async (_label, slots, expectedLevel) => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'moonlightStepUses') return 0;
                const match = /^spell_slots_level_(\d)$/.exec(key);
                return match ? slots[match[1]] ?? 0 : null;
            });
            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_2: 3, spell_slots_level_3: 2 },
            });
            const action = makeAction({ automation: { effect: 'moonlight_step_teleport' } });

            const result = await handle(action, stats, CAMPAIGN_NAME, 'test-map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'moonlightStepFallback',
                payload: { action, playerStats: stats, campaignName: CAMPAIGN_NAME, slotLevel: expectedLevel },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it.each([
            ['uses remaining', 1],
            ['uses never initialised (falls back to WIS-modifier max of 3)', null],
        ])('lets moonlight_step through to the plain teleport modal with %s', async (_label, uses) => {
            getRuntimeValue.mockImplementation((_name, key) => (key === 'moonlightStepUses' ? uses : null));
            const action = makeAction({ automation: { effect: 'moonlight_step_teleport' } });

            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('confirmTeleport', () => {
        it('returns the exact plain-teleport popup and writes no state or expirations', async () => {
            const action = makeAction();
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Shadow of Moil',
                    automationType: 'teleport',
                    description: 'Shadow of Moil: Teleported 60 ft to an unoccupied space you can see.',
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it.each([
            ['authored extendedDistance', { extendedDistance: '120 ft' }, true, '120 ft'],
            ['default extended range', {}, true, '150 ft'],
            ['default base range', { distance: undefined }, false, '60 ft'],
        ])('distance lane — %s (useExtended %s) resolves to %s', async (_label, auto, useExtended, feet) => {
            const result = await confirmTeleport(
                makeAction({ automation: auto }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                useExtended
            );

            expect(result.payload.description).toBe(
                `Shadow of Moil: Teleported ${feet} to an unoccupied space you can see.`
            );
            const latch = writesFor('_teleportExtendedUsed');
            if (useExtended) {
                expect(latch).toEqual([[PLAYER_NAME, '_teleportExtendedUsed', true, CAMPAIGN_NAME]]);
            } else {
                expect(latch).toEqual([]);
            }
        });

        it('grants the caster an exact next_attack_advantage te row on moonlight_step', async () => {
            setupMoonlightStepMocks(0);
            await confirmTeleport(
                makeAction({ automation: { effect: 'moonlight_step_teleport' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                false
            );

            const writes = targetEffectWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0]).toContainEqual({
                target: PLAYER_NAME,
                source: 'Shadow of Moil',
                effect: 'next_attack_advantage',
                value: null,
                duration: 'until_end_of_turn',
            });
        });

        it('CLA-230: replaces the same-source advantage te without stacking and preserves unrelated rows', async () => {
            const bless = { effect: 'blessed', target: PLAYER_NAME, source: 'Bless' };
            const stale = {
                effect: 'next_attack_advantage',
                target: PLAYER_NAME,
                source: 'Moonlight Step',
                value: 'stale',
                duration: 'until_end_of_turn',
            };
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'moonlightStepUses') return 0;
                if (key === 'targetEffects') return [bless, stale];
                return null;
            });

            await confirmTeleport(
                makeAction({ name: 'Moonlight Step', automation: { effect: 'moonlight_step_teleport' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                false
            );

            const writes = targetEffectWrites();
            expect(writes).toHaveLength(1);
            const advantage = writes[0].filter(
                te => te.effect === 'next_attack_advantage' && te.target === PLAYER_NAME
            );
            // Exactly one row, and it is the FRESH one (value: null proves the
            // stale row was replaced, not kept alongside).
            expect(advantage).toEqual([{
                target: PLAYER_NAME,
                source: 'Moonlight Step',
                effect: 'next_attack_advantage',
                value: null,
                duration: 'until_end_of_turn',
            }]);
            expect(writes[0]).toContainEqual(bless);
        });

        it('Improved Shadow Step: exact perception te row, WIS save dispatch and prose', async () => {
            setupMoonlightStepMocks(0);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Improved Shadow Step' }] },
            });
            const result = await confirmTeleport(
                makeAction({ automation: { effect: 'shadow_step_teleport' } }),
                stats,
                CAMPAIGN_NAME,
                false
            );

            expect(result.payload.description).toContain(
                'Improved Shadow Step: Goblin has perception disadvantage and must make a WIS save (DC 13) or be Blinded.'
            );
            expect(targetEffectWrites().at(-1)).toContainEqual({
                target: 'Goblin',
                source: 'Improved Shadow Step',
                effect: 'disadvantage_perception_checks',
                value: null,
                duration: 'until_start_of_next_turn',
            });
            expect(resolveTarget).toHaveBeenCalledWith(CAMPAIGN_NAME, PLAYER_NAME);
            expect(buildSaveDc).toHaveBeenCalledWith({ saveDc: 'ability', saveAbility: 'WIS' }, stats);
            expect(createSaveListener).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                { targetName: 'Goblin', saveType: 'WIS', saveDc: 13 }
            );
        });

        it('Lunar Form: Shared Moonlight grants the ally the advantage te and prose', async () => {
            setupMoonlightStepMocks(0);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const result = await confirmTeleport(
                makeAction({ automation: { effect: 'moonlight_step_teleport' } }),
                stats,
                CAMPAIGN_NAME,
                false
            );

            expect(result.payload.description).toContain(
                'Shared Moonlight: Goblin also gains Advantage on their next attack roll.'
            );
            expect(targetEffectWrites().at(-1)).toContainEqual({
                target: 'Goblin',
                source: 'Shared Moonlight',
                effect: 'next_attack_advantage',
                value: null,
                duration: 'until_end_of_turn',
            });
        });

        it('Lunar Form with no resolved ally: no Shared Moonlight prose, only the self expiration', async () => {
            setupMoonlightStepMocks(0);
            resolveTarget.mockResolvedValue({ target: null });
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const result = await confirmTeleport(
                makeAction({ automation: { effect: 'moonlight_step_teleport' } }),
                stats,
                CAMPAIGN_NAME,
                false
            );

            expect(result.payload.description).not.toContain('Shared Moonlight');
            expect(addExpiration).toHaveBeenCalledTimes(1); // caster self-row only
        });

        it.each([
            ['3 uses left', 3, 2],
            ['uses never initialised (WIS-modifier max 3)', null, 2],
            ['0 uses left', 0, null],
        ])('moonlight_step decrements uses exactly once when %s', async (_label, uses, expected) => {
            setupMoonlightStepMocks(uses);
            await confirmTeleport(
                makeAction({ automation: { effect: 'moonlight_step_teleport' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                false
            );

            const writes = writesFor('moonlightStepUses');
            if (expected === null) {
                expect(writes).toEqual([]);
            } else {
                expect(writes).toEqual([[PLAYER_NAME, 'moonlightStepUses', expected, CAMPAIGN_NAME]]);
            }
        });

        it.each([
            ['3 allies, authored range', { bringAllies: true, allyCount: 3, teleportRange: '5 ft' }, true, 'up to 3 willing creatures within 5 ft'],
            ['2 allies, default range', { bringAllies: true, allyCount: 2 }, true, 'up to 2 willing creatures within 10 ft'],
            ['allyCount zero', { bringAllies: true, allyCount: 0 }, true, null],
            ['allies configured but base (non-extended) teleport', { bringAllies: true, allyCount: 3, teleportRange: '5 ft' }, false, null],
        ])('bring-allies prose with %s', async (_label, auto, useExtended, suffix) => {
            const result = await confirmTeleport(
                makeAction({ automation: { extendedDistance: '150 ft', ...auto } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                useExtended
            );

            if (suffix) {
                expect(result.payload.description).toBe(
                    `Shadow of Moil: Teleported 150 ft to an unoccupied space you can see. Also brought ${suffix} of your destination.`
                );
            } else {
                expect(result.payload.description).not.toContain('willing creatures');
            }
        });

        it.each([
            ['level 3 with runtime 2 of max 3', 3, 2, 1],
            ['level 3 with runtime unset (falls back to max 3)', 3, null, 2],
            ['level 3 with no slots left', 3, 0, null],
            ['no consumedSlotLevel requested', undefined, 2, null],
        ])('slot economy — %s', async (_label, slotLevel, runtime, expected) => {
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'spell_slots_level_3' ? runtime : null
            );
            const stats = makePlayerStats({ spellAbilities: { spell_slots_level_3: 3 } });

            await confirmTeleport(makeAction(), stats, CAMPAIGN_NAME, false, slotLevel);

            const writes = writesFor('spell_slots_level_3');
            if (expected === null) {
                expect(writes).toEqual([]);
            } else {
                expect(writes).toEqual([[PLAYER_NAME, 'spell_slots_level_3', expected, CAMPAIGN_NAME]]);
            }
        });

        it.each([
            ['shadow_step', { effect: 'shadow_step_teleport' }, undefined,
                `${PLAYER_NAME} used Shadow of Moil to teleport 60 ft. Gains Advantage on next attack roll.`],
            ['bonus_teleport', { effect: 'bonus_teleport' }, undefined,
                `${PLAYER_NAME} used Shadow of Moil to teleport 60 ft.`],
            ['moonlight_step spending a level 3 slot', { effect: 'moonlight_step_teleport' }, 3,
                `${PLAYER_NAME} used Shadow of Moil to teleport 60 ft. Gains Advantage on next attack roll. Expend a level 3 spell slot.`],
        ])('logs one full-shape ability_use row for %s', async (_label, auto, slotLevel, description) => {
            setupMoonlightStepMocks(0);
            await confirmTeleport(
                makeAction({ automation: auto }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                false,
                slotLevel
            );

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
                type: 'ability_use',
                characterName: PLAYER_NAME,
                abilityName: 'Shadow of Moil',
                description,
                timestamp: FROZEN_NOW,
            });
        });

        it('a rejected log write surfaces console.error once without breaking the popup', async () => {
            addEntry.mockRejectedValueOnce(new Error('log down'));
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await confirmTeleport(
                makeAction({ automation: { effect: 'bonus_teleport' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                false
            );

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(errSpy).toHaveBeenCalledTimes(1);
        });
    });

    // CLA-191 regression: cloud effects must enqueue pendingExpirations so they
    // clear at the start of the caster's next turn instead of persisting forever.
    describe('CLA-191 expiration enforcement', () => {
        it.each([
            ['shadow_step', 'shadow_step_teleport'],
            ['moonlight_step', 'moonlight_step_teleport'],
        ])('enqueues the caster-advantage expiration keyed by action name on %s teleports', async (_label, effect) => {
            setupMoonlightStepMocks(2);
            await confirmTeleport(
                makeAction({ name: 'Blink', automation: { effect } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                false
            );

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: PLAYER_NAME,
                targetName: PLAYER_NAME,
                effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Blink', target: PLAYER_NAME }],
                campaignName: CAMPAIGN_NAME,
                rounds: undefined,
                expireOnCreatureName: PLAYER_NAME,
            });
        });

        it('enqueues expirations for Improved Shadow Step perception te and blinded condition', async () => {
            setupMoonlightStepMocks(null);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Improved Shadow Step' }] },
            });
            const action = makeAction({ name: 'Shadow Step', automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: PLAYER_NAME,
                targetName: 'Goblin',
                effects: [
                    { type: 'remove_target_effect', effectKey: 'disadvantage_perception_checks', source: 'Improved Shadow Step', target: 'Goblin' },
                    { type: 'condition', condition: 'blinded' },
                ],
                campaignName: CAMPAIGN_NAME,
                rounds: undefined,
                expireOnCreatureName: PLAYER_NAME,
            });
        });

        it('enqueues expiration for Shared Moonlight ally advantage te', async () => {
            setupMoonlightStepMocks(2);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const action = makeAction({ name: 'Blink', automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: PLAYER_NAME,
                targetName: 'Goblin',
                effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Shared Moonlight', target: 'Goblin' }],
                campaignName: CAMPAIGN_NAME,
                rounds: undefined,
                expireOnCreatureName: PLAYER_NAME,
            });
        });

        it('applies Blinded once on a failed save, then unsubscribes (repeat saves are ignored)', async () => {
            setupMoonlightStepMocks(null);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Improved Shadow Step' }] },
            });
            const action = makeAction({ name: 'Shadow Step', automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            const expirationsBeforeSave = addExpiration.mock.calls.length;

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-id', success: false },
            }));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                ['blinded'],
                CAMPAIGN_NAME,
            );
            expect(addExpiration.mock.calls.length).toBe(expirationsBeforeSave);

            // The listener must be one-shot: a second event changes nothing.
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-id', success: false },
            }));
            expect(writesFor('activeConditions')).toHaveLength(1);
        });
    });

    describe('extended flag', () => {
        it('clearExtendedFlag resets the latch to false', () => {
            clearExtendedFlag(PLAYER_NAME, CAMPAIGN_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                '_teleportExtendedUsed',
                false,
                CAMPAIGN_NAME,
            );
        });

        it.each([
            [false, 'a used latch', true],
            [true, 'an unset latch', null],
            [true, 'a cleared latch', false],
        ])('isExtendedAvailable is %s when %s', (expected, _label, flag) => {
            getRuntimeValue.mockReturnValue(flag);
            expect(isExtendedAvailable(PLAYER_NAME, CAMPAIGN_NAME)).toBe(expected);
        });
    });

    describe('§8.1 teleport token-move seam', () => {
        it.each([
            ['a resolved combat target', { target: { name: 'Goblin' } }, 'Goblin'],
            ['no selected target (degrades to a null anchor)', { target: null }, null],
        ])('passes the exact 5-field seam args when the lane has %s', async (_label, resolved, anchorName) => {
            resolveTarget.mockResolvedValue(resolved);

            await confirmTeleport(makeAction(), makePlayerStats(), CAMPAIGN_NAME, false);

            expect(applyTeleportTokenMove).toHaveBeenCalledWith({
                campaignName: CAMPAIGN_NAME,
                mapName: null,
                creatureName: PLAYER_NAME,
                anchorName,
                maxFeet: 60,
            });
        });

        it('seam OFF leaves the legacy prose byte-identical and fires no token log', async () => {
            applyTeleportTokenMove.mockResolvedValue({ moved: false, reason: 'no-target-selected' });
            const result = await confirmTeleport(makeAction(), makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.payload.description).toBe(
                'Shadow of Moil: Teleported 60 ft to an unoccupied space you can see.'
            );
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('seam ON appends rounded coordinates to the prose and logs a full-shape token-move row', async () => {
            applyTeleportTokenMove.mockResolvedValue({
                moved: true,
                from: { gridX: 4, gridY: 4 },
                to: { gridX: 6, gridY: 2 },
                distanceFeet: 19.6,
            });
            const result = await confirmTeleport(makeAction(), makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.payload.description).toBe(
                'Shadow of Moil: Teleported 60 ft to an unoccupied space you can see. Token moved (4,4) → (6,2) — 20 ft.'
            );
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
                type: 'automation',
                characterName: PLAYER_NAME,
                automationType: 'teleport_token_move',
                name: 'Shadow of Moil',
                description: 'Shadow of Moil: token relocated (4,4) → (6,2) within 60 ft.',
                timestamp: FROZEN_NOW,
            });
        });
    });
});
