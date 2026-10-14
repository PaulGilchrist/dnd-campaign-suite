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

import { buildPipelineForAction } from '../../services/combat/steps/index.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

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

const mockPendingDamageRef = { current: null };
const mockSetPendingDamage = vi.fn();
const mockSetTacticalMasterModal = vi.fn();

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
        pendingDamage: mockPendingDamageRef.current,
        setPendingDamage: mockSetPendingDamage,
        setTacticalMasterModal: mockSetTacticalMasterModal,
        resumeRef: mockPendingDamageRef,
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

function resetModalState() {
    Object.keys(modalState).forEach((k) => delete modalState[k]);
}

describe('useAttackDamageResolution - pipeline paused states', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        setRuntimeObject.mockReturnValue(undefined);
        resetModalState();
        mockSetModalState.mockClear();
        mockPendingDamageRef.current = null;
    });

    afterEach(() => {
        resetModalState();
    });

    describe('damageTypeChoice modal pause', () => {
        it('sets damageTypeChoice modal state and pendingDamage when pipeline pauses', async () => {
            const pausedCtx = {
                _pausedStep: 'damageTypeChoice',
                _modalType: 'damageTypeChoice',
                _modalProps: { options: ['fire', 'cold'], featureName: 'Divine Fury' },
                attack: { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' },
                formula: '1d8+3 + 2d6',
                total: 12,
                rolls: [5, 3, 4],
                modifier: 3,
                bonusExpr: '2d6',
                bonusTotal: 6,
                bonusRolls: [4, 2],
                _weaponHitOnceKey: '_DivineFury_usedRound',
                _damageTypeModifier: undefined,
            };
            buildPipelineForAction.mockReturnValueOnce({
                run: vi.fn(async (_event, _ctx, ref) => { ref.current = { pipelineStash: {}, ...pausedCtx }; }),
                resume: vi.fn(async (_ctx, ref) => { ref.current = null; }),
            });

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            await tick();

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, mockPlayerStats);
            expect(mockSetModalState).toHaveBeenCalledWith({
                damageTypeChoice: pausedCtx._modalProps,
            });
            expect(mockSetPendingDamage).toHaveBeenCalledWith({
                attack: pausedCtx.attack,
                formula: pausedCtx.formula,
                total: pausedCtx.total,
                rolls: pausedCtx.rolls,
                modifier: pausedCtx.modifier,
                bonusExpr: pausedCtx.bonusExpr,
                bonusTotal: pausedCtx.bonusTotal,
                bonusRolls: pausedCtx.bonusRolls,
                oncePerTurnKey: pausedCtx._weaponHitOnceKey,
                _damageTypeModifier: undefined,
            });
        });

        it('passes _damageTypeModifier through pendingDamage for Empowered Strikes', async () => {
            const empMod = { name: 'Empowered Strikes', type: 'damage_type_modifier', trigger: 'unarmed_strike_hit' };
            const pausedCtx = {
                _pausedStep: 'damageTypeModifiers',
                _modalType: 'damageTypeChoice',
                _modalProps: { title: 'Empowered Strikes — Damage Type', types: ['Force', 'Bludgeoning'] },
                attack: { name: 'Unarmed Strike', damage: '1d12+3', damageType: 'bludgeoning' },
                formula: '1d12+3',
                total: 10,
                rolls: [7],
                modifier: 3,
                _damageTypeModifier: empMod,
            };
            buildPipelineForAction.mockReturnValueOnce({
                run: vi.fn(async (_event, _ctx, ref) => { ref.current = { pipelineStash: {}, ...pausedCtx }; }),
                resume: vi.fn(async (_ctx, ref) => { ref.current = null; }),
            });

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Unarmed Strike', damage: '1d12+3', damageType: 'bludgeoning' };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockSetPendingDamage).toHaveBeenCalledWith(
                expect.objectContaining({ _damageTypeModifier: empMod })
            );
        });
    });

    describe('divineFury modal pause', () => {
        it('sets divineFuryChoice modal state and pendingDamage when pipeline pauses', async () => {
            const pausedCtx = {
                _pausedStep: 'divineFury',
                _modalType: 'divineFury',
                _modalProps: { options: ['fire', 'cold'], featureName: 'Divine Fury' },
                attack: { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' },
                formula: '1d8+3 + 2d6',
                total: 12,
                rolls: [5, 3, 4],
                modifier: 3,
                bonusExpr: '2d6',
                bonusTotal: 6,
                bonusRolls: [4, 2],
            };
            buildPipelineForAction.mockReturnValueOnce({
                run: vi.fn(async (_event, _ctx, ref) => { ref.current = { pipelineStash: {}, ...pausedCtx }; }),
                resume: vi.fn(async (_ctx, ref) => { ref.current = null; }),
            });

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            await tick();

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, mockPlayerStats);
            expect(mockSetModalState).toHaveBeenCalledWith({
                divineFuryChoice: pausedCtx._modalProps,
            });
            expect(mockSetPendingDamage).toHaveBeenCalledWith({
                attack: pausedCtx.attack,
                formula: pausedCtx.formula,
                total: pausedCtx.total,
                rolls: pausedCtx.rolls,
                modifier: pausedCtx.modifier,
                bonusExpr: pausedCtx.bonusExpr,
                bonusTotal: pausedCtx.bonusTotal,
                bonusRolls: pausedCtx.bonusRolls,
            });
        });
    });

    describe('secondaryTarget modal pause', () => {
        it('sets secondaryTargetModal when pipeline pauses', async () => {
            const pausedCtx = {
                _pausedStep: 'secondaryTarget',
                _modalType: 'secondaryTarget',
                _modalProps: { title: 'Choose Target', targets: ['Orc', 'Goblin'] },
            };
            buildPipelineForAction.mockReturnValueOnce({
                run: vi.fn(async (_event, _ctx, ref) => { ref.current = { pipelineStash: {}, ...pausedCtx }; }),
                resume: vi.fn(async (_ctx, ref) => { ref.current = null; }),
            });

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            await tick();

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, mockPlayerStats);
            expect(mockSetModalState).toHaveBeenCalledWith({
                secondaryTargetModal: pausedCtx._modalProps,
            });
            expect(mockSetPendingDamage).not.toHaveBeenCalled();
        });
    });

    describe('tacticalMaster modal pause', () => {
        it('updates the synced tacticalMasterModal mirror so the modal renders (WM-003)', async () => {
            const pausedCtx = {
                _pausedStep: 'tacticalMaster',
                _modalType: 'tacticalMaster',
                _modalProps: { title: 'Tactical Choice', options: ['attack', 'defend'] },
            };
            buildPipelineForAction.mockReturnValueOnce({
                run: vi.fn(async (_event, _ctx, ref) => { ref.current = { pipelineStash: {}, ...pausedCtx }; }),
                resume: vi.fn(async (_ctx, ref) => { ref.current = null; }),
            });

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            await tick();

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, mockPlayerStats);
            // Fix: the pause must update the synced mirror (renders TacticalMasterModal),
            // NOT a skipSync setRuntimeObject that left the modal dead (never rendered).
            expect(mockSetTacticalMasterModal).toHaveBeenCalledWith(pausedCtx._modalProps);
            expect(mockSetModalState).not.toHaveBeenCalled();
            expect(mockSetPendingDamage).not.toHaveBeenCalled();
        });
    });

    describe('shieldBash modal pause', () => {
        it('sets shieldBashModal when pipeline pauses', async () => {
            const pausedCtx = {
                _pausedStep: 'shieldBash',
                _modalType: 'shieldBash',
                _modalProps: { title: 'Shield Bash', damageExpression: '1d6' },
            };
            buildPipelineForAction.mockReturnValueOnce({
                run: vi.fn(async (_event, _ctx, ref) => { ref.current = { pipelineStash: {}, ...pausedCtx }; }),
                resume: vi.fn(async (_ctx, ref) => { ref.current = null; }),
            });

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            await tick();

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, mockPlayerStats);
            expect(mockSetModalState).toHaveBeenCalledWith({
                shieldBashModal: pausedCtx._modalProps,
            });
            expect(mockSetPendingDamage).not.toHaveBeenCalled();
        });
    });

    describe('pipeline completes without pause', () => {
        it.each([
            { scenario: 'resumeRef.current is null', current: null },
            { scenario: '_pausedStep is null', current: { _pausedStep: null } },
            { scenario: '_pausedStep is unknown', current: { _pausedStep: 'unknownStep' } },
            { scenario: 'resumeRef.current is undefined', current: undefined },
        ])('does not set any modal state when $scenario', async ({ current }) => {
            mockPendingDamageRef.current = current;

            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            await tick();

            expect(buildPipelineForAction).toHaveBeenCalledWith(attack, mockPlayerStats);
            expect(mockSetModalState).not.toHaveBeenCalled();
            if (current !== undefined && current !== null) {
                expect(mockSetPendingDamage).not.toHaveBeenCalled();
            }
            expect(setRuntimeObject).not.toHaveBeenCalled();
        });
    });
});
