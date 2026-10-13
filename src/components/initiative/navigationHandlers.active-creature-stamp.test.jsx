// BUG (MA-1966 infra): frozen combatSummary.activeCreatureName over-refused every
// mid-round legendary press. createNextCreatureHandler persisted a cloned summary whose
// activeCreatureName never moved (only the top-level key did), so the boundary stamp that
// legendaryExpendGate reads via getCombatContext froze mid-round. These tests lock that
// EVERY tracker step (Next and Previous) stamps the live active creature onto the
// persisted combatSummary — even when turn-start effects hand back a cache copy.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as unbreakableMajesty from '../../services/combat/auras/unbreakableMajesty.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';

vi.mock('../../services/encounters/initiativeService.js', () => ({
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    clearPerRoundMajestyTrackers: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
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

describe('navigationHandlers active-creature boundary stamp (MA-1966 infra)', () => {
    const campaignName = 'test-campaign';

    // cs carries a BAKED activeCreatureName — pre-fix every persist re-baked it stale.
    const baseCombatSummary = {
        round: 1,
        activeCreatureName: 'Alice',
        creatures: [
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
            { name: 'Charlie', type: 'player' },
        ],
    };

    const baseCharacters = [
        { name: 'Alice', computedStats: { hitPoints: 20 } },
        { name: 'Bob', computedStats: { hitPoints: 15 } },
        { name: 'Charlie', computedStats: { hitPoints: 18 } },
    ];

    let combatSummaryRef;
    let roundRef;
    let lastAppliedTurnStartCreatureRef;
    let setCombatSummary;
    let setActiveCreatureName;
    let setRuntimeStateTick;

    const nextArgs = (activeCreatureName) => ({
        combatSummaryRef,
        activeCreatureName,
        campaignName,
        characters: baseCharacters,
        roundRef,
        lastAppliedTurnStartCreatureRef,
        setCombatSummary,
        setActiveCreatureName,
        setRuntimeStateTick,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(null);
        combatSummaryRef = { current: { ...baseCombatSummary } };
        roundRef = { current: 1 };
        lastAppliedTurnStartCreatureRef = { current: null };
        setCombatSummary = vi.fn();
        setActiveCreatureName = vi.fn();
        setRuntimeStateTick = vi.fn();
    });

    describe('createNextCreatureHandler', () => {
        it('mid-round step advances the persisted cs.activeCreatureName stamp (not just the top-level key)', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });

            await createNextCreatureHandler(nextArgs('Alice'))();

            // The gate boundary: the persisted summary must report the LIVE new active.
            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({ round: 1, activeCreatureName: 'Bob' }),
                campaignName
            );
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({ activeCreatureName: 'Bob' }));
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Bob', campaignName);
        });

        it('round-wrap step stamps round AND the wrap creature on the persisted summary', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });

            await createNextCreatureHandler(nextArgs('Charlie'))();

            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({ round: 2, activeCreatureName: 'Alice' }),
                campaignName
            );
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({ round: 2, activeCreatureName: 'Alice' }));
        });

        it('stamp survives the turn-start cache-copy adoption — a stale getCombatSummary copy is re-stamped before persist', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });
            // applyTurnStartGate adopts getCombatSummary(campaignName) when non-null;
            // a stale mirror copy there must NOT bake an old boundary into the POST.
            getCombatSummary.mockReturnValue({
                round: 1,
                activeCreatureName: 'StaleCopyCreature',
                creatures: baseCombatSummary.creatures,
            });

            await createNextCreatureHandler(nextArgs('Alice'))();

            expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({ activeCreatureName: 'Bob' }),
                campaignName
            );
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({ activeCreatureName: 'Bob' }));
        });

        it('consecutive steps keep the stamp fresh at every boundary', async () => {
            const handler = createNextCreatureHandler(nextArgs('Alice'));
            initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Bob', roundIncrement: false });
            await handler();
            expect(storage.set).toHaveBeenLastCalledWith(
                'combatSummary',
                expect.objectContaining({ activeCreatureName: 'Bob' }),
                campaignName
            );

            // Walk onward from Bob's card state (ref now reports Bob live).
            combatSummaryRef.current = { ...baseCombatSummary, activeCreatureName: 'Bob' };
            const handler2 = createNextCreatureHandler(nextArgs('Bob'));
            initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Charlie', roundIncrement: false });
            await handler2();
            expect(storage.set).toHaveBeenLastCalledWith(
                'combatSummary',
                expect.objectContaining({ activeCreatureName: 'Charlie' }),
                campaignName
            );
        });
    });

    describe('createPreviousCreatureHandler', () => {
        it('rewind step also moves the persisted cs.activeCreatureName stamp', async () => {
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundDecrement: false,
            });

            await createPreviousCreatureHandler({
                ...nextArgs('Bob'),
                isPreviousDisabled: false,
            })();

            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({ round: 1, activeCreatureName: 'Alice' }),
                campaignName
            );
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Alice', campaignName);
        });

        it('rewind across round wrap stamps decremented round + new active', async () => {
            roundRef.current = 2;
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Charlie',
                roundDecrement: true,
            });

            await createPreviousCreatureHandler({
                ...nextArgs('Alice'),
                isPreviousDisabled: false,
            })();

            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.objectContaining({ round: 1, activeCreatureName: 'Charlie' }),
                campaignName
            );
        });
    });

    it('guards: round-wrap housekeeping and turn-start passes keep firing alongside the stamp', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Alice', roundIncrement: true });

        await createNextCreatureHandler(nextArgs('Charlie'))();

        expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Alice', campaignName, 2);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '2:Alice', campaignName);
        expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Alice', expect.any(Object), campaignName, baseCharacters);
    });
});
