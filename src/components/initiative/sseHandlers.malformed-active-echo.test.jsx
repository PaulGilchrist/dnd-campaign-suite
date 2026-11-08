// @maintained-by-ai
// Malformed activeCreatureName echo guard (bug-zero-creature-initiative-null-name):
// the pre-fix zero-creature mount POSTed an unwrapped {} body, so the server stored
// {} under activeCreatureName and its SSE echo reached handleActiveCreatureNameChange
// as an OBJECT — poisoning the round gate with "1:[object Object]" and crashing
// expireStaleEffects (targetName.toLowerCase is not a function). The handler must now
// drop truthy non-string echoes; null/undefined remain legitimate sentinels already
// dropped at dispatch (event.data == null). Structure mirrors sseHandlers-main.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSseEventHandler } from './sseHandlers.js';
import * as combatData from '../../services/encounters/combatData.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as combatSuperiority from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
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
const CHARACTERS = [{ name: 'Alice', computedStats: { hitPoints: 20 } }];

describe('handleActiveCreatureNameChange malformed echo guard', () => {
    let handler;
    let refs;
    let mocks;

    const activeEvent = (name) => ({ key: `change-${campaignName}-activeCreatureName`, data: name });

    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getActiveCreatureName.mockReturnValue(null);
        combatData.getCombatSummary.mockReturnValue(null);
        expirations.applyTurnStartEffects.mockResolvedValue(undefined);
        expirations.applyTurnEndConditionRemoval.mockResolvedValue(undefined);
        combatSuperiority.applyCommanderStrikeTurnEnd.mockResolvedValue(undefined);

        refs = {
            combatSummaryRef: { current: { round: 1, creatures: [{ name: 'Alice', type: 'player' }] } },
            activeCreatureNameRef: { current: 'Alice' },
            lastAppliedTurnStartCreatureRef: { current: null },
        };
        mocks = {
            setCombatSummary: vi.fn(),
            setCombatSummaryG: vi.fn(),
            setActiveCreatureNameG: vi.fn(),
            setRuntimeStateTick: vi.fn(),
            handleOverlayEvent: vi.fn(),
        };
        handler = createSseEventHandler({
            campaignName,
            characters: CHARACTERS,
            isLocalhost: true, // GM client (guard legs live in …-gm-ownership.test.jsx)
            combatSummaryRef: refs.combatSummaryRef,
            activeCreatureNameRef: refs.activeCreatureNameRef,
            lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
            setCombatSummary: mocks.setCombatSummary,
            setCombatSummaryG: mocks.setCombatSummaryG,
            setActiveCreatureNameG: mocks.setActiveCreatureNameG,
            setRuntimeStateTick: mocks.setRuntimeStateTick,
            handleOverlayEvent: mocks.handleOverlayEvent,
        });
    });

    it('drops a {} echo entirely: no gate stamp, no expiry, no state writes', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await handler(activeEvent({}));
            expect(refs.activeCreatureNameRef.current).toBe('Alice');
            expect(mocks.setActiveCreatureNameG).not.toHaveBeenCalled();
            expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(refs.lastAppliedTurnStartCreatureRef.current).toBeNull();
            expect(errSpy).toHaveBeenCalledWith(
                expect.stringContaining('Ignoring malformed activeCreatureName echo'), {},
            );
        } finally {
            errSpy.mockRestore();
        }
    });

    it('still mirrors a legitimate string name through the turn seam', async () => {
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob'; // isolate: gate off
        await handler(activeEvent('Bob'));
        expect(refs.activeCreatureNameRef.current).toBe('Bob');
        expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Bob');
        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
    });

    it('nullish echoes stay dropped at the dispatch door (null = legitimate sentinel)', async () => {
        for (const data of [null, undefined]) {
            await handler(activeEvent(data));
        }
        expect(refs.activeCreatureNameRef.current).toBe('Alice');
        expect(mocks.setActiveCreatureNameG).not.toHaveBeenCalled();
        expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
});
