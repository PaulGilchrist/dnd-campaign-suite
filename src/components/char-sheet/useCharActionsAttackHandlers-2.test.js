// @maintained-by-ai
// Terminal chooser handlers (confirm/cancel) of useCharActionsAttackHandlers —
// the modal-resolved half of the attack lane: buff arming, sticky arm/clear
// safety (CLA-044), once-per-turn spend, logs, and the terminal roll through
// buildCtx.
// Scope note: the handleAttackClick lane (enforcement gates, chooser opening,
// hostile-action commitments) is owned by useCharActionsAttackHandlers.test.js;
// the CLA-044 chooser gate by .brutalGate.test.js; rider selection & log
// naming by .improvedBrutalStrike.test.js; CLA-143 / CLA-274 / CLA-405 latch
// lanes by .cla143-stamp / .psychicBlade / .fleetStep suites; modal component
// wiring by the CharActionModals suites — none of those are re-tested here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

// Only the services this lane actually calls are mocked.
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'TestFighter'),
    // Non-1 sentinel: the offered-latch stamp must read the CANONICAL round
    // (getCurrentCombatRound), never a hardcoded round (pass #322 — the stamp
    // used to pin round: 1, stale-by-design on round 7).
    getCurrentCombatRound: vi.fn(() => 7),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    markOncePerTurn: vi.fn(() => Promise.resolve({ round: 1, activeCreature: 'TestFighter' })),
}));

// Mock hygiene: the old vi.mock('../../hooks/runtime/useRuntimeState.js') was
// dead — this hook never imports it. assertCanAct, lineOfSightGate,
// coverService, damageUtils, brutalStrikeSelection, fleetStepService,
// friendsService and invisibilityService are deliberately NOT mocked: they are
// imported by the source, have no import-time side effects, and are only
// invoked from the handleAttackClick lane (owned by the base suite) — this
// lane never calls them.

import * as buffToggle from '../../services/automation/common/buffToggle.js';
import * as combatData from '../../services/encounters/combatData.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as logService from '../../services/ui/logService.js';
import * as oncePerTurn from '../../services/automation/common/oncePerTurn.js';

const campaignName = 'test-campaign';
const playerName = 'TestFighter';

