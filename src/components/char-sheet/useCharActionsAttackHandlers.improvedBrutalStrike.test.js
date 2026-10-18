// @maintained-by-ai
// CLA-182 Improved Brutal Strike lane: the two hook-side seams the selection
// service suite does NOT cover — (1) a handleAttackClick with lv9+lv13 riders
// tied on dice count opens the chooser with the IMPROVED rider's payload
// byte-exact (selectBrutalStrikeRiders runs REAL here — the lv9→lv13
// promotion is the behavior under test; sort semantics belong to
// brutalStrikeSelection.test.js), and (2) the terminal confirms name the
// rider from the chooser's choice payload — the CUSTOM riderName branch of
// `riderName || 'Brutal Strike'` (source :256/:311).
// Scope note: the default 'Brutal Strike' fallback log is owned by
// useCharActionsAttackHandlers-2.test.js (it passes riderName-less choices
// and pins the full sticky/spend/roll/finally lane); CLA-044 gate semantics
// by .brutalGate.test.js; chooser dispatch shape and roll resolution by
// .test.js; round stamps and fleet-step by .cla143-stamp/.fleetStep —
// none of those are re-tested here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

// Mock hygiene (mirrors cla143-stamp): the useRuntimeState automock is
// transitively live — the deliberately UNMOCKED assertCanAct, lineOfSightGate,
// coverService and fleetStepService all import it, and the automock keeps
// their store reads inert so the enforcement fast-path stays off on the
// click lane. buffToggle/expirations/oncePerTurn run only in the full-mode
// confirm case; friends/invisibility run on every committed click
// (source:113-114) — mocked so the lane has no real side effects.
// oncePerTurn returns a Promise: the source .catch()es its return value.
vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'DraconicDragon'),
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
    markOncePerTurn: vi.fn(() => Promise.resolve({ round: 1, activeCreature: 'DraconicDragon' })),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

const logService = await import('../../services/ui/logService.js');

const campaignName = 'test-campaign';
const playerName = 'DraconicDragon';

/** Fresh attack row per test — never shared mutable state. */
function makeAttack(overrides = {}) {
    return { name: 'Longsword', hitBonus: 8, ...overrides };
}

const RECKLESS_FEATURE = {
    name: 'Reckless Attack',
    effect: 'advantage_attacks_advantage_against',
    trigger: 'first_attack_of_turn',
};

// CLA-182 fixtures: both riders tie on 1d10 — featureLevel must promote the
// lv13 rider to the top of the offer with its full four-option list.
const lv9Rider = {
    type: 'attack_rider',
    name: 'Brutal Strike',
    featureLevel: 9,
    damageExpression: '1d10',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
    ],
};

const lv13Rider = {
    type: 'attack_rider',
    name: 'Improved Brutal Strike',
    featureLevel: 13,
    damageExpression: '1d10',
    trigger: 'strength_attack_hit_after_reckless',
    options: [
        { name: 'Forceful Blow', effect: 'push_15ft' },
        { name: 'Hamstring Blow', effect: 'speed_reduction' },
        { name: 'Staggering Blow', effect: 'disadvantage_on_next_save', noOpportunityAttacks: true },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
    ],
};

/** Runtime-store read stub; key-based so tests never hand-roll a switch.
 *  Defaults make reckless OWED so the click reaches the chooser. */
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
        buildCtx: vi.fn(() => Promise.resolve({})),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [RECKLESS_FEATURE],
        passives: [],
        playerStats: { name: playerName, level: 13 },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('CLA-182: Improved Brutal Strike selection → chooser payload & log naming', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens the full chooser byte-exactly with the promoted lv13 rider when it ties lv9 on dice count', () => {
        const deps = createDeps({ passives: [lv9Rider, lv13Rider] });
        const attack = makeAttack();

        useCharActionsAttackHandlers(deps).handleAttackClick(attack);

        // Positive leg: the chooser opened exactly once with the IMPROVED
        // rider's full offer — all four options, maxEffects falling back to 1.
        expect(deps.setModalState).toHaveBeenCalledTimes(1);
        expect(deps.setModalState).toHaveBeenCalledWith({
            recklessAttackModal: {
                attack,
                mode: 'full',
                hasBrutalStrike: true,
                brutalStrikeOptions: lv13Rider.options,
                maxEffects: 1,
                riderName: 'Improved Brutal Strike',
            },
        });
        expect(deps.buildCtx).not.toHaveBeenCalled();
        expect(deps.rollAttack).not.toHaveBeenCalled();
    });

    // The riderName naming branch is duplicated at source :256 (full chooser)
    // and :311 (brutalOnly chooser) — one it.each pins both. The choice
    // payload carries exactly the riderName the chooser above stamped.
    it.each([
        ['full chooser (handleRecklessAttackConfirm)', (h, attack, choice) => h.handleRecklessAttackConfirm(attack, choice)],
        ['brutalOnly chooser (handleBrutalStrikeConfirm)', (h, attack, choice) => h.handleBrutalStrikeConfirm(choice, attack)],
    ])('%s names the improved rider byte-exactly in its ability_use log', (_label, invoke) => {
        const deps = createDeps();
        const attack = makeAttack();

        invoke(useCharActionsAttackHandlers(deps), attack, {
            useBrutalStrike: true,
            effectChoices: ['Staggering Blow'],
            riderName: 'Improved Brutal Strike',
        });

        // addEntry fires synchronously inside the confirm — no await ladder.
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Improved Brutal Strike',
            description: `${playerName} uses Improved Brutal Strike on Longsword — Staggering Blow`,
        });
    });
});
