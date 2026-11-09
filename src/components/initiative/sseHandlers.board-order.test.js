// @maintained-by-ai
// FW 2026-11-09 improve — BOARD ORDER LAW: display order == walker order.
// The card row IS the turn tracker, so every path that produces the live board
// must store the SAME initiative-sorted array the Next-walk steps through
// (sortCreaturesForBoard: present-first, initiative DESC, blank = −1, ties
// name-asc). Before this fix the mount merge sorted (initiativeService.js:264)
// while the full-store cs POST adoption onto a settled tab (handleCombatSummaryChange)
// stored the POSTed order verbatim — cards rendered e.g. EF/twin/EP while Next
// walked 20→15→10, visibly skipping a card drawn between two others.
// Law pinned here for BOTH paths: (a) SSE adoption sorts once at the seam, and
// (b) the mount merge keeps its sort — and the walker (REAL getNextCreatureName,
// initiativeService deliberately UNMOCKED except for its rng/loader seams)
// visits exactly the rendered array order, left-to-right, wrap included.
// Away rows park last (present-first law) and are never visited; blank-initiative
// rows sort to −1 among the present rows. Mock block mirrors
// sseHandlers-main.test.jsx + initiativeService.active-creature-pointer.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSseEventHandler } from './sseHandlers.js';
import * as combatData from '../../services/encounters/combatData.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as combatSuperiority from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js';
// REAL walker + REAL mount merge (the parity being locked is between these two
// consumers of one stored array — mocking either would pin nothing).
import { getNextCreatureName, mergeCombatSummaryWithCharacters } from '../../services/encounters/initiativeService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({ rollD20: vi.fn() }));
vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn(() => ({})),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(),
    getCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js', () => ({
    applyCommanderStrikeTurnEnd: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const characters = [{ name: 'EvasiveFighter' }, { name: 'ElderPaladin' }, { name: 'Bo' }];
const getName = (n) => n;

const player = (name, initiative, extra = {}) => ({
    name, type: 'player', initiative: String(initiative), targetName: null, concentration: null, ...extra,
});
// Verbatim ST twin shape (thiefsReflexesService.maybeGrantThiefsReflexesSecondTurn).
const twin = (holder, initiative) => ({
    ...player(`${holder} (Second Turn)`, initiative), secondTurn: true, holderName: holder,
});
const npc = (name, initiative) => ({ name, type: 'npc', initiative, targetName: null, concentration: null });

// Shuffled POST order (criterion scenario) + blank-initiative + away rows:
// walk order must be EF(20) → EP(15) → twin(10) → blanks name-asc (Ambush,
// Goblin at −1) → away Bo parked last (their init never outranks present rows).
const SHUFFLED = [
    player('EvasiveFighter', 20),
    twin('EvasiveFighter', 10),
    npc('Goblin', ''),
    player('ElderPaladin', 15),
    player('Bo', 25, { away: true }),
    npc('Ambush', ''),
];
const WALK_ORDER = ['EvasiveFighter', 'ElderPaladin', 'EvasiveFighter (Second Turn)', 'Ambush', 'Goblin'];
const RENDER_ORDER = [...WALK_ORDER, 'Bo'];

// Walk the board with the REAL walker, present rows only, `steps` deep so the
// round wrap fires; returns the visited-name sequence.
const walkSequence = (board, startName, steps) => {
    const visits = [];
    let active = startName;
    for (let i = 0; i < steps; i++) {
        const { newActiveName } = getNextCreatureName(board, active);
        visits.push(newActiveName);
        active = newActiveName;
    }
    return visits;
};

