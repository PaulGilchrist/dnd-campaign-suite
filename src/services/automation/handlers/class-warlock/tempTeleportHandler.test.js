// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle, confirmTeleport, clearExtendedFlag, isExtendedAvailable } from './tempTeleportHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 3),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 13),
    createSaveListener: vi.fn(() => ({ promptId: 'test-id' })),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: { name: 'Goblin' } })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';

// ── Constants ──────────────────────────────────────────────────

const CAMPAIGN_NAME = 'test-campaign';
const PLAYER_NAME = 'TestHero';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Shadow of Moil',
        description: 'Teleport ability.',
        automation: {
            type: 'teleport',
            distance: '60 ft',
            effect: 'teleport',
            ...overrides.automation,
        },
        ...overrides,
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

// ── Tests ──────────────────────────────────────────────────────

describe('tempTeleportHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        buildSaveDc.mockReturnValue(13);
        resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    });

    afterEach(() => {
        document.dispatchEvent(new Event('cleanup'));
    });

    describe('handle', () => {
        it('returns teleport modal with payload for basic teleport', async () => {
            const action = makeAction();
            const stats = makePlayerStats();

            const result = await handle(action, stats, CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(stats);
            expect(result.payload.campaignName).toBe(CAMPAIGN_NAME);
        });

        it('returns teleport modal when action is null', async () => {
            const stats = makePlayerStats();
            const result = await handle(null, stats, CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });

        it('returns info popup when moonlight_step_teleport has zero uses and no spell slots', async () => {
            getRuntimeValue.mockReturnValue(0);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Shadow of Moil');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('returns moonlightStepFallback modal when moonlight_step_teleport has zero uses but spell slots available', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'moonlightStepUses') return 0;
                if (key === 'targetEffects') return [];
                if (key === 'spell_slots_level_2') return 3;
                if (key === 'spell_slots_level_3') return 2;
                return null;
            });
            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_2: 3 },
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, stats, CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('moonlightStepFallback');
            expect(result.payload.slotLevel).toBe(2);
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(stats);
            expect(result.payload.campaignName).toBe(CAMPAIGN_NAME);
        });

        it('returns moonlightStepFallback modal using highest available spell slot level', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'moonlightStepUses') return 0;
                if (key === 'spell_slots_level_2') return 0;
                if (key === 'spell_slots_level_3') return 1;
                return null;
            });
            const stats = makePlayerStats({
                spellAbilities: {
                    spell_slots_level_2: 3,
                    spell_slots_level_3: 2,
                },
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, stats, CAMPAIGN_NAME, 'test-map');

            expect(result.modalName).toBe('moonlightStepFallback');
            expect(result.payload.slotLevel).toBe(3);
        });

        it('returns modal when moonlight_step_teleport has uses remaining or null', async () => {
            getRuntimeValue.mockReturnValue(1);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('teleport');
        });
    });

    describe('confirmTeleport', () => {
        it('returns popup with distance from automation for basic teleport', async () => {
            const action = makeAction();
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Shadow of Moil');
            expect(result.payload.description).toContain('60 ft');
            expect(result.payload.description).toContain('Teleported');
        });

        it('uses extended distance when useExtended is true', async () => {
            const action = makeAction({
                automation: { extendedDistance: '150 ft' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, true);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('150 ft');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                '_teleportExtendedUsed',
                true,
                CAMPAIGN_NAME,
            );
        });

        it('uses default 150 ft extended distance when extendedDistance is not specified', async () => {
            const action = makeAction({
                automation: {},
            });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, true);

            expect(result.payload.description).toContain('150 ft');
        });

        it('describes swap with illusion', async () => {
            const action = makeAction({
                automation: { effect: 'teleport_swap_with_illusion' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.payload.description).toContain('Swapped places with your illusion');
        });

        it('describes swap with illusion even when useExtended is true', async () => {
            const action = makeAction({
                automation: { effect: 'teleport_swap_with_illusion' },
            });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, true);

            expect(result.payload.description).toContain('Swapped places with your illusion');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                '_teleportExtendedUsed',
                true,
                CAMPAIGN_NAME,
            );
        });

        it('adds next_attack_advantage effect for moonlight_step teleport', async () => {
            setupMoonlightStepMocks(0);

            const moonlightAction = makeAction({ automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(moonlightAction, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        effect: 'next_attack_advantage',
                        target: PLAYER_NAME,
                    }),
                ]),
                CAMPAIGN_NAME,
            );
        });

        it('CLA-230: replaces an existing same-source advantage te instead of stacking', async () => {
            setupMoonlightStepMocks(0);
            const existing = {
                effect: 'next_attack_advantage',
                target: PLAYER_NAME,
                source: 'Moonlight Step',
                value: null,
                duration: 'until_end_of_turn',
            };
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'moonlightStepUses') return 0;
                if (key === 'targetEffects') return [existing];
                return null;
            });

            const moonlightAction = makeAction({ automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(moonlightAction, makePlayerStats(), CAMPAIGN_NAME, false);

            const writes = setRuntimeValue.mock.calls.filter(
                c => c[0] === 'campaign' && c[1] === 'targetEffects'
            );
            const finalList = writes[writes.length - 1][2];
            const matching = finalList.filter(
                te => te.effect === 'next_attack_advantage' && te.target === PLAYER_NAME && te.source === 'Moonlight Step'
            );
            expect(matching).toHaveLength(1);
        });

        it('CLA-230: preserves unrelated te while replacing same-source advantage te', async () => {
            setupMoonlightStepMocks(0);
            const unrelated = { effect: 'blessed', target: PLAYER_NAME, source: 'Bless' };
            const stale = { effect: 'next_attack_advantage', target: PLAYER_NAME, source: 'Moonlight Step' };
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'moonlightStepUses') return 0;
                if (key === 'targetEffects') return [unrelated, stale];
                return null;
            });

            const moonlightAction = makeAction({ automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(moonlightAction, makePlayerStats(), CAMPAIGN_NAME, false);

            const writes = setRuntimeValue.mock.calls.filter(
                c => c[0] === 'campaign' && c[1] === 'targetEffects'
            );
            const finalList = writes[writes.length - 1][2];
            expect(finalList).toContainEqual(expect.objectContaining({ source: 'Bless' }));
            expect(finalList.filter(te => te.source === 'Moonlight Step')).toHaveLength(1);
        });

        it('adds Improved Shadow Step effects when passive exists', async () => {
            setupMoonlightStepMocks(0);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Improved Shadow Step' }] },
            });
            const action = makeAction({
                automation: { effect: 'shadow_step_teleport' },
            });
            const result = await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(result.payload.description).toContain('Improved Shadow Step');
            expect(result.payload.description).toContain('disadvantage');
            expect(result.payload.description).toContain('Blinded');
            expect(resolveTarget).toHaveBeenCalledWith(CAMPAIGN_NAME, PLAYER_NAME);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.any(Array),
                CAMPAIGN_NAME,
            );
        });

        it('adds Shared Moonlight effect when Lunar Form passive exists', async () => {
            setupMoonlightStepMocks(0);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(result.payload.description).toContain('Shared Moonlight');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        effect: 'next_attack_advantage',
                        source: 'Shared Moonlight',
                    }),
                ]),
                CAMPAIGN_NAME,
            );
        });

        it('does not add Shared Moonlight when resolveTarget returns no target', async () => {
            setupMoonlightStepMocks(0);
            resolveTarget.mockResolvedValue({ target: null });
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            const result = await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(result.payload.description).not.toContain('Shared Moonlight');
        });

        it('decrements moonlight step uses when above zero', async () => {
            setupMoonlightStepMocks(3);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                'moonlightStepUses',
                2,
                CAMPAIGN_NAME,
            );
        });

        it('does not decrement moonlight step uses when at zero', async () => {
            setupMoonlightStepMocks(0);
            const action = makeAction({
                automation: { effect: 'moonlight_step_teleport' },
            });
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                PLAYER_NAME,
                'moonlightStepUses',
                expect.any(Number),
                CAMPAIGN_NAME,
            );
        });

        it('brings allies when useExtended with allyCount', async () => {
            setupMoonlightStepMocks(0);
            const action = makeAction({
                automation: {
                    extendedDistance: '150 ft',
                    bringAllies: true,
                    allyCount: 3,
                    teleportRange: '10 ft',
                },
            });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, true);

            expect(result.payload.description).toContain('150 ft');
            expect(result.payload.description).toContain('3 willing creatures');
            expect(result.payload.description).toContain('10 ft');
        });

        it('omits ally text when bringAllies is false or allyCount is zero', async () => {
            setupMoonlightStepMocks(0);
            const action = makeAction({
                automation: {
                    extendedDistance: '150 ft',
                    bringAllies: true,
                    allyCount: 0,
                },
            });
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, true);
            expect(result.payload.description).not.toContain('willing creatures');
        });

        it('consumes a spell slot when consumedSlotLevel is provided and slots are available', async () => {
            setupMoonlightStepMocks(0);
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                if (key === 'spell_slots_level_3') return 2;
                return null;
            });
            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_3: 3 },
            });
            const action = makeAction();
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false, 3);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                'spell_slots_level_3',
                1,
                CAMPAIGN_NAME,
            );
        });

        it('does not consume a spell slot when consumedSlotLevel is provided but no slots are available', async () => {
            setupMoonlightStepMocks(0);
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'targetEffects') return [];
                if (key === 'spell_slots_level_3') return 0;
                return null;
            });
            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_3: 3 },
            });
            const action = makeAction();
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false, 3);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                PLAYER_NAME,
                'spell_slots_level_3',
                expect.any(Number),
                CAMPAIGN_NAME,
            );
        });

        it('does not consume a spell slot when consumedSlotLevel is not provided', async () => {
            setupMoonlightStepMocks(0);
            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_3: 3 },
            });
            const action = makeAction();
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                PLAYER_NAME,
                'spell_slots_level_3',
                expect.any(Number),
                CAMPAIGN_NAME,
            );
        });

        it('logs ability_use for shadow_step teleport with advantage description', async () => {
            setupMoonlightStepMocks(0);
            const action = makeAction({ automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: PLAYER_NAME,
                    abilityName: 'Shadow of Moil',
                    description: expect.stringContaining('Gains Advantage on next attack roll'),
                }),
            );
        });

        it('logs ability_use for bonus_teleport effect', async () => {
            const action = makeAction({ automation: { effect: 'bonus_teleport' } });
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN_NAME,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: PLAYER_NAME,
                    abilityName: 'Shadow of Moil',
                }),
            );
        });

        it('returns popup with correct metadata fields', async () => {
            const action = makeAction();
            const result = await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Shadow of Moil');
            expect(result.payload.automationType).toBe('teleport');
        });
    });

    // CLA-191 regression: cloud effects must enqueue pendingExpirations so they
    // clear at the start of the caster's next turn instead of persisting forever.
    describe('CLA-191 expiration enforcement', () => {
        function makeShadowStepStats() {
            return makePlayerStats({
                automation: { passives: [{ name: 'Improved Shadow Step' }] },
            });
        }

        it('enqueues expiration for caster next_attack_advantage on shadow_step teleport', async () => {
            setupMoonlightStepMocks(null);
            const action = makeAction({ name: 'Shadow Step', automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: PLAYER_NAME, effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Shadow Step', target: PLAYER_NAME }], campaignName: CAMPAIGN_NAME, rounds: undefined, expireOnCreatureName: PLAYER_NAME });
        });

        it('enqueues expiration for caster next_attack_advantage on moonlight_step teleport', async () => {
            setupMoonlightStepMocks(2);
            const action = makeAction({ name: 'Blink', automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: PLAYER_NAME, effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Blink', target: PLAYER_NAME }], campaignName: CAMPAIGN_NAME, rounds: undefined, expireOnCreatureName: PLAYER_NAME });
        });

        it('enqueues expirations for Improved Shadow Step perception te and blinded condition', async () => {
            setupMoonlightStepMocks(null);
            const action = makeAction({ name: 'Shadow Step', automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(action, makeShadowStepStats(), CAMPAIGN_NAME, false);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: 'Goblin', effects: [
                    { type: 'remove_target_effect', effectKey: 'disadvantage_perception_checks', source: 'Improved Shadow Step', target: 'Goblin' },
                    { type: 'condition', condition: 'blinded' },
                ], campaignName: CAMPAIGN_NAME, rounds: undefined, expireOnCreatureName: PLAYER_NAME });
        });

        it('enqueues expiration for Shared Moonlight ally advantage te', async () => {
            setupMoonlightStepMocks(2);
            const stats = makePlayerStats({
                automation: { passives: [{ name: 'Lunar Form' }] },
            });
            const action = makeAction({ name: 'Blink', automation: { effect: 'moonlight_step_teleport' } });
            await confirmTeleport(action, stats, CAMPAIGN_NAME, false);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: 'Goblin', effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Shared Moonlight', target: 'Goblin' }], campaignName: CAMPAIGN_NAME, rounds: undefined, expireOnCreatureName: PLAYER_NAME });
        });

        it('applies Blinded on failed save with pending expiration already registered', async () => {
            setupMoonlightStepMocks(null);
            const action = makeAction({ name: 'Shadow Step', automation: { effect: 'shadow_step_teleport' } });
            await confirmTeleport(action, makeShadowStepStats(), CAMPAIGN_NAME, false);

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
        });

        it('does not enqueue expirations for basic teleport', async () => {
            setupMoonlightStepMocks(null);
            const action = makeAction();
            await confirmTeleport(action, makePlayerStats(), CAMPAIGN_NAME, false);

            expect(addExpiration).not.toHaveBeenCalled();
        });
    });

    describe('clearExtendedFlag', () => {
        it('sets extended used flag to false', async () => {
            await clearExtendedFlag(PLAYER_NAME, CAMPAIGN_NAME);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                '_teleportExtendedUsed',
                false,
                CAMPAIGN_NAME,
            );
        });
    });

    describe('isExtendedAvailable', () => {
        it('returns false when flag is true', () => {
            getRuntimeValue.mockReturnValue(true);
            expect(isExtendedAvailable(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
        });

        it('returns true when flag is falsy', () => {
            getRuntimeValue.mockReturnValue(null);
            expect(isExtendedAvailable(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
        });
    });
});
