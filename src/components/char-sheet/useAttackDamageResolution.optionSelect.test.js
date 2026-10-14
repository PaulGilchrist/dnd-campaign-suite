import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';

const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

function UseAttackDamageResolution(overrides = {}) {
    const deps = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function resetModalState() {
    Object.keys(modalState).forEach((k) => delete modalState[k]);
}

describe('useAttackDamageResolution - handleAttackRiderOptionSelect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        resetModalState();
        mockSetModalState.mockClear();
    });

    afterEach(() => {
        resetModalState();
    });

    // ── Brutal Strike flag setup ────────────────────────────────────────

    describe('brutal strike flags', () => {
        it('sets _brutalStrikeActive and _brutalStrikeEffects before processing', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Extra Damage', effect: 'extra_damage' }],
                },
            };

            await handleAttackRiderOptionSelect('Extra Damage', { maneuver, targetName: 'Goblin', description: 'Test' });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeEffects', ['Extra Damage'], 'test-campaign');
        });

        it('clears attackRiderOptionsModal after selection', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Extra Damage', effect: 'extra_damage' }],
                },
            };

            await handleAttackRiderOptionSelect('Extra Damage', { maneuver, targetName: 'Goblin', description: 'Test' });

            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
        });
    });

    // ── Push effect ─────────────────────────────────────────────────────

    describe('push_15ft effect', () => {
        it('applies push targetEffect with targetName', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') return [];
                return null;
            });

            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Knock Back', effect: 'push_15ft' }],
                },
            };

            await handleAttackRiderOptionSelect('Knock Back', { maneuver, targetName: 'Goblin', description: 'Brutal Strike' });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin', source: 'TestFighter',
                        option: 'Knock Back', effect: 'push', value: 15,
                        duration: 'instant',
                    }),
                ]),
                'test-campaign',
            );
        });

        it('does not apply push effect when targetName is null', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') return [];
                return null;
            });

            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Knock Back', effect: 'push_15ft' }],
                },
            };

            await handleAttackRiderOptionSelect('Knock Back', { maneuver, targetName: null, description: 'Brutal Strike' });

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(targetEffectCalls).toHaveLength(0);
        });
    });

    // ── Speed reduction effect ──────────────────────────────────────────

    describe('speed_reduction effect', () => {
        it('applies speed_reduction targetEffect with targetName', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') return [];
                return null;
            });

            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Slow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn' }],
                },
            };

            await handleAttackRiderOptionSelect('Slow', { maneuver, targetName: 'Goblin', description: 'Brutal Strike' });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin', source: 'TestFighter',
                        option: 'Slow', effect: 'speed_reduction',
                        value: '15_ft_until_start_of_next_turn',
                        duration: 'until_start_of_next_turn',
                    }),
                ]),
                'test-campaign',
            );
        });

        it('defaults duration when option.value is missing and does not apply when targetName is null', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') return [];
                return null;
            });

            // Test default duration
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Slow', effect: 'speed_reduction' }],
                },
            };

            await handleAttackRiderOptionSelect('Slow', { maneuver, targetName: 'Goblin', description: 'Brutal Strike' });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        value: '15_ft_until_start_of_next_turn',
                        duration: 'until_start_of_next_turn',
                    }),
                ]),
                'test-campaign',
            );

            // Test null targetName
            getRuntimeValue.mockClear();
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') return [];
                return null;
            });
            setRuntimeValue.mockClear();

            await handleAttackRiderOptionSelect('Slow', { maneuver, targetName: null, description: 'Brutal Strike' });

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(targetEffectCalls).toHaveLength(0);
        });
    });

    // ── Option found in automation.options ──────────────────────────────

    describe('option found in automation.options', () => {
        it('clears attackRiderOptionsModal and sets popupHtml with automation_info', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [{ name: 'Extra Damage', effect: 'extra_damage' }],
                },
            };

            await handleAttackRiderOptionSelect('Extra Damage', { maneuver, targetName: 'Goblin', description: 'Brutal Strike' });

            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
        });
    });

    // ── Missing option ──────────────────────────────────────────────────

    describe('missing option', () => {
        it('still sets flags and popupHtml when option is not found in automation.options', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const maneuver = {
                name: 'Brutal Strike',
                automation: {
                    options: [],
                },
            };

            await handleAttackRiderOptionSelect('Nonexistent Option', { maneuver, targetName: 'Goblin', description: 'Brutal Strike' });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeEffects', ['Nonexistent Option'], 'test-campaign');
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(targetEffectCalls).toHaveLength(0);
        });
    });

    // ── Edge cases ──────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('throws when maneuver is missing (no automation property)', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();

            await expect(
                handleAttackRiderOptionSelect('Some Option', { targetName: 'Goblin', description: 'Test' })
            ).rejects.toThrow();
        });

        it('throws when modalPayload is null', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();

            await expect(
                handleAttackRiderOptionSelect('Some Option', null)
            ).rejects.toThrow();
        });
    });
});