describe('combatSummary board order — adoption == mount-merge == walk order', () => {
    let handler;
    let refs;
    let mocks;

    const summaryEvent = (data) => ({ key: `change-${campaignName}-combatSummary`, data });

    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getActiveCreatureName.mockReturnValue(null);
        combatData.getCombatSummary.mockReturnValue(null);
        expirations.applyTurnStartEffects.mockResolvedValue(undefined);
        expirations.applyTurnEndConditionRemoval.mockResolvedValue(undefined);
        combatSuperiority.applyCommanderStrikeTurnEnd.mockResolvedValue(undefined);

        refs = {
            // Settled tab: the merge already mounted a sorted 1-creature board.
            combatSummaryRef: { current: { round: 1, creatures: [player('EvasiveFighter', 20)] } },
            activeCreatureNameRef: { current: 'EvasiveFighter' },
            lastAppliedTurnStartCreatureRef: { current: null },
        };
        mocks = {
            setCombatSummary: vi.fn(),
            setCombatSummaryG: vi.fn(),
            setActiveCreatureNameG: vi.fn(),
            setRuntimeStateTick: vi.fn(),
            setOverlays: vi.fn(),
            handleOverlayEvent: vi.fn(),
        };
        handler = createSseEventHandler({
            campaignName,
            characters,
            isLocalhost: true,
            combatSummaryRef: refs.combatSummaryRef,
            activeCreatureNameRef: refs.activeCreatureNameRef,
            lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
            setCombatSummary: mocks.setCombatSummary,
            setCombatSummaryG: mocks.setCombatSummaryG,
            setActiveCreatureNameG: mocks.setActiveCreatureNameG,
            setRuntimeStateTick: mocks.setRuntimeStateTick,
            setOverlays: mocks.setOverlays,
            handleOverlayEvent: mocks.handleOverlayEvent,
        });
    });

    it('adopts a shuffled full-store POST into the sortCreaturesForBoard order, not the POSTed order', async () => {
        await handler(summaryEvent({ round: 1, activeCreatureName: 'EvasiveFighter', creatures: SHUFFLED }));

        const adopted = mocks.setCombatSummaryG.mock.calls[0][0];
        // Rendered card row order (displayCreatures maps this array 1:1):
        expect(adopted.creatures.map(c => c.name)).toEqual(RENDER_ORDER);
        // The SAME array reaches the walker's ref and the sync cache.
        expect(refs.combatSummaryRef.current.creatures.map(c => c.name)).toEqual(RENDER_ORDER);
        expect(combatData.setCombatSummaryCache.mock.calls[0][0].creatures.map(c => c.name)).toEqual(RENDER_ORDER);
    });

    it('Next visits exactly the adopted array order left-to-right, round wrap included', async () => {
        await handler(summaryEvent({ round: 1, activeCreatureName: 'EvasiveFighter', creatures: SHUFFLED }));
        const adopted = mocks.setCombatSummaryG.mock.calls[0][0];

        // len(WALK_ORDER) steps from the head: every present card in drawn
        // order, then the wrap back to the head (away Bo never visited).
        const visits = walkSequence(adopted, 'EvasiveFighter', WALK_ORDER.length);
        expect(visits).toEqual([...WALK_ORDER.slice(1), 'EvasiveFighter']);

        const wrapped = getNextCreatureName(adopted, 'Goblin');
        expect(wrapped).toEqual({ newActiveName: 'EvasiveFighter', roundIncrement: true });
    });

    it('is idempotent — an already-sorted echo reorders nothing (no churn on the GM\'s own write echoes)', async () => {
        const sorted = { round: 1, creatures: RENDER_ORDER.map((name) => {
            if (name === 'Bo') return player('Bo', 25, { away: true });
            if (name === 'Ambush' || name === 'Goblin') return npc(name, '');
            if (name === 'EvasiveFighter (Second Turn)') return twin('EvasiveFighter', 10);
            return player(name, name === 'ElderPaladin' ? 15 : 20);
        }) };
        await handler(summaryEvent(sorted));
        const adopted = mocks.setCombatSummaryG.mock.calls[0][0];
        expect(adopted.creatures.map(c => c.name)).toEqual(RENDER_ORDER);
    });

    it('zero-creature and blank-only boards are unaffected', async () => {
        await handler(summaryEvent({ round: 1, creatures: [] }));
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith({ round: 1, creatures: [] });

        await handler(summaryEvent({ round: 1, creatures: [npc('Goblin', ''), npc('Ambush', '')] }));
        // Blank initiative (−1), ties name-asc — same order the walker reads.
        const adopted = mocks.setCombatSummaryG.mock.calls[mocks.setCombatSummaryG.mock.calls.length - 1][0];
        expect(adopted.creatures.map(c => c.name)).toEqual(['Ambush', 'Goblin']);
    });

    it('the mount merge stores the identical array order (one law, decided at each seam, no divergent second sort)', () => {
        // Same shuffled base the adoption test POSTs; the mount merge must
        // produce the SAME render/walk order from its own sortCreaturesForBoard call.
        const merged = mergeCombatSummaryWithCharacters(
            { round: 1, creatures: SHUFFLED },
            characters,
            getName,
        );
        expect(merged.creatures.map(c => c.name)).toEqual(RENDER_ORDER);
        const visits = walkSequence(merged, 'EvasiveFighter', WALK_ORDER.length);
        expect(visits).toEqual([...WALK_ORDER.slice(1), 'EvasiveFighter']);
    });
});
