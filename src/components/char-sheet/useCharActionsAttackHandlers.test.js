// @maintained-by-ai 2026-11-27
// Unit tests for the handleAttackClick press lane of useCharActionsAttackHandlers.
// Scope note: confirm/cancel chooser handlers are covered by
// useCharActionsAttackHandlers-2.test.js and .brutalGate.test.js; CLA-143 /
// CLA-274 / CLA-405 latch lanes by the cla143-stamp / psychicBlade /
// fleetStep suites; rider selection & sorting by .improvedBrutalStrike.test.js;
// the no-target refusal face by .no-target-refusal.test.js; the Extra Attack
// chain seam + exhaustion subtraction (rollWeaponSwing penalty) by
// .extraAttack.test.js — this file deliberately does not re-test those.
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
import * as oncePerTurnService from '../../services/automation/common/oncePerTurn.js';

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

/**
 * Deterministically drain the real promise chain (press → runAttackClick →
 * stageAttackRoll → buildCtx().then → rollAttack, plus the extra LoS-consult
 * tick). No wall-clock polling: roll resolution is turn-seam state.
 */
async function flushRoll() {
    for (let i = 0; i < 6; i++) await Promise.resolve();
}

describe('useCharActionsAttackHandlers — handleAttackClick', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-arm defaults so per-test overrides can never leak sideways
        // (clearAllMocks alone keeps mockReturnValue — re-baseline every stub).
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

            // Full zero-silence contract: every channel the press could
            // touch stays untouched (the popup face belongs to assertCanAct).
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(lineOfSightGate.checkLineOfSight).not.toHaveBeenCalled();
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

            // Exact log row + byte-exact popup copy (the hook lane is the
            // only owner of this refusal face).
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation blocked',
                characterName: playerName,
                abilityName: 'Longbow',
                description: `${playerName} is Poisoned by Stinking Cloud and can't take an Action or Bonus Action — attack refused.`,
                timestamp: expect.any(Number),
            });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('<b>Stinking Cloud</b><br/>You are Poisoned by Stinking Cloud and can\'t take an Action or a Bonus Action until the end of your current turn.<br/><span class="dice-roll-hint">click to dismiss</span>');
            // Zero spend: nothing rolled, stamped, or chooser-opened.
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
        });

        it('routes a non-cloud cannotAct press through the assertCanAct popup lane (RB-1115)', () => {
            const deps = createDeps({
                cannotAct: true,
                getRuntimeValue: makeRuntimeStore({
                    targetEffects: [{ target: playerName, effect: 'stunned' }],
                }),
            });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(logService.addEntry).not.toHaveBeenCalled();
            // RB-1115: the non-cloud cannotAct face no longer returns silently —
            // it feeds cannotAct + the popup sink into assertCanAct (the shared
            // lane renders the canTakeAction copy; asserted in assertCanAct.test.js).
            // Exact args pin the REFUSAL shape: no charge key — a denied press
            // must never spend the action bucket.
            expect(assertCanActModule.assertCanAct).toHaveBeenCalledTimes(1);
            expect(assertCanActModule.assertCanAct).toHaveBeenCalledWith({
                campaignName,
                creatureName: playerName,
                bucket: 'action',
                cannotAct: true,
                setPopupHtml: deps.setPopupHtml,
                source: 'useCharActionsAttackHandlers',
            });
        });

        it('stops before rolling when the action economy denies the click', () => {
            assertCanActModule.assertCanAct.mockReturnValue({ allowed: false });
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            // A denied shot must not break invisible/Friends concentration.
            expect(friendsService.endFriendsOnHostileAction).not.toHaveBeenCalled();
            expect(invisibilityService.endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });

        it('charges the action bucket for weapon rows, bonusAction for Bonus Action rows (ordered census)', () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());
            handlers.handleAttackClick(makeAttack({ type: 'Bonus Action', name: 'Handaxe' }));

            // Charge-on-allow with exact first-call args (feedCannotAct +
            // source + charge present — contrast the refusal lane above).
            expect(assertCanActModule.assertCanAct).toHaveBeenCalledTimes(2);
            expect(assertCanActModule.assertCanAct).toHaveBeenNthCalledWith(1, {
                campaignName,
                creatureName: playerName,
                bucket: 'action',
                cannotAct: false,
                setPopupHtml: deps.setPopupHtml,
                source: 'useCharActionsAttackHandlers',
                charge: true,
            });
            expect(assertCanActModule.assertCanAct.mock.calls.map(([arg]) => arg.bucket))
                .toEqual(['action', 'bonusAction']);
        });

        it('defers the roll to the line-of-sight consult when enforcement is on', async () => {
            lineOfSightGate.isLineOfSightEnforced.mockReturnValue(true);
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack({ range: '20/60' }));

            // Synchronous facts first: consult fires with the sheet-arm args and
            // the whole continuation (gate, stamps, roll) waits on its verdict.
            expect(lineOfSightGate.checkLineOfSight).toHaveBeenCalledWith({
                campaignName,
                attackerName: playerName,
                targetName: 'Goblin',
                range: '20/60',
                setPopupHtml: deps.setPopupHtml,
                source: 'attack-row',
            });
            expect(assertCanActModule.assertCanAct).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();

            await flushRoll();
            expect(assertCanActModule.assertCanAct).toHaveBeenCalledTimes(1);
            expect(deps.rollAttack).toHaveBeenCalledTimes(1);
            expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, { hitBonus: 9 });
        });

        it('never rolls a shot the line-of-sight consult denies, and charges no slot', async () => {
            lineOfSightGate.isLineOfSightEnforced.mockReturnValue(true);
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            lineOfSightGate.checkLineOfSight.mockResolvedValue({ allowed: false });
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack({ range: '20/60' }));

            await flushRoll();
            // L5-003 §7.2 semantics: the denial lands BEFORE assertCanAct, so
            // a blocked shot never charges its slot or stamps anything.
            expect(lineOfSightGate.checkLineOfSight).toHaveBeenCalledTimes(1);
            expect(assertCanActModule.assertCanAct).not.toHaveBeenCalled();
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
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
            // CLA-044: the offered-latch creature comparison reads
            // activeCreatureName top-level (campaign-scoped), not the cs mirror.
            expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'activeCreatureName', campaignName);
        });
    });

    describe('Reckless / Brutal Strike chooser', () => {
        it('opens the full chooser once when reckless is owed on the turn', () => {
            const attack = makeAttack();
            const deps = createDeps({ specialActions: [RECKLESS_FEATURE] });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(attack);

            // Exact envelope: with no riders the offer defaults are
            // maxEffects 1 / riderName 'Brutal Strike'.
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(lastModal(deps)).toEqual({
                attack,
                mode: 'full',
                hasBrutalStrike: false,
                brutalStrikeOptions: [],
                maxEffects: 1,
                riderName: 'Brutal Strike',
            });
            // The chooser consumes the click before any roll.
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
            await flushRoll();
            expect(deps.rollAttack).toHaveBeenCalledTimes(1);
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

            expect(deps.setModalState).toHaveBeenCalledTimes(1);
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

            // Sharpened from objectContaining (fix#246 fold, fix#274 seam
            // standard): exact envelope + zero-side-effect counts, but kept as
            // the base lane's OWN route-level proof — this is the only lane that
            // arms the brutalOnly setModalState (source :267) through the REAL
            // selectBrutalStrikeRiders with a string-options rider (brutalGate
            // mocks the selector; improvedBrutalStrike runs it real only on the
            // 'full' route). Gate latch semantics belong to .brutalGate.test.js
            // — not re-proved here.
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({
                recklessAttackModal: {
                    attack,
                    mode: 'brutalOnly',
                    hasBrutalStrike: true,
                    brutalStrikeOptions: ['Forceful Blow', 'Hamstring Blow'],
                    maxEffects: 2,
                    riderName: 'Brutal Strike',
                },
            });
            // The armed chooser consumes the click before any roll: no ctx build,
            // no roll, no refusal log, no once-per-turn spend.
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(oncePerTurnService.markOncePerTurn).not.toHaveBeenCalled();
            // The one permitted write on this route is the CLA-143 round stamp.
            expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_attackActionTakenRound', 1, campaignName);
        });

        it('rolls straight through when there is no reckless feature', async () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            expect(deps.setModalState).not.toHaveBeenCalled();
            await flushRoll();
            // Distinctive values: ctx hitBonus 9 vs row hitBonus 7 — a
            // hardcoded row bonus dies here, so the roll-resolution lane below
            // only needs the ctx-fallback leg.
            expect(deps.rollAttack).toHaveBeenCalledTimes(1);
            expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, { hitBonus: 9 });
        });

        it.each([
            ['missing passives', { passives: undefined }],
            ['missing specialActions', { specialActions: undefined }],
        ])('rolls through without crashing on %s', async (_label, overrides) => {
            const deps = createDeps(overrides);
            const handlers = useCharActionsAttackHandlers(deps);

            expect(() => handlers.handleAttackClick(makeAttack())).not.toThrow();
            expect(deps.setModalState).not.toHaveBeenCalled();
            await flushRoll();
            expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 9, { hitBonus: 9 });
        });
    });

    describe('attack roll resolution (via real rollWeaponSwing)', () => {
        it.each([
            ['ctx without hitBonus', {}],
            ['null ctx', null],
            ['undefined ctx', undefined],
        ])('falls back to the row hit bonus when %s', async (_label, ctx) => {
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleAttackClick(makeAttack());

            await flushRoll();
            expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 7, ctx);
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
