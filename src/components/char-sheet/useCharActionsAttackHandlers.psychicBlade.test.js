// @maintained-by-ai
// CLA-274 Psychic Blades second-blade action-economy gating (attack-row owner):
// pins the gatePsychicBladeAttack seam in useCharActionsAttackHandlers.js — the
// Attack-action blade row stamps `_PsychicBlade_attack_round`; the second-blade
// Bonus Action row is armed only by a same-round blade attack and consumed once
// per round (round-keyed latch re-arms at round wrap, CLA-109/CLA-273 pattern).
// Byte-exact refusal popups distinguish the two deny branches — BOTH copies
// contain the word "manifest", so stringContaining cannot tell them apart.
// Zero store writes on refusal is pinned because the gate short-circuits before
// the CLA-143/FT-036 stamp blocks. Row build is owned by attackCalc2024*.test.js;
// the _attackActionTakenRound / _bonusActionAttackRound writes by
// .cla143-stamp.test.js; grantFleetStep by .fleetStep.test.js; the Reckless
// chooser and roll-resolution lanes by .test.js — none re-pinned here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';

// Mock hygiene: the useRuntimeState automock is transitively live — this hook
// never imports it directly, but the deliberately UNMOCKED assertCanAct,
// lineOfSightGate, coverService and fleetStepService all do, and the automock
// keeps their store reads inert (enforcement fast-path stays off; the real
// grantFleetStep short-circuits on the non-Monk playerStats below, and the
// real selectBrutalStrikeRiders is pure and empty-passives-safe).
vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'AasimarTest'),
    getCurrentCombatRound: vi.fn(() => 3),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));
// buffToggle / expirations / oncePerTurn mocks purged: those collaborators run
// only in the confirm lane (-2.test.js / .brutalGate.test.js), never on
// handleAttackClick, and their real modules load inertly against the same
// useRuntimeState automock above.

const campaignName = 'test-campaign';
const playerName = 'AasimarTest';

// buildCtx's resolved context — identity-pinned on the rollAttack args.
const CTX = { hitBonus: 7 };

// Byte-exact refusal copies (source gatePsychicBladeAttack) — exactness is what
// separates the two deny branches ("manifest" appears in both).
const POPUP_MANIFEST = '<b>Psychic Blade</b><br/>Your Psychic Blades manifest when you take the Attack action or make an Opportunity Attack. Attack with your manifested blade before making the second-blade bonus attack.<br/><span class="dice-roll-hint">click to dismiss</span>';
const POPUP_SPENT = '<b>Psychic Blade</b><br/>You have already attacked with your second psychic blade this turn. The blade vanishes after the attack — manifest a new one with the Attack action on your next turn.<br/><span class="dice-roll-hint">click to dismiss</span>';

/** Runtime-store read stub; key-based so tests never hand-roll a switch. */
function makeRuntimeStore(overrides = {}) {
    const store = {
        activeCreatureName: playerName,
        activeBuffs: [],
        targetEffects: [],
        '_recklessAttack_offeredThisTurn': null,
        '_BrutalStrike_usedRound': null,
        '_PsychicBlade_attack_round': null,
        '_PsychicBlade_secondBlade_round': null,
        ...overrides,
    };
    return vi.fn((_charKey, key) => store[key]);
}

function createDeps(overrides = {}) {
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve(CTX)),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: { name: playerName, level: 14, class: { name: 'Rogue' } },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

/** Fresh blade rows per test — never shared mutable state. */
function makeBladeRow(overrides = {}) {
    return {
        name: 'Psychic Blade',
        type: 'Action',
        actionType: 'Action',
        hitBonus: 7,
        damage: '1d6+2',
        damageType: 'Psychic',
        mastery: 'Vex',
        isPsychicBlade: true,
        ...overrides,
    };
}
function makeBonusBladeRow() {
    return makeBladeRow({ type: 'Bonus Action', actionType: 'Bonus Action', damage: '1d4' });
}

