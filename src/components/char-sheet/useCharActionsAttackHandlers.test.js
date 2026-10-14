import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'TestFighter'),
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
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

import * as friendsService from '../../services/rules/features/friendsService.js';
import * as invisibilityService from '../../services/rules/features/invisibilityService.js';

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

    describe('handleAttackClick', () => {
        it('should return early without any action when cannotAct is true', () => {
            const deps = createDeps({ cannotAct: true });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(friendsService.endFriendsOnHostileAction).not.toHaveBeenCalled();
            expect(invisibilityService.endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });

        it('should return the five handler functions', () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            expect(typeof handlers.handleAttackClick).toBe('function');
            expect(typeof handlers.handleRecklessAttackConfirm).toBe('function');
            expect(typeof handlers.handleRecklessAttackCancel).toBe('function');
            expect(typeof handlers.handleBrutalStrikeConfirm).toBe('function');
            expect(typeof handlers.handleBrutalStrikeCancel).toBe('function');
        });

        it('should call endFriendsOnHostileAction and endInvisibilityOnHostileAction before proceeding', () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(friendsService.endFriendsOnHostileAction).toHaveBeenCalledWith('TestFighter', campaignName);
            expect(invisibilityService.endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestFighter', campaignName);
        });

        it('should open reckless attack modal when feature exists, buff not active, and not offered this turn', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives: [],
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).toHaveBeenCalledWith({
                recklessAttackModal: {
                    attack,
                    mode: 'full',
                    hasBrutalStrike: false,
                    brutalStrikeOptions: [],
                    maxEffects: 1,
                    riderName: 'Brutal Strike',
                },
            });
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
        });

        it('should open brutal strike only modal when reckless is active and brutal strike exists but not used this turn', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];
            const passives = [
                { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6', options: ['option1'], maxEffects: 2 },
            ];

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).toHaveBeenCalledWith({
                recklessAttackModal: {
                    attack,
                    mode: 'brutalOnly',
                    hasBrutalStrike: true,
                    brutalStrikeOptions: ['option1'],
                    maxEffects: 2,
                    riderName: 'Brutal Strike',
                },
            });
            expect(deps.buildCtx).not.toHaveBeenCalled();
        });

        it('should skip modal and go straight to buildCtx when reckless is active and brutal strike already used this turn', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return { activeCreature: 'TestFighter' };
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];
            const passives = [
                { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6' },
            ];

            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives,
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).not.toHaveBeenCalled();

            vi.waitFor(() => {
                expect(buildCtx).toHaveBeenCalledWith(attack);
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
            });
        });

        it('should skip modal and go straight to buildCtx when no reckless feature', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).not.toHaveBeenCalled();

            vi.waitFor(() => {
                expect(buildCtx).toHaveBeenCalledWith(attack);
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
            });
        });

        it('should skip modal and go straight to buildCtx when reckless offered this turn for current creature', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return { activeCreature: 'TestFighter' };
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives: [],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).not.toHaveBeenCalled();

            vi.waitFor(() => {
                expect(buildCtx).toHaveBeenCalledWith(attack);
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 6, expect.any(Object));
            });
        });

        it('should open modal when reckless offered this turn but for a different creature', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return { activeCreature: 'OtherCreature' };
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives: [],
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).toHaveBeenCalledWith({
                recklessAttackModal: {
                    attack,
                    mode: 'full',
                    hasBrutalStrike: false,
                    brutalStrikeOptions: [],
                    maxEffects: 1,
                    riderName: 'Brutal Strike',
                },
            });
            expect(deps.buildCtx).not.toHaveBeenCalled();
        });

        it('should open brutal modal when brutal strike used this turn but by a different creature', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return { activeCreature: 'OtherCreature' };
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];
            const passives = [
                { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6', options: ['option1'], maxEffects: 2 },
            ];

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).toHaveBeenCalledWith({
                recklessAttackModal: {
                    attack,
                    mode: 'brutalOnly',
                    hasBrutalStrike: true,
                    brutalStrikeOptions: ['option1'],
                    maxEffects: 2,
                    riderName: 'Brutal Strike',
                },
            });
            expect(deps.buildCtx).not.toHaveBeenCalled();
        });

        it('should apply exhaustionPenalty to the attack roll', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
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

            vi.waitFor(() => {
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 4, expect.any(Object));
            });
        });

        it('should use ctx.hitBonus when available, falling back to attack.hitBonus', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 10 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
                exhaustionPenalty: 0,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword', hitBonus: 5 };

            handlers.handleAttackClick(attack);

            vi.waitFor(() => {
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 10, expect.any(Object));
            });
        });

        it('should fall back to attack.hitBonus when ctx.hitBonus is absent', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({}));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
                exhaustionPenalty: 0,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword', hitBonus: 7 };

            handlers.handleAttackClick(attack);

            vi.waitFor(() => {
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 7, expect.any(Object));
            });
        });

        it('should fall back to attack.hitBonus when ctx is null', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve(null));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
                exhaustionPenalty: 0,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword', hitBonus: 3 };

            handlers.handleAttackClick(attack);

            vi.waitFor(() => {
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 3, expect.any(Object));
            });
        });

        it('should sort brutal strike passives by damage expression count descending', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const specialActions = [
                { effect: 'advantage_attacks_advantage_against', trigger: 'first_attack_of_turn' },
            ];
            const passives = [
                { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', options: ['low'], maxEffects: 1 },
                { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '3d6', options: ['high'], maxEffects: 3 },
                { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6', options: ['mid'], maxEffects: 2 },
            ];

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions,
                passives,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).toHaveBeenCalledWith({
                recklessAttackModal: expect.objectContaining({
                    hasBrutalStrike: true,
                    brutalStrikeOptions: ['high'],
                    maxEffects: 3,
                }),
            });
        });

        it('should handle missing passives array gracefully', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: undefined,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).not.toHaveBeenCalled();
        });

        it('should handle missing specialActions gracefully', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: undefined,
                passives: [],
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(deps.setModalState).not.toHaveBeenCalled();
        });

        it('should handle buildCtx rejection gracefully', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.reject(new Error('build failed')));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            await new Promise(process.nextTick);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('should handle buildCtx returning undefined gracefully', () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'activeBuffs') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve(undefined));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
                exhaustionPenalty: 0,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword', hitBonus: 4 };

            handlers.handleAttackClick(attack);

            vi.waitFor(() => {
                expect(rollAttack).toHaveBeenCalledWith('Longsword', 4, expect.any(Object));
            });
        });

        it('should use 3rd arg (campaignName) when reading activeBuffs', () => {
            const grv = vi.fn((charKey, key, cn) => {
                if (charKey === 'TestFighter' && key === 'activeBuffs' && cn === 'test-campaign') return [];
                if (key === '_recklessAttack_offeredThisTurn') return null;
                if (key === '_BrutalStrike_usedRound') return null;
                return undefined;
            });
            const buildCtx = vi.fn(() => Promise.resolve({ hitBonus: 6 }));
            const rollAttack = vi.fn();

            const deps = createDeps({
                getRuntimeValue: grv,
                specialActions: [],
                passives: [],
                buildCtx,
                rollAttack,
            });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = { name: 'Longsword' };

            handlers.handleAttackClick(attack);

            expect(grv).toHaveBeenCalledWith('TestFighter', 'activeBuffs', 'test-campaign');
            vi.waitFor(() => {
                expect(buildCtx).toHaveBeenCalledWith(attack);
            });
        });
    });
});
