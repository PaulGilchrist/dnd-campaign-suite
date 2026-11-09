// @maintained-by-ai
// LANE: navigationHandlers.second-turn — locks the turn-economy ST-seam fix
// (bug-secondturn-seam-starves-holder-economy-phantom-turnstate). A (Second Turn)
// row IS the holder's extra turn (owner ruling 2026-11-09; the gate lane c076dfdf1
// resolves twin→holderName in assertCanAct.js readActiveCreature), so the economy
// STATE writer must key the SAME entry the charges land on: holder→twin seam
// re-arms the HOLDER (fresh extra-turn budget), twin→X seam CLOSES the holder.
// Pre-fix, applyTurnStateTransition/markRewoundTurnActive reset/opened turnState
// under the synthetic label — a phantom un-spendable record — and the holder stay
// spent, so a holder who used their action was economy-denied on their OWN extra
// turn. The un-guarded expireStaleEffects sibling seeded a phantom char bucket
// {pendingExpirations:[]} under the synthetic name (phantom-bucket family
// 583d078ff/930393775/d55d4160a).
//
// Family map — cut with cites, do NOT re-test here:
//   dispatch contract / round-wrap housekeeping / gate keys → navigationHandlers.test.jsx
//   byte-exact persisted combatSummary stamps               → navigationHandlers.active-creature-stamp.test.jsx
//   enforcement-OFF zero-write parity (getRuntimeValue ⇒ null) → navigationHandlers.test.jsx (L5-001 legacy parity)
//   ST badge × / click / EffectAdder / allies remaps         → the *.second-turn.test.* siblings
//   pure turnState math (spend/refund/reset/close/open)     → services/combat/turnState.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as expirations from '../../services/rules/effects/expirations.js';
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
const HOLDER = 'Alice';
const ST_ROW = 'Alice (Second Turn)';
const OTHER = 'Bob';

const ENFORCEMENT_ON = { mode: 'on', turnLock: true, actionEconomy: true };

// Holder mid-turn with every bucket spent/movement used — the face the bug
// starved: reactions stay intact through resetForTurn (round-wrap owns those).
const SPENT_HOLDER = {
    actionsUsed: 1,
    bonusActionsUsed: 1,
    reactionsUsed: 1,
    movementUsedFeet: 20,
    hasMoved: true,
    turnActive: true,
    reactionCap: 1,
    companionOf: null,
};

const makeSummary = () => ({
    round: 1,
    activeCreatureName: HOLDER,
    creatures: [
        { name: HOLDER, type: 'player', initiative: '20' },
        { name: ST_ROW, type: 'player', initiative: '19', secondTurn: true, holderName: HOLDER },
        { name: OTHER, type: 'player', initiative: '15' },
    ],
});

let store;

// Keyed runtime read, mirroring the bridgeStore idiom in chargeEconomy.test.js.
const mountRuntime = (turnState) => {
    store = {
        'campaign.enforcement': ENFORCEMENT_ON,
        'campaign.turnState': turnState,
    };
};

const persistedTurnState = () => {
    const call = runtimeState.setRuntimeValue.mock.calls.find(
        ([key, subKey]) => key === 'campaign' && subKey === 'turnState'
    );
    return call ? call[2] : undefined;
};

const nextArgs = (activeCreatureName) => ({
    combatSummaryRef: { current: makeSummary() },
    activeCreatureName,
    campaignName: CAMPAIGN,
    characters: [
        { name: HOLDER, computedStats: {} },
        { name: OTHER, computedStats: {} },
    ],
    roundRef: { current: 1 },
    lastAppliedTurnStartCreatureRef: { current: null },
    setCombatSummary: vi.fn(),
    setActiveCreatureName: vi.fn(),
    setRuntimeStateTick: vi.fn(),
});

beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockImplementation(
        (key, subKey) => (subKey === undefined ? store?.[key] ?? null : store?.[`${key}.${subKey}`] ?? null)
    );
});

describe('navigationHandlers second-turn economy seam', () => {
    it('holder→twin seam re-arms the HOLDER with fresh budget — zero synthetic keys in the persisted turnState', async () => {
        mountRuntime({ [HOLDER]: { ...SPENT_HOLDER } });
        initiativeService.getNextCreatureName.mockReturnValue({
            newActiveName: ST_ROW,
            roundIncrement: false,
        });

        await createNextCreatureHandler(nextArgs(HOLDER))();

        // Full-bucket pin: holder reset for the extra turn (actions/bonus/movement
        // fresh, turnActive true — reactions stay authoritative at the round wrap)
        // and the synthetic label NEVER exists as a record.
        expect(persistedTurnState()).toEqual({
            [HOLDER]: {
                actionsUsed: 0,
                bonusActionsUsed: 0,
                reactionsUsed: 1,
                movementUsedFeet: 0,
                hasMoved: false,
                turnActive: true,
                reactionCap: 1,
                companionOf: null,
            },
        });
    });

    it('twin→X seam CLOSES the holder and opens the next creature — still zero synthetic keys', async () => {
        // Holder fresh+active (state after the twin seam above).
        mountRuntime({ [HOLDER]: { ...SPENT_HOLDER, actionsUsed: 0, bonusActionsUsed: 0, movementUsedFeet: 0, hasMoved: false } });
        initiativeService.getNextCreatureName.mockReturnValue({
            newActiveName: OTHER,
            roundIncrement: false,
        });

        await createNextCreatureHandler(nextArgs(ST_ROW))();

        // Outgoing twin resolves to the holder → closeTurn(holder); Bob re-armed.
        expect(persistedTurnState()).toEqual({
            [HOLDER]: expect.objectContaining({ turnActive: false }),
            [OTHER]: expect.objectContaining({ turnActive: true, actionsUsed: 0 }),
        });
        expect(persistedTurnState()[HOLDER].turnActive).toBe(false);
        expect(persistedTurnState()).not.toHaveProperty(ST_ROW);
    });

    it('the expiry seam skips a twin row (no phantom char bucket) but still fires for normal rows', async () => {
        mountRuntime({});
        initiativeService.getNextCreatureName.mockReturnValue({
            newActiveName: ST_ROW,
            roundIncrement: false,
        });
        await createNextCreatureHandler(nextArgs(HOLDER))();
        expect(expirations.expireStaleEffects).not.toHaveBeenCalledWith(CAMPAIGN, ST_ROW);

        initiativeService.getNextCreatureName.mockReturnValue({
            newActiveName: OTHER,
            roundIncrement: false,
        });
        await createNextCreatureHandler(nextArgs(ST_ROW))();
        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(CAMPAIGN, OTHER);
    });

    it('rewind INTO a twin row re-opens the HOLDER economy — openTurn never keys the synthetic label, expiry skipped', async () => {
        // Holder closed with budget spent (state after walking past the twin seam).
        mountRuntime({ [HOLDER]: { ...SPENT_HOLDER, turnActive: false } });
        initiativeService.getPreviousCreatureName.mockReturnValue({
            newActiveName: ST_ROW,
            roundDecrement: false,
        });

        await createPreviousCreatureHandler({
            ...nextArgs(OTHER),
            isPreviousDisabled: false,
        })();

        // openTurn resolves twin→holder: re-opened WITHOUT refunding budgets
        // (rewind is not a real turn start — CLA-307 philosophy).
        expect(persistedTurnState()).toEqual({
            [HOLDER]: { ...SPENT_HOLDER, turnActive: true },
        });
        expect(expirations.expireStaleEffects).not.toHaveBeenCalledWith(CAMPAIGN, ST_ROW);
    });
});
