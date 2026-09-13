// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'TestFighter'),
    getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn().mockResolvedValue({ round: 1, activeCreature: 'TestFighter' }),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as logService from '../../services/ui/logService.js';
import * as oncePerTurn from '../../services/automation/common/oncePerTurn.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'TestFighter',
    level: 5,
    class: { name: 'Fighter' },
};

function createDeps(overrides = {}) {
    const {
        cannotAct = false,
        playerName = 'TestFighter',
        playerStats = basePlayerStats,
        getRuntimeValue = vi.fn(),
        setRuntimeValue = vi.fn(),
        buildCtx = vi.fn(() => Promise.resolve({})),
        rollAttack = vi.fn(),
        setModalState = vi.fn(),
        specialActions = [],
        passives = [],
        exhaustionPenalty = 0,
    } = overrides;

    return {
        cannotAct,
        buildCtx,
        rollAttack,
        exhaustionPenalty,
        playerName,
        campaignName,
        setModalState,
        specialActions,
        passives,
        playerStats,
        getRuntimeValue,
        setRuntimeValue,
    };
}

describe('useCharActionsAttackHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleRecklessAttackConfirm', () => {
        it('should toggle buff, add log entry, set expiration, and update targetEffects', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
                passives: [],
                buildCtx,
                rollAttack,
            });
            const attack = { name: 'Longsword' };

            const handlers = useCharActionsAttackHandlers(deps);
            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestFighter',
                'Reckless Attack',
                { effect: 'advantage_attacks_advantage_against', duration: 'until_start_of_next_turn' },
                campaignName,
                'TestFighter'
            );
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Reckless Attack',
            }));
            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestFighter', targetName: 'TestFighter', effects: [{ type: 'remove_active_buff', buffName: 'Reckless Attack' }], campaignName, rounds: undefined, expireOnCreatureName: 'TestFighter' });
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({ effect: 'reckless_attack', target: 'TestFighter' }),
            ]), campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_recklessAttack_offeredThisTurn',
                expect.objectContaining({ activeCreature: 'TestFighter' }),
                campaignName
            );
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await new Promise(process.nextTick);
            expect(buildCtx).toHaveBeenCalledWith(attack);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', expect.any(Number), expect.any(Object));
        });

        it('should not duplicate targetEffects entry if reckless_attack already exists', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [
                    { target: 'TestFighter', source: 'TestFighter', effect: 'reckless_attack', duration: 'until_start_of_next_turn' },
                ];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
                passives: [],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalled();
            expect(expirations.addExpiration).toHaveBeenCalled();

            const teCalls = deps.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
            expect(teCalls.length).toBe(0);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_recklessAttack_offeredThisTurn',
                expect.objectContaining({ activeCreature: 'TestFighter' }),
                campaignName
            );
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
        });

        it('should set up brutal strike when choice is provided', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1', 'option2'],
            };

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
                passives: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6' }],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, brutalChoice);

            expect(buffToggle.toggleBuff).toHaveBeenCalled();
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeEffects', ['option1', 'option2'], campaignName);
            expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Brutal Strike', '_BrutalStrike_usedRound', basePlayerStats, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeNoAdvantage', true, campaignName);

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Brutal Strike',
                description: expect.stringContaining('Brutal Strike'),
            }));
        });

        it('should clear _brutalStrikeNoAdvantage in finally block when brutal strike was used', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1'],
            };

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
                passives: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6' }],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, brutalChoice);

            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeNoAdvantage', null, campaignName);
        });

        it('should NOT clear _brutalStrikeNoAdvantage when brutal strike was not used', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: false,
                effectChoices: [],
            };

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
                passives: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6' }],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, brutalChoice);

            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            const brutalNoAdvCalls = deps.setRuntimeValue.mock.calls.filter(
                c => c[1] === '_brutalStrikeNoAdvantage'
            );
            expect(brutalNoAdvCalls.length).toBe(0);
        });

        it('should handle buildCtx error in finally block', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.reject(new Error('build failed')));
            const rollAttack = vi.fn();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1'],
            };

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [{ effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' }],
                passives: [{ type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6' }],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, brutalChoice);

            await new Promise(process.nextTick);
            await new Promise(process.nextTick);

            expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeNoAdvantage', null, campaignName);
            consoleErrorSpy.mockRestore();
        });

        it('should apply exhaustionPenalty to the attack roll', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                if (charKey === 'campaign' && key === 'targetEffects') return [];
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 8 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
                exhaustionPenalty: 2,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);
            handlers.handleRecklessAttackConfirm(attack, null);

            await new Promise(process.nextTick);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
        });
    });

    describe('handleRecklessAttackCancel', () => {
        it('should set offeredThisTurn, clear modal, and proceed with attack', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleRecklessAttackCancel(attack);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_recklessAttack_offeredThisTurn',
                { round: 1, activeCreature: 'TestFighter' },
                campaignName
            );
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await new Promise(process.nextTick);
            expect(buildCtx).toHaveBeenCalledWith(attack);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', expect.any(Number), expect.any(Object));
        });

        it('should handle buildCtx rejection', async () => {
            const buildCtx = vi.fn(() => Promise.reject(new Error('build failed')));
            const rollAttack = vi.fn();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleRecklessAttackCancel(attack);

            await new Promise(process.nextTick);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('should apply exhaustionPenalty to the attack roll', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 8 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                buildCtx,
                rollAttack,
                exhaustionPenalty: 2,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleRecklessAttackCancel(attack);

            await new Promise(process.nextTick);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
        });
    });

    describe('handleBrutalStrikeConfirm', () => {
        it('should set up brutal strike when useBrutalStrike is true', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1', 'option2'],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeConfirm(brutalChoice, attack);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeEffects', ['option1', 'option2'], campaignName);
            expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Brutal Strike', '_BrutalStrike_usedRound', basePlayerStats, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Brutal Strike',
                description: expect.stringContaining('Brutal Strike'),
            }));
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await new Promise(process.nextTick);
            expect(buildCtx).toHaveBeenCalledWith(attack);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', expect.any(Number), expect.any(Object));
        });

        it('should skip brutal strike setup when useBrutalStrike is false', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: false,
                effectChoices: [],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeConfirm(brutalChoice, attack);

            expect(deps.setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, campaignName);
            expect(deps.setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_brutalStrikeEffects', expect.any(Array), campaignName);
            expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({ abilityName: 'Brutal Strike' }));
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await new Promise(process.nextTick);
            expect(buildCtx).toHaveBeenCalledWith(attack);
        });

        it('should skip buildCtx/rollAttack when attack is null', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1'],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleBrutalStrikeConfirm(brutalChoice, null);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_brutalStrikeEffects', ['option1'], campaignName);
            expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Brutal Strike', '_BrutalStrike_usedRound', basePlayerStats, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Brutal Strike',
            }));
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            expect(buildCtx).not.toHaveBeenCalled();
            expect(rollAttack).not.toHaveBeenCalled();
        });

        it('should handle missing attack name gracefully in log entry', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: [],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = null;

            handlers.handleBrutalStrikeConfirm(brutalChoice, attack);

            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('no effect'),
            }));
            expect(buildCtx).not.toHaveBeenCalled();
        });

        it('should handle buildCtx rejection', async () => {
            const buildCtx = vi.fn(() => Promise.reject(new Error('build failed')));
            const rollAttack = vi.fn();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1'],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeConfirm(brutalChoice, attack);

            await new Promise(process.nextTick);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('should apply exhaustionPenalty to the attack roll', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 8 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: true,
                effectChoices: ['option1'],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
                exhaustionPenalty: 2,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeConfirm(brutalChoice, attack);

            await new Promise(process.nextTick);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
        });

        it('should skip brutal strike setup and proceed when brutalStrikeChoice is null', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeConfirm(null, attack);

            expect(deps.setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, campaignName);
            expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await new Promise(process.nextTick);
            expect(buildCtx).toHaveBeenCalledWith(attack);
        });

        it('should skip brutal strike setup and proceed when attack is null and useBrutalStrike is false', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const brutalChoice = {
                useBrutalStrike: false,
                effectChoices: [],
            };

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleBrutalStrikeConfirm(brutalChoice, null);

            expect(deps.setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_brutalStrikeActive', true, campaignName);
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            expect(buildCtx).not.toHaveBeenCalled();
            expect(rollAttack).not.toHaveBeenCalled();
        });
    });

    describe('handleBrutalStrikeCancel', () => {
        it('should clear modal and proceed with attack', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeCancel(attack);

            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await new Promise(process.nextTick);
            expect(buildCtx).toHaveBeenCalledWith(attack);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', expect.any(Number), expect.any(Object));
        });

        it('should skip buildCtx/rollAttack when attack is null', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleBrutalStrikeCancel(null);

            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            expect(buildCtx).not.toHaveBeenCalled();
            expect(rollAttack).not.toHaveBeenCalled();
        });

        it('should handle buildCtx rejection', async () => {
            const buildCtx = vi.fn(() => Promise.reject(new Error('build failed')));
            const rollAttack = vi.fn();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            const deps = createDeps({
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeCancel(attack);

            await new Promise(process.nextTick);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('should apply exhaustionPenalty to the attack roll', async () => {
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 8 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                buildCtx,
                rollAttack,
                exhaustionPenalty: 2,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleBrutalStrikeCancel(attack);

            await new Promise(process.nextTick);
            expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
        });
    });
});
