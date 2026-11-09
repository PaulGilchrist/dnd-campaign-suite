// @maintained-by-ai
// Pending-OA marker drop law at the initiative turn seam (bug-monster-oa-
// resolution-auto-missed-by-melee-range-gate, criterion 4). A marker lives
// only until its defender's next turn is TAKEN (new active creature) or ENDED
// (outgoing creature) — passing the turn without resolving spends the reaction
// the trigger already charged (NO refund lane is touched here). The mover-
// presence prune shares the seam (away/dead movers evict). The guard is bucket
// CONTENT, not enforcement flags, so markers armed earlier still drop when
// the flags change mid-combat; an empty bucket writes NOTHING (byte-parity).
// Lifecycle math → pendingOpportunityAttacks.test.js; new-initiative/Clear
// seams are one-liners onto clearAllPendingOas pinned there.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/encounters/initiativeService.js', () => ({
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    clearPerRoundMajestyTrackers: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(() => Promise.resolve()),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    deleteRuntimeKey: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const CAMPAIGN = 'test-campaign';
const ENFORCEMENT_ON = { mode: 'on', turnLock: true, actionEconomy: true, opportunityAttacks: true };

const ALICE = 'Alice';
const BOB = 'Bob';
const CAROL = 'Carol';
const MARKER_MOVER_BOB = { defender: ALICE, mover: BOB, promptId: 'p-a' };

function makeSummary() {
    return {
        round: 1,
        activeCreatureName: ALICE,
        creatures: [
            { name: ALICE, type: 'player', initiative: '20' },
            { name: BOB, type: 'player', initiative: '15', currentHp: 9 },
            { name: CAROL, type: 'player', initiative: '10', currentHp: 7 },
        ],
    };
}

let store;
function mountRuntime({ enforcement = ENFORCEMENT_ON, turnState = {}, pendingOAs } = {}) {
    store = {
        'campaign.enforcement': enforcement,
        'campaign.turnState': turnState,
        'campaign.pendingOAs': pendingOAs,
    };
}

const oaWrites = () => runtimeState.setRuntimeValue.mock.calls
    .filter(c => c[0] === 'campaign' && c[1] === 'pendingOAs');
const oaEvicts = () => runtimeState.deleteRuntimeKey.mock.calls
    .filter(c => c[0] === 'campaign' && c[1] === 'pendingOAs');

function nextArgs(activeCreatureName) {
    return {
        combatSummaryRef: { current: makeSummary() },
        activeCreatureName,
        campaignName: CAMPAIGN,
        characters: [
            { name: ALICE, computedStats: {} },
            { name: BOB, computedStats: {} },
            { name: CAROL, computedStats: {} },
        ],
        roundRef: { current: 1 },
        lastAppliedTurnStartCreatureRef: { current: null },
        setCombatSummary: vi.fn(),
        setActiveCreatureName: vi.fn(),
        setRuntimeStateTick: vi.fn(),
    };
}

async function stepNext(activeCreatureName, newActiveName) {
    initiativeService.getNextCreatureName.mockReturnValue({ newActiveName, roundIncrement: false });
    await createNextCreatureHandler(nextArgs(activeCreatureName))();
}

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation(
        (key, subKey) => (subKey === undefined ? store?.[key] ?? null : store?.[`${key}.${subKey}`] ?? null)
    );
});