/** Per-test attack row fixture (fresh object, never shared mutable state). */
function makeAttack(overrides = {}) {
    return { name: 'Longsword', hitBonus: 7, ...overrides };
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

const playerStats = () => ({ name: playerName, level: 5, class: { name: 'Fighter' } });

// Every roll through these terminal lanes subtracts the exhaustion penalty
// (4 duplicated sites in the source), so the defaults pin the subtraction on
// every happy path: hitBonus 8 − penalty 2 → roll 6, byte-exact.
function createDeps(overrides = {}) {
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve({ hitBonus: 8 })),
        rollAttack: vi.fn(),
        exhaustionPenalty: 2,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: playerStats(),
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

/** setRuntimeValue calls that wrote the given key. */
function writesTo(deps, key) {
    return deps.setRuntimeValue.mock.calls.filter(c => c[1] === key);
}

describe('useCharActionsAttackHandlers — chooser terminal handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleRecklessAttackConfirm', () => {
        it('arms Reckless Attack, logs it, schedules its expiry, appends the reckless_attack targetEffect, stamps the offered latch and rolls at the exhaustion penalty', async () => {
            const ctx = { hitBonus: 8 };
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();

            handlers.handleRecklessAttackConfirm(attack, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                playerName,
                'Reckless Attack',
                { effect: 'advantage_attacks_advantage_against', duration: 'until_start_of_next_turn' },
                campaignName,
                playerName
            );
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Reckless Attack',
                description: `${playerName} uses Reckless Attack, granting advantage on the first attack roll on this turn`,
            });
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: playerName,
                targetName: playerName,
                effects: [{ type: 'remove_active_buff', buffName: 'Reckless Attack' }],
                campaignName,
                rounds: undefined,
                expireOnCreatureName: playerName,
            });
            // Empty store ⇒ exactly one appended entry, byte-exact payload.
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: playerName, source: playerName, effect: 'reckless_attack', duration: 'until_start_of_next_turn' },
            ], campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_recklessAttack_offeredThisTurn',
                { round: 7, activeCreature: playerName },
                campaignName
            );
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            // No brutal strike requested ⇒ zero sticky writes (positive leg pinned below).
            expect(writesTo(deps, '_brutalStrikeActive')).toEqual([]);
            expect(writesTo(deps, '_brutalStrikeEffects')).toEqual([]);
            expect(writesTo(deps, '_brutalStrikeNoAdvantage')).toEqual([]);

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith(attack.name, 6, ctx));
        });

        it('does not duplicate the reckless_attack targetEffect when it is already stored, but still completes the lane', async () => {
            const existing = { target: playerName, source: playerName, effect: 'reckless_attack', duration: 'until_start_of_next_turn' };
            const deps = createDeps({ getRuntimeValue: makeRuntimeStore({ targetEffects: [existing] }) });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleRecklessAttackConfirm(makeAttack(), null);

            expect(writesTo(deps, 'targetEffects')).toEqual([]);
            expect(buffToggle.toggleBuff).toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Longsword', 6, { hitBonus: 8 }));
        });

        it('with a Brutal Strike choice: arms the sticky, spends once-per-turn, logs both abilities, rolls, then clears noAdvantage and the sticky in finally', async () => {
            const ctx = { hitBonus: 8 };
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();
            const choice = { useBrutalStrike: true, effectChoices: ['Forceful Blow', 'Hamstring Blow'] };

            handlers.handleRecklessAttackConfirm(attack, choice);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', true, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', choice.effectChoices, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeNoAdvantage', true, campaignName);
            expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Brutal Strike', '_BrutalStrike_usedRound', deps.playerStats, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Brutal Strike',
                description: `${playerName} uses Brutal Strike on Longsword — Forceful Blow + Hamstring Blow`,
            });

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith(attack.name, 6, ctx));
            await vi.waitFor(() => {
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeNoAdvantage', null, campaignName);
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName);
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', null, campaignName);
            });
        });

        it('clears noAdvantage and the sticky even when buildCtx rejects, and never rolls', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const err = new Error('build failed');
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.reject(err)) });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();

            handlers.handleRecklessAttackConfirm(attack, { useBrutalStrike: true, effectChoices: ['Forceful Blow'] });

            await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', err));
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeNoAdvantage', null, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName);
        });
    });

    describe('handleRecklessAttackCancel', () => {
        it('stamps the offered latch, closes the chooser, and rolls the plain attack without granting Reckless advantage', async () => {
            const ctx = { hitBonus: 8 };
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();

            handlers.handleRecklessAttackCancel(attack);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                '_recklessAttack_offeredThisTurn',
                { round: 7, activeCreature: playerName },
                campaignName
            );
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            // A cancelled offer must never arm the buff or its expiry.
            expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith(attack.name, 6, ctx));
        });

        it('stamps the CANONICAL round on the offered latch — round-7 press stamps 7, round-reset (new initiative) stamps 1 (#1348)', async () => {
            // Default mock is round 7 (see combatData mock above): a confirm
            // here proves the stamp tracks getCurrentCombatRound, not a
            // hardcoded round: 1 (pass #322 defect).
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleRecklessAttackConfirm(makeAttack(), null);

            expect(combatData.getCurrentCombatRound).toHaveBeenCalledWith(campaignName);
            expect(writesTo(deps, '_recklessAttack_offeredThisTurn')).toEqual([
                [playerName, '_recklessAttack_offeredThisTurn', { round: 7, activeCreature: playerName }, campaignName],
            ]);

            // Round reset: new initiative rolls round 1 — the stamp follows.
            combatData.getCurrentCombatRound.mockReturnValueOnce(1);
            handlers.handleRecklessAttackCancel(makeAttack());

            expect(writesTo(deps, '_recklessAttack_offeredThisTurn')[1]).toEqual([
                playerName, '_recklessAttack_offeredThisTurn', { round: 1, activeCreature: playerName }, campaignName,
            ]);
        });
    });

    describe('buildCtx rejection on the cancel lane', () => {
        it.each([
            ['handleRecklessAttackCancel', (h, a) => h.handleRecklessAttackCancel(a)],
            ['handleBrutalStrikeCancel', (h, a) => h.handleBrutalStrikeCancel(a)],
        ])('%s logs the error and rolls nothing', async (_label, invoke) => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const err = new Error('build failed');
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.reject(err)) });
            const handlers = useCharActionsAttackHandlers(deps);

            invoke(handlers, makeAttack());

            await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', err));
            expect(deps.rollAttack).not.toHaveBeenCalled();
        });
    });

    describe('handleBrutalStrikeConfirm', () => {
        it('arms the sticky, spends once-per-turn, logs the rider, rolls at the exhaustion penalty, then clears the sticky in finally', async () => {
            const ctx = { hitBonus: 8 };
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();
            const choice = { useBrutalStrike: true, effectChoices: ['Forceful Blow', 'Hamstring Blow'] };

            handlers.handleBrutalStrikeConfirm(choice, attack);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', true, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', choice.effectChoices, campaignName);
            expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Brutal Strike', '_BrutalStrike_usedRound', deps.playerStats, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Brutal Strike',
                description: `${playerName} uses Brutal Strike on Longsword — Forceful Blow + Hamstring Blow`,
            });
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith(attack.name, 6, ctx));
            // CLA-044 sticky safety: whatever survives the settled lane is stale.
            await vi.waitFor(() => {
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName);
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', null, campaignName);
            });
        });

        it.each([
            ['declined choice', { useBrutalStrike: false, effectChoices: ['ignored'] }],
            ['null choice', null],
        ])('%s: nothing armed or spent, chooser closes, attack still rolls', async (_label, choice) => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();

            handlers.handleBrutalStrikeConfirm(choice, attack);

            expect(writesTo(deps, '_brutalStrikeActive')).toEqual([]);
            expect(writesTo(deps, '_brutalStrikeEffects')).toEqual([]);
            expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith(attack.name, 6, { hitBonus: 8 }));
        });

        it('refuses to arm the sticky when no attack is threaded — loud refusal, chooser closed, no buildCtx, no roll', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleBrutalStrikeConfirm({ useBrutalStrike: true, effectChoices: ['Forceful Blow'] }, null);

            expect(consoleErrorSpy).toHaveBeenCalledWith('[useCharActionsAttackHandlers] brutalOnly confirm without attack — not arming sticky');
            expect(writesTo(deps, '_brutalStrikeActive')).toEqual([]);
            expect(writesTo(deps, '_brutalStrikeEffects')).toEqual([]);
            expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
            // The attack-null guard fires on `!attack` alone — a declined
            // choice with a null attack takes the identical branch, so it is
            // not a distinct case.
        });

        it('clears the sticky when buildCtx rejects so it cannot ride a later attack, and never rolls', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.reject(new Error('build failed'))) });
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleBrutalStrikeConfirm({ useBrutalStrike: true, effectChoices: ['Forceful Blow'] }, makeAttack());

            await vi.waitFor(() => expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName));
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', null, campaignName);
            expect(deps.rollAttack).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
        });
    });

    describe('handleBrutalStrikeCancel', () => {
        it('clears the sticky, closes the chooser, and rolls the plain attack without arming anything', async () => {
            const ctx = { hitBonus: 8 };
            const deps = createDeps({ buildCtx: vi.fn(() => Promise.resolve(ctx)) });
            const handlers = useCharActionsAttackHandlers(deps);
            const attack = makeAttack();

            handlers.handleBrutalStrikeCancel(attack);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', null, campaignName);
            expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });

            await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith(attack.name, 6, ctx));
        });

        it('still clears the sticky and closes the chooser on a null attack, without touching buildCtx', () => {
            const deps = createDeps();
            const handlers = useCharActionsAttackHandlers(deps);

            handlers.handleBrutalStrikeCancel(null);

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeActive', null, campaignName);
            expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_brutalStrikeEffects', null, campaignName);
            expect(deps.setModalState).toHaveBeenCalledWith({ recklessAttackModal: null });
            expect(deps.buildCtx).not.toHaveBeenCalled();
            expect(deps.rollAttack).not.toHaveBeenCalled();
        });
    });
});
