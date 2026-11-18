// @maintained-by-ai
// 2026-11-18 sheet-attack no-target refusal on the CharActions weapon-row
// seam (monster-chip TA-1116 parity): pressing an ATTACK row while the
// character's initiative row carries NO targetName refuses LOUD — the shared
// `.mc-no-target-refusal` popup + a `<weapon>_refused` zero-spend log row —
// BEFORE any game-state spend: no action-slot stamp (_attackActionTakenRound),
// no Reckless/Brutal chooser, no rollAttack dispatch, no runtime writes.
// An armed press (row targetName set) and a board-less press (cached combat
// summary absent) must ride the old lane byte-unchanged. Harness mirrors
// useCharActionsAttackHandlers.brutalGate.test.js (same mock family).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
// The cached combat-summary mirror answers per test: the armed truth lives on
// the attacker's initiative row (the sheet has no target picker of its own).
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'Korgath'),
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/automation/common/buffToggle.js', () => ({ toggleBuff: vi.fn() }));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({ markOncePerTurn: vi.fn() }));
vi.mock('../../services/rules/features/friendsService.js', () => ({ endFriendsOnHostileAction: vi.fn() }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../../services/combat/brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn() }));

const logService = await import('../../services/ui/logService.js');
const combatData = await import('../../services/encounters/combatData.js');
const friendsService = await import('../../services/rules/features/friendsService.js');
const invisibilityService = await import('../../services/rules/features/invisibilityService.js');
const { selectBrutalStrikeRiders } = await import('../../services/combat/brutalStrikeSelection.js');

const campaignName = 'test-campaign';
const playerName = 'Korgath';

/** Board mirror with Korgath's row; `armed` sets its targetName. */
function mockBoard({ armed }) {
    combatData.getCombatSummary.mockReturnValue({
        creatures: [
            { name: playerName, type: 'player', ...(armed ? { targetName: 'Goblin' } : {}) },
            { name: 'Goblin', type: 'npc' },
        ],
    });
}

function createDeps(overrides = {}) {
    const ctx = { hitBonus: 11 };
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve(ctx)),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: { name: playerName, level: 5, class: { name: 'Fighter' } },
        getRuntimeValue: vi.fn(() => null),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

const makeAttack = () => ({ name: 'Greataxe', hitBonus: 11, type: 'Action' });

describe('sheet weapon-row no-target refusal (useCharActionsAttackHandlers)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getCombatSummary.mockReturnValue(null);
        selectBrutalStrikeRiders.mockReturnValue([]);
    });

    it('unarmed in-combat press → loud refusal popup + <weapon>_refused log row, zero roll/stamp/spend', () => {
        mockBoard({ armed: false });
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(makeAttack());

        // Loud refusal in the shared sheet popup lane.
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        const html = deps.setPopupHtml.mock.calls[0][0];
        expect(typeof html).toBe('string');
        expect(html).toContain('mc-no-target-refusal');
        expect(html).toContain('Korgath cannot use Greataxe');
        expect(html).toContain('no target is armed');
        expect(html).toContain('Arm a target with the Target select on the initiative card.');
        expect(html).toContain('No attack rolled, nothing spent.');

        // One honest refusal row; no roll was ever logged downstream.
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'automation',
            automationType: 'greataxe_refused',
            characterName: playerName,
            abilityName: 'Greataxe',
            description: 'Korgath Greataxe refused (no target) — no armed target on the initiative card, no self-resolve. Zero spend, no attack rolled.',
            timestamp: expect.any(Number),
        });

        // Zero spend: no roll dispatch, no buildCtx, no CLA-143/_attackAction
        // stamps, no Reckless chooser, no hostile-action ends.
        expect(deps.rollAttack).not.toHaveBeenCalled();
        expect(deps.buildCtx).not.toHaveBeenCalled();
        expect(deps.setModalState).not.toHaveBeenCalled();
        expect(deps.setRuntimeValue).not.toHaveBeenCalled();
        expect(friendsService.endFriendsOnHostileAction).not.toHaveBeenCalled();
        expect(invisibilityService.endInvisibilityOnHostileAction).not.toHaveBeenCalled();
    });

    it('armed row (targetName set) → unchanged lane: stamps, buildCtx → rollAttack, no refusal', async () => {
        mockBoard({ armed: true });
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(makeAttack());

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_attackActionTakenRound', 1, campaignName);
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Greataxe', 11, { hitBonus: 11 }));
    });

    it('board-less press (cached summary absent) → gate inert, old lane unchanged', async () => {
        combatData.getCombatSummary.mockReturnValue(null);
        const deps = createDeps();
        const handlers = useCharActionsAttackHandlers(deps);

        handlers.handleAttackClick(makeAttack());

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Greataxe', 11, { hitBonus: 11 }));
    });
});
