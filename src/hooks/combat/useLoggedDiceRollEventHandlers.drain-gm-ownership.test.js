// @maintained-by-ai
// bug-visitor-drains-pending-save-listener-bucket — GM-ownership guard on the
// SSE-adopted drain of the campaign GM-authority `pendingSaveListenerPrompts`
// bucket. With a GM (localhost) tab and a LAN visitor tab both mounted, the
// resolved-save echo (App.jsx redispatchSaveResult) replays `save-result` on
// EVERY tab, so the visitor's syncListenerPromptFilters ran the drain-to-evict
// write too: DELETE /api/campaigns/:c/pendingSaveListenerPrompts → 403
// "Access denied: GM-only feature" (console error per adjudicated save per
// visitor device) and, with surviving rows, a stale-mirror broadcast-POST
// racing the GM's write. The prune must execute ONLY on the GM (localhost)
// client; visitors mirror the drain via the null echo. Structure mirrors
// useLoggedDiceRollEventHandlers.test.js (same mocks) and pins the same
// visitor zero-write law as sseHandlers.turn-start-gm-ownership.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const flush = () => new Promise(r => setTimeout(r, 0));

const mocks = vi.hoisted(() => ({ isGmHost: vi.fn(() => true) }));
vi.mock('../../services/ui/gmHost.js', () => ({ isGmHost: mocks.isGmHost }));

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/dice/diceRoller.js', () => ({ rollExpression: vi.fn(), rollExpressionDoubled: vi.fn() }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn() }));
vi.mock('../runtime/useRuntimeState.js', () => ({ getRuntimeValue: vi.fn(), setRuntimeValue: vi.fn(), deleteRuntimeKey: vi.fn() }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: vi.fn((saveType) => saveType ? String(saveType).toUpperCase() : ''),
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({ hasIgnoreResistance: vi.fn(() => false), playerIsImmuneToCondition: vi.fn(() => false) }));
vi.mock('../../services/combat/automation/automationPassives.js', () => ({ isResilientSphereActive: vi.fn(() => false) }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../../services/rules/features/soulTomeTrapService.js', () => ({ grantSoulTomeTrap: vi.fn(async () => {}) }));
vi.mock('../../services/rules/features/infernalWoundService.js', () => ({ grantInfernalWound: vi.fn(async () => {}) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: vi.fn((n) => n), guid: vi.fn(() => 'test-guid-1234') } }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('./loggedDiceRollUtils.js', () => ({ hasSoulstitchProtection: vi.fn(() => false) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({ isCircleOfPowerActive: vi.fn(() => false) }));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({ cleanupConcentrationEffects: vi.fn() }));
vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
    getPendingPopupSetter: vi.fn(() => null),
}));
// Real getPendingSavePrompt semantics for a LISTENER prompt: it never lives in
// the per-tab memory registry — every adopting tab reads null and early-returns
// right after the bucket sync (the only write lane this bug is about).
vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
    getPendingSavePrompt: vi.fn(() => null),
}));

import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../runtime/useRuntimeState.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';

const CAMPAIGN = 'test-campaign';
const deps = { characterName: 'ElderPaladin', campaignName: CAMPAIGN, logEntry: vi.fn(), charactersRef: { current: [] } };

// Install the window listeners ONCE per file (the module install guard makes
// re-calls no-ops — same lifecycle law as the base test file). isGmHost is
// read at DISPATCH time, so the GM/visitor face is switched per test below.
window.__pendingResultHandlersInstalled = false;
setupEventListeners(deps);

// The server-armed listener bucket as the SSE mirror sees it on every tab.
let listenerBucket;

beforeEach(() => {
    vi.clearAllMocks();
    listenerBucket = ['p-1', 'p-2'];
    mocks.isGmHost.mockReturnValue(true);
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'pendingSaveListenerPrompts') return listenerBucket;
        if (name === 'campaign' && key === 'pendingSavePrompts') return {};
        return null;
    });
});

async function fire(detail) {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: detail.promptId, targetName: 'ElderPaladin', success: true, roll: 18, total: 23, saveBonus: 5, saveType: 'CON', saveDc: 15, ...detail },
    }));
    await flush();
    await flush();
}

describe('save-result listener-bucket drain — GM-ownership guard', () => {
    describe('visitor client (isGmHost false)', () => {
        it('runs ZERO writes when a listener prompt resolves: no DELETE-evict, no bucket POST', async () => {
            mocks.isGmHost.mockReturnValue(false);
            await fire({ promptId: 'p-1' });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deleteRuntimeKey).not.toHaveBeenCalled();
        });

        it('fails closed: an isGmHost that throws nothing back (undefined host) still writes nothing', async () => {
            mocks.isGmHost.mockReturnValue(undefined);
            await fire({ promptId: 'p-1' });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deleteRuntimeKey).not.toHaveBeenCalled();
        });
    });

    describe('GM client (isGmHost true)', () => {
        it('still prunes a surviving bucket via the broadcast-POST', async () => {
            await fire({ promptId: 'p-1' });
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingSaveListenerPrompts', ['p-2'], CAMPAIGN);
            expect(deleteRuntimeKey).not.toHaveBeenCalled();
        });

        it('drain-to-evict: pruning the LAST listener id DELETEs the bucket key', async () => {
            listenerBucket = ['p-1'];
            await fire({ promptId: 'p-1' });
            expect(deleteRuntimeKey).toHaveBeenCalledTimes(1);
            expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', 'pendingSaveListenerPrompts', CAMPAIGN);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('idempotent: a promptId absent from the bucket writes nothing (echo after the prune)', async () => {
            listenerBucket = [];
            await fire({ promptId: 'p-1' });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deleteRuntimeKey).not.toHaveBeenCalled();
        });
    });
});