describe('navigationHandlers pending-OA turn-seam drop', () => {
    it('outgoing defender turn END drops its marker; an untouched defender keeps its own', async () => {
        mountRuntime({ pendingOAs: { [ALICE]: MARKER_MOVER_BOB, [CAROL]: { defender: CAROL, mover: BOB, promptId: 'p-c' } } });
        await stepNext(ALICE, BOB);

        expect(oaWrites()).toHaveLength(1); // one merged broadcast write
        expect(oaWrites()[0][2]).toEqual({ [CAROL]: { defender: CAROL, mover: BOB, promptId: 'p-c' } });
        expect(oaWrites()[0][3]).toBe(CAMPAIGN);
        expect(oaEvicts()).toHaveLength(0);
    });

    it('defender turn TAKEN drops its marker — the last row evicts the key (drain-to-evict)', async () => {
        mountRuntime({ pendingOAs: { [BOB]: { defender: BOB, mover: ALICE, promptId: 'p-b' } } });
        await stepNext(ALICE, BOB);

        expect(oaEvicts()).toEqual([['campaign', 'pendingOAs', CAMPAIGN]]);
        expect(oaWrites()).toHaveLength(0);
    });

    it('mover went AWAY at the seam ⇒ that defender\u2019s marker prunes even though it was not the turn boundary', async () => {
        const summary = makeSummary();
        summary.creatures.find(c => c.name === BOB).away = true;
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: BOB, roundIncrement: false });
        mountRuntime({ pendingOAs: { [CAROL]: { defender: CAROL, mover: BOB, promptId: 'p-c' } } });
        await createNextCreatureHandler({ ...nextArgs(ALICE), combatSummaryRef: { current: summary } })();

        // Carol's turn neither ended nor began — the prune leg is what evicts.
        expect(oaEvicts()).toEqual([['campaign', 'pendingOAs', CAMPAIGN]]);
    });

    it('dead mover (0 hp) prunes at the seam for a defender whose turn neither began nor ended', async () => {
        const summary = makeSummary();
        summary.creatures.push({ name: 'Fallen', type: 'npc', initiative: '5', currentHp: 0 });
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: BOB, roundIncrement: false });
        mountRuntime({ pendingOAs: { [CAROL]: { defender: CAROL, mover: 'Fallen', promptId: 'p-c' } } });
        await createNextCreatureHandler({ ...nextArgs(ALICE), combatSummaryRef: { current: summary } })();

        // Carol's boundary did not move — the prune leg is what evicts, and
        // it never touches the turnState refund lanes.
        expect(oaEvicts()).toEqual([['campaign', 'pendingOAs', CAMPAIGN]]);
        expect(oaWrites()).toHaveLength(0);
    });

    it('enforcement OFF still honors the drop law (guard = bucket contents, not flags); turnState stays unwritten', async () => {
        mountRuntime({ enforcement: null, pendingOAs: { [ALICE]: MARKER_MOVER_BOB } });
        await stepNext(ALICE, BOB);

        expect(oaEvicts()).toEqual([['campaign', 'pendingOAs', CAMPAIGN]]);
        expect(runtimeState.setRuntimeValue.mock.calls.some(c => c[1] === 'turnState')).toBe(false);
    });

    it('nothing pending ⇒ the seam writes NOTHING to the bucket (broadcast parity)', async () => {
        mountRuntime({ pendingOAs: null });
        await stepNext(ALICE, BOB);
        expect(oaWrites()).toHaveLength(0);
        expect(oaEvicts()).toHaveLength(0);

        mountRuntime({ pendingOAs: {} });
        await stepNext(ALICE, BOB);
        expect(oaWrites()).toHaveLength(0);
        expect(oaEvicts()).toHaveLength(0);
    });

    it('a spent reaction is NOT refunded at the drop seam (no refundSlot/turnState churn beyond the normal transition)', async () => {
        // Bob provoked Alice; Alice's reaction is spent at the trigger. Alice's
        // turn ENDS here (steps to Bob) — marker drops, reactionsUsed stays 1.
        mountRuntime({
            turnState: { [ALICE]: { actionsUsed: 0, bonusActionsUsed: 0, reactionsUsed: 1, movementUsedFeet: 0, hasMoved: false, turnActive: true, reactionCap: 1, companionOf: null } },
            pendingOAs: { [ALICE]: MARKER_MOVER_BOB },
        });
        await stepNext(ALICE, BOB);

        const ts = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'turnState').at(-1)[2];
        expect(ts[ALICE].reactionsUsed).toBe(1); // stay spent — the drop grants no refund
        expect(oaEvicts()).toEqual([['campaign', 'pendingOAs', CAMPAIGN]]);
    });
});
