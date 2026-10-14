import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    setRuntimeObject: vi.fn(),
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

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(() => ({
        run: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';

const mockSetPopupHtml = vi.fn();
const mockRollDamage = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
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
        setPopupHtml: mockSetPopupHtml,
        rollDamage: mockRollDamage,
        buildCtx: mockBuildCtx,
        buildCtxSync: mockBuildCtxSync,
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

describe('useAttackDamageResolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(modalState).forEach((k) => delete modalState[k]);
        mockSetModalState.mockClear();
    });

    describe('handleAttackRiderManeuverSkip', () => {
        it('sets attackRiderManeuverPrompt to null in modal state', () => {
            const { handleAttackRiderManeuverSkip } = UseAttackDamageResolution();
            handleAttackRiderManeuverSkip();
            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderManeuverPrompt: null });
        });

        it('returns undefined', () => {
            const { handleAttackRiderManeuverSkip } = UseAttackDamageResolution();
            const result = handleAttackRiderManeuverSkip();
            expect(result).toBeUndefined();
        });
    });

    describe('handleAttackRiderOptionSelect', () => {
        it('resets attackRiderOptionsModal and sets brutalStrike flags', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const modalPayload = {
                maneuver: { name: 'Brutal Strike', automation: { options: [] } },
                targetName: 'Goblin',
                description: 'Test description',
            };

            await handleAttackRiderOptionSelect('brutal', modalPayload);

            expect(mockSetModalState).toHaveBeenCalledWith({ attackRiderOptionsModal: null });
        });

        it('sets popupHtml with automation info', async () => {
            const { handleAttackRiderOptionSelect } = UseAttackDamageResolution();
            const modalPayload = {
                maneuver: { name: 'Brutal Strike', automation: { options: [] } },
                targetName: 'Goblin',
                description: 'Test description',
            };

            await handleAttackRiderOptionSelect('brutal', modalPayload);

            expect(mockSetPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'automation_info' })
            );
        });
    });
});
