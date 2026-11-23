// @maintained-by-ai
// Regression pins for bug-extra-attack-display-only-never-rolls (press half):
// every allowed press that reaches the roll step registers the Extra Attack
// chain EXACTLY once via stageAttackRoll (the seam all five press
// continuation sites share), while the press itself still rolls exactly one
// attack synchronously — remaining swings are staged by useExtraAttackChain
// on popup drain. Refused presses (no-target, enforcement denial, chooser
// deferral) never touch the seam before their continuation resolves.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

import * as assertCanActModule from '../../services/combat/assertCanAct.js';
import * as lineOfSightGate from '../../services/combat/lineOfSightGate.js';
import * as coverService from '../../services/combat/coverService.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
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
vi.mock('../../services/combat/noTargetRefusal.js', () => ({
    refuseUnarmedAttackPress: vi.fn(() => false),
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
vi.mock('../../services/automation/common/buffToggle.js', () => ({ toggleBuff: vi.fn() }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'TestFighter';

function makeAttack(overrides = {}) {
    return {
        name: 'Longsword',
        type: 'Action',
        weaponType: 'melee',
        hitBonus: 7,
        damage: '1d8+5',
        ...overrides,
    };
}

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
        exhaustionPenalty: 2,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: { name: playerName, level: 6, class: { name: 'Fighter' } },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        beginExtraAttackChain: vi.fn(),
        ...overrides,
    };
}

describe('useCharActionsAttackHandlers — Extra Attack chain seam', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        assertCanActModule.assertCanAct.mockReturnValue({ allowed: true });
        lineOfSightGate.isLineOfSightEnforced.mockReturnValue(false);
        coverService.isCoverEnforced.mockReturnValue(false);
        lineOfSightGate.checkLineOfSight.mockResolvedValue({ allowed: true });
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        fleetStepService.grantFleetStep.mockResolvedValue(undefined);
    });

    it('an allowed press registers the chain once and still rolls exactly one swing (minus exhaustion)', async () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);
        const attack = makeAttack();

        handlers.handleAttackClick(attack);
        await Promise.resolve();
        await Promise.resolve();

        expect(deps.beginExtraAttackChain).toHaveBeenCalledTimes(1);
        expect(deps.beginExtraAttackChain).toHaveBeenCalledWith(attack);
        expect(deps.rollAttack).toHaveBeenCalledTimes(1);
        expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 7, { hitBonus: 9 });
    });

    it('a press denied by the action-economy gate registers no chain and rolls nothing', () => {
        assertCanActModule.assertCanAct.mockReturnValue({ allowed: false });
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(makeAttack());

        expect(deps.beginExtraAttackChain).not.toHaveBeenCalled();
        expect(deps.rollAttack).not.toHaveBeenCalled();
    });

    it('a chooser-deferred press registers the chain only on the confirm continuation', async () => {
        const deps = createDeps({
            specialActions: [{
                name: 'Reckless Attack',
                effect: 'advantage_attacks_advantage_against',
                trigger: 'first_attack_of_turn',
            }],
        });
        const handlers = useCharActionsAttackHandlers(deps);
        const attack = makeAttack();

        handlers.handleAttackClick(attack);
        expect(deps.beginExtraAttackChain).not.toHaveBeenCalled();
        expect(deps.rollAttack).not.toHaveBeenCalled();

        handlers.handleRecklessAttackConfirm(attack, {});
        await Promise.resolve();
        await Promise.resolve();
        expect(deps.beginExtraAttackChain).toHaveBeenCalledTimes(1);
        expect(deps.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('the chooser cancel continuation also registers the chain (same action, still multi-attack)', async () => {
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);
        const attack = makeAttack();

        handlers.handleRecklessAttackCancel(attack);
        await Promise.resolve();
        await Promise.resolve();
        expect(deps.beginExtraAttackChain).toHaveBeenCalledTimes(1);
        expect(deps.rollAttack).toHaveBeenCalledTimes(1);
    });

    it('presses proceed unchanged when no chain watcher is wired (standalone host)', async () => {
        const deps = createDeps({ beginExtraAttackChain: undefined });
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(makeAttack());
        await Promise.resolve();
        await Promise.resolve();
        expect(deps.rollAttack).toHaveBeenCalledTimes(1);
    });
});
