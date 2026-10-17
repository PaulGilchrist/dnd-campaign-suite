// @maintained-by-ai
// @improved-by-ai
// Unit tests for the handleAttackClick lane of useCharActionsAttackHandlers.
// Scope note: confirm/cancel chooser handlers are covered by
// useCharActionsAttackHandlers-2.test.js and .brutalGate.test.js; CLA-143 /
// CLA-274 / CLA-405 latch lanes by the cla143-stamp / psychicBlade /
// fleetStep suites; rider selection & sorting by .improvedBrutalStrike.test.js
// — this file deliberately does not re-test those.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

import * as assertCanActModule from '../../services/combat/assertCanAct.js';
import * as lineOfSightGate from '../../services/combat/lineOfSightGate.js';
import * as coverService from '../../services/combat/coverService.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as logService from '../../services/ui/logService.js';
import * as friendsService from '../../services/rules/features/friendsService.js';
import * as invisibilityService from '../../services/rules/features/invisibilityService.js';
import * as fleetStepService from '../../services/rules/features/fleetStepService.js';

vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'TestFighter'),
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/combat/assertCanAct.js', () => ({
    assertCanAct: vi.fn(() => ({ allowed: true })),
}));
vi.mock('../../services/combat/lineOfSightGate.js', () => ({
    isLineOfSightEnforced: vi.fn(() => false),
    checkLineOfSight: vi.fn(() => Promise.resolve({ allowed: true })),
}));
vi.mock('../../services/combat/coverService.js', () => ({
    isCoverEnforced: vi.fn(() => false),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(() => null),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/fleetStepService.js', () => ({
    grantFleetStep: vi.fn(() => Promise.resolve()),
}));
// buffToggle / expirations / oncePerTurn are only touched by the confirm
// lane (covered elsewhere); stub them so the click lane stays isolated.
vi.mock('../../services/automation/common/buffToggle.js', () => ({ toggleBuff: vi.fn() }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'TestFighter';

const RECKLESS_FEATURE = {
    name: 'Reckless Attack',
    effect: 'advantage_attacks_advantage_against',
    trigger: 'first_attack_of_turn',
};
const BRUTAL_RIDER = {
    name: 'Brutal Strike',
    type: 'attack_rider',
    trigger: 'strength_attack_hit_after_reckless',
    damageExpression: '2d6',
    options: ['Forceful Blow', 'Hamstring Blow'],
    maxEffects: 2,
};

/** Per-test attack row fixture (fresh object, never shared mutable state). */
function makeAttack(overrides = {}) {
    return { name: 'Longsword', type: 'Action', hitBonus: 7, damage: '1d8+5', ...overrides };
}

/**
 * Runtime-store read stub with sensible defaults; override individual keys
 * instead of hand-rolling a switch in every test.
 */
function makeRuntimeStore(overrides = {}) {
    const store = {
        activeCreatureName: playerName,
        activeBuffs: [],
        targetEffects: [],
        '_recklessAttack_offeredThisTurn': null,
        '_BrutalStrike_usedRound': null,
        ...overrides,
    };
    return vi.fn((_charKey, key) => store[key]);
}

function createDeps(overrides = {}) {
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve({ hitBonus: 9 })),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: { name: playerName, level: 5, class: { name: 'Fighter' } },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

function lastModal(deps) {
    return deps.setModalState.mock.calls.at(-1)?.[0]?.recklessAttackModal;
}

describe('useCharActionsAttackHandlers — handleAttackClick', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-arm defaults so per-test overrides can never leak sideways.
        assertCanActModule.assertCanAct.mockReturnValue({ allowed: true });
        lineOfSightGate.isLineOfSightEnforced.mockReturnValue(false);
        coverService.isCoverEnforced.mockReturnValue(false);
        lineOfSightGate.checkLineOfSight.mockResolvedValue({ allowed: true });
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        fleetStepService.grantFleetStep.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('enforcement gates', () => {
        it('refuses a blocked attacker with zero side effects', () => {
            const deps = createDeps({ cannotAct: true });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(friendsService.endFriendsOnHostileAction).not.toHaveBeenCalled();
            expect(invisibilityService.endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });

        it('logs and pops a Stinking Cloud refusal when the attacker holds no_action_and_bonus_action', () => {
            const cloudTe = { target: playerName, effect: 'no_action_and_bonus_action' };
            const deps = createDeps({
                cannotAct: true,
                getRuntimeValue: makeRuntimeStore({ targetEffects: [cloudTe] }),
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack({ name: 'Longbow' }));

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation blocked',
                characterName: playerName,
                abilityName: 'Longbow',
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Stinking Cloud'));
            expect(deps.rollAttack).not.toHaveBeenCalled();
        });

        it('stays silent when blocked by something other than Stinking Cloud', () => {
            const deps = createDeps({
                cannotAct: true,
                getRuntimeValue: makeRuntimeStore({
                    targetEffects: [{ target: playerName, effect: 'stunned' }],
                }),
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('stops before rolling when the action economy denies the click', () => {
            assertCanActModule.assertCanAct.mockReturnValue({ allowed: false });
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            // A denied shot must not break invisible/Friends concentration.
            expect(friendsService.endFriendsOnHostileAction).not.toHaveBeenCalled();
            expect(invisibilityService.endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });

        it('charges the bonusAction bucket for Bonus Action rows and action otherwise', () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());
            expect(assertCanActModule.assertCanAct).toHaveBeenCalledWith(expect.objectContaining({
                creatureName: playerName,
                bucket: 'action',
                charge: true,
            }));

            handlers.handleAttackClick(makeAttack({ type: 'Bonus Action', name: 'Handaxe' }));
            expect(assertCanActModule.assertCanAct).toHaveBeenLastCalledWith(expect.objectContaining({
                bucket: 'bonusAction',
            }));
        });

        it('defers the roll to the line-of-sight consult when enforcement is on', async () => {
            lineOfSightGate.isLineOfSightEnforced.mockReturnValue(true);
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack({ range: '20/60' });

            handlers.handleAttackClick(attack);

            expect(lineOfSightGate.checkLineOfSight).toHaveBeenCalledWith(expect.objectContaining({
                campaignName,
                attackerName: playerName,
                targetName: 'Goblin',
                source: 'attack-row',
            }));
            expect(deps.rollAttack).not.toHaveBeenCalled();

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, expect.any(Object)));
        });

        it('never rolls a shot the line-of-sight consult denies', async () => {
            lineOfSightGate.isLineOfSightEnforced.mockReturnValue(true);
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            lineOfSightGate.checkLineOfSight.mockResolvedValue({ allowed: false });
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack({ range: '20/60' }));

            await vi.waitFor(() => expect(lineOfSightGate.checkLineOfSight).toHaveBeenCalled());
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(friendsService.endFriendsOnHostileAction).not.toHaveBeenCalled();
        });
    });

    describe('hostile-action commitments', () => {
        it('ends Friends and Invisibility when the click commits to an attack', () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(friendsService.endFriendsOnHostileAction).toHaveBeenCalledWith(playerName, campaignName);
            expect(invisibilityService.endInvisibilityOnHostileAction).toHaveBeenCalledWith(playerName, campaignName);
        });

        it('reads the runtime store scoped to this campaign', () => {
            const getRuntimeValue = makeRuntimeStore();
            const deps = createDeps({ getRuntimeValue });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(getRuntimeValue).toHaveBeenCalledWith(playerName, 'activeBuffs', campaignName);
        });
    });

    describe('Reckless / Brutal Strike chooser', () => {
        it('opens the full chooser once when reckless is owed on the turn', () => {
            const attack = makeAttack();
            const deps = createDeps({ specialActions: [RECKLESS_FEATURE] });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(attack);

            expect(lastModal(deps)).toEqual(expect.objectContaining({
                attack,
                mode: 'full',
                hasBrutalStrike: false,
                brutalStrikeOptions: [],
                riderName: 'Brutal Strike',
            }));
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
        });

        it('does not re-offer the chooser once the current creature has been offered', async () => {
            const deps = createDeps({
                specialActions: [RECKLESS_FEATURE],
                getRuntimeValue: makeRuntimeStore({
                    '_recklessAttack_offeredThisTurn': { activeCreature: playerName },
                }),
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(deps.setModalState).not.toHaveBeenCalled();
            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, expect.any(Object)));
        });

        it('still offers the chooser when the offered latch belongs to another creature', () => {
            const deps = createDeps({
                specialActions: [RECKLESS_FEATURE],
                getRuntimeValue: makeRuntimeStore({
                    '_recklessAttack_offeredThisTurn': { activeCreature: 'OtherCreature' },
                }),
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(lastModal(deps)).toMatchObject({ mode: 'full' });
        });

        it('opens the brutalOnly chooser with the selected rider payload when reckless is active', () => {
            const attack = makeAttack();
            const deps = createDeps({
                specialActions: [RECKLESS_FEATURE],
                passives: [BRUTAL_RIDER],
                getRuntimeValue: makeRuntimeStore({
                    activeBuffs: [{ effect: 'advantage_attacks_advantage_against' }],
                    '_recklessAttack_offeredThisTurn': { activeCreature: playerName },
                }),
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(attack);

            expect(lastModal(deps)).toEqual(expect.objectContaining({
                attack,
                mode: 'brutalOnly',
                hasBrutalStrike: true,
                brutalStrikeOptions: ['Forceful Blow', 'Hamstring Blow'],
                maxEffects: 2,
                riderName: 'Brutal Strike',
            }));
            expect(deps.buildCtx).not.toHaveBeenCalled();
        });

        it('rolls straight through when there is no reckless feature', async () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(deps.setModalState).not.toHaveBeenCalled();
            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, expect.any(Object)));
        });

        it.each([
            ['missing passives', { passives: undefined }],
            ['missing specialActions', { specialActions: undefined }],
        ])('rolls through without crashing on %s', async (_label, overrides) => {
            const deps = createDeps(overrides);
            const handlers = useCharActionsAttackHandlers(deps);

            expect(() => handlers.handleAttackClick(makeAttack())).not.toThrow();
            expect(deps.setModalState).not.toHaveBeenCalled();
            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, expect.any(Object)));
        });
    });

    describe('attack roll resolution', () => {
        it.each([
            ['ctx.hitBonus wins over the row value', { hitBonus: 10 }, 10],
            ['ctx without hitBonus falls back to the row', {}, 7],
            ['null ctx falls back to the row', null, 7],
        ])('%s', async (_label, ctx, expected) => {
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', expected, ctx));
        });

        it('rolls with the row hit bonus when buildCtx resolves undefined', async () => {
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(undefined)) });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 7, undefined));
        });

        it('subtracts the exhaustion penalty from the effective hit bonus', async () => {
            const deps = createDeps({
                buildCtx: vi.fn(() => Promise.resolve({ hitBonus: 6 })),
                exhaustionPenalty: 2,
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 4, expect.any(Object)));
        });

        it('logs the error and rolls nothing when buildCtx rejects', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.reject(new Error('build failed'))) });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error)));
            expect(deps.rollAttack).not.toHaveBeenCalled();
        });
    });
});