describe('CLA-274 Psychic Blades second-blade gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-arm the default round so per-test overrides can never leak.
        getCurrentCombatRound.mockReturnValue(3);
    });

    it('stamps the round byte-exactly when the Attack-action blade row is clicked and rolls through', async () => {
        // Prop-distinct round (5 vs the default 3): a stamp of 5 is attributable
        // to the combatData read, not a hardcoded literal.
        getCurrentCombatRound.mockReturnValue(5);
        const row = makeBladeRow();
        const deps = createDeps();

        useCharActionsAttackHandlers(deps).handleAttackClick(row);

        expect(getCurrentCombatRound).toHaveBeenCalledWith(campaignName);
        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_PsychicBlade_attack_round', 5, campaignName);
        // The gate must not burn the second-blade latch on an Action row.
        expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(playerName, '_PsychicBlade_secondBlade_round', expect.anything(), campaignName);
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.buildCtx).toHaveBeenCalledWith(row);
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Psychic Blade', 7, CTX));
    });

    it.each([
        ['no blade attack stamped yet this round', {}],
        ['blade attack stamped on a stale earlier round', { '_PsychicBlade_attack_round': 1 }],
    ])('refuses the second-blade Bonus Action with the manifest popup — %s', (_case, storeOverrides) => {
        getCurrentCombatRound.mockReturnValue(4);
        const deps = createDeps({ getRuntimeValue: makeRuntimeStore(storeOverrides) });

        useCharActionsAttackHandlers(deps).handleAttackClick(makeBonusBladeRow());

        expect(deps.setPopupHtml).toHaveBeenCalledWith(POPUP_MANIFEST);
        expect(deps.rollAttack).not.toHaveBeenCalled();
        expect(deps.buildCtx).not.toHaveBeenCalled();
        // Refused clicks never reach the post-gate stamp blocks — zero writes.
        expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses a second same-round second-blade attack — the consumed latch, no roll, zero writes', () => {
        const deps = createDeps({
            getRuntimeValue: makeRuntimeStore({ '_PsychicBlade_attack_round': 3, '_PsychicBlade_secondBlade_round': 3 }),
        });

        useCharActionsAttackHandlers(deps).handleAttackClick(makeBonusBladeRow());

        expect(deps.setPopupHtml).toHaveBeenCalledWith(POPUP_SPENT);
        expect(deps.rollAttack).not.toHaveBeenCalled();
        expect(deps.buildCtx).not.toHaveBeenCalled();
        expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
        ['armed fresh in the same round', 3, { '_PsychicBlade_attack_round': 3 }],
        ['re-armed on a fresh round while the old latch sits on round 1', 4, { '_PsychicBlade_attack_round': 4, '_PsychicBlade_secondBlade_round': 1 }],
    ])('allows the second-blade Bonus Action once and consumes the latch — %s', async (_case, round, storeOverrides) => {
        getCurrentCombatRound.mockReturnValue(round);
        const row = makeBonusBladeRow();
        const deps = createDeps({ getRuntimeValue: makeRuntimeStore(storeOverrides) });

        useCharActionsAttackHandlers(deps).handleAttackClick(row);

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_PsychicBlade_secondBlade_round', round, campaignName);
        // Positive-leg-gated absence: the click ran through the full stamp block
        // (FT-036 _bonusActionAttackRound + the consumed second-blade latch), so
        // the missing psionic keys are real zero-cost gating, not a short-circuit.
        const keys = deps.setRuntimeValue.mock.calls.map((c) => c[1]);
        expect(keys).toContain('_bonusActionAttackRound');
        expect(keys).not.toContain('psionicEnergy');
        expect(keys).not.toContain('warPriestUses');
        expect(deps.buildCtx).toHaveBeenCalledWith(row);
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Psychic Blade', 7, CTX));
    });

    it('leaves non-Psychic-Blade Bonus Action rows ungated', async () => {
        const row = { name: 'Main Gauche', type: 'Bonus Action', hitBonus: 7, damage: '1d4+5' };
        const deps = createDeps();

        useCharActionsAttackHandlers(deps).handleAttackClick(row);

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        const keys = deps.setRuntimeValue.mock.calls.map((c) => c[1]);
        expect(keys).not.toContain('_PsychicBlade_attack_round');
        expect(keys).not.toContain('_PsychicBlade_secondBlade_round');
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Main Gauche', 7, CTX));
    });
});
