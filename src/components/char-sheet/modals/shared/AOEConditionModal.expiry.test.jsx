// @maintained-by-ai: 2026-10-16 — deterministic act() flushes replace real-time waitFor (full-suite load flake fix)
// SP-024: Color Spray (2024, save_only) — Blinded condition never expired.
// Pins the fail-grant expiry clock: ONE addExpiration per failing target
// ({rounds:1, expireOnCreatureName: caster} — CLA-045 end-of-next-turn convention),
// no clock on successful saves, per-spell duration honored, and the
// ResultsSummaryModal failed-target count fix.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules (mirror AOEConditionModal.save-flow.test.jsx) ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

// ── Fixtures ──

const campaignName = 'test-campaign';
const casterName = 'DivinationWizard';

const basePlayerStats = {
    name: casterName,
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
};

const baseAction = { name: 'Color Spray' };

const combatSummary = {
    creatures: [
        { name: 'Goblin 1', type: 'npc', currentHp: 7, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'Goblin 2', type: 'npc', currentHp: 7, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const blindedEffects = [{ type: 'blinded', condition: 'blinded' }];

// Deterministic flush inside act() — mirrors the initiative.overlays batch-run
// flake fix (2026-10). The modal's confirm/save-result lanes are async and
// un-awaited by fireEvent: handleCreatureSelectionConfirm chains
// addEntry → resolveAllSaves → setPendingPrompts OUTSIDE act, and the effect
// that registers the window 'save-result' listener only runs after React
// flushes that render (a scheduler task). Real-time waitFor polls the mock
// call list, which turns true BEFORE the listener exists — under full-suite
// parallel load the render task starves and a save-result event dispatches
// into a void (flake, 2026-10). Every async hop here resolves on pre-resolved
// mocks, so yielding ONE macrotask inside act() drains the whole chain:
// the microtask queue empties completely before the timer fires, and act's
// exit flush runs React's queued render + effects synchronously. Bounded
// event-loop yield only — no game-state timers.
function flush(action) {
    return act(async () => {
        if (action) action();
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 19,
        effects: blindedEffects,
        conditionLabel: 'Blinded',
        duration: 'Instantaneous',
        onClose: vi.fn(),
        ...overrides,
    };
}

function selectTargets(...names) {
    const rows = document.querySelectorAll('.secondary-target-row');
    names.forEach(name => {
        const row = Array.from(rows).find(r => r.textContent.includes(name));
        fireEvent.click(row);
    });
}

function clickApply() {
    fireEvent.click(screen.getByRole('button', { name: /Color Spray/ }));
}

// saveDc 21 + con bonus 0 → every d20+0 < 21: deterministic fail.
// saveDc 1 → every d20+0 >= 1: deterministic success.
const ALWAYS_FAIL_DC = 21;
const ALWAYS_SAVE_DC = 1;

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(combatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('AOEConditionModal — SP-024 fail-grant expiry clock', () => {
    it('failed NPC save stamps ONE addExpiration per target with the caster end-of-next-turn anchor', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_FAIL_DC })} />);
        selectTargets('Goblin 1', 'Goblin 2');
        clickApply();
        await flush();

        expect(addExpiration).toHaveBeenCalledTimes(2);

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: casterName,
            targetName: 'Goblin 1',
            effects: [{ type: 'condition', condition: 'blinded' }],
            campaignName,
            rounds: 1,
            expireOnCreatureName: casterName,
        });
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: casterName,
            targetName: 'Goblin 2',
            effects: [{ type: 'condition', condition: 'blinded' }],
            campaignName,
            rounds: 1,
            expireOnCreatureName: casterName,
        });

        // condition still lands on fail (adjudication untouched)
        const condWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(condWrites).toHaveLength(2);
        expect(condWrites[0][0]).toBe('Goblin 1');
        expect(condWrites[0][2]).toContain('blinded');
    });

    it('successful NPC save applies no condition and arms no expiration clock', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_SAVE_DC })} />);
        selectTargets('Goblin 1');
        clickApply();
        await flush();

        expect(persistAndNotify).toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        const condWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(condWrites).toHaveLength(0);
    });

    it('failed PLAYER save-result arms the same clock after applying the condition', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_FAIL_DC })} />);
        selectTargets('PlayerAlly');
        clickApply();

        // player target goes through the save-prompt listener.
        // Flush first, THEN read the prompt write: the write happens inside
        // resolveAllSaves, but the window 'save-result' listener only
        // registers after the pendingPrompts render flushes. Flushing before
        // firing guarantees the listener exists (was the load-dependent flake).
        await flush();
        expect(setRuntimeValue.mock.calls.some(c => c[1] === 'pendingSaveListenerPrompts')).toBe(true);
        expect(addExpiration).not.toHaveBeenCalled();

        const promptId = setRuntimeValue.mock.calls
            .find(c => c[1] === 'pendingSaveListenerPrompts')[2][0];
        // fire + flush in one act() so handleSaveResult's un-awaited
        // setState tail (setResults/setPendingPrompts) settles deterministically
        await flush(() => fireEvent(window, new CustomEvent('save-result', {
            detail: { promptId, success: false, roll: 4, total: 4, saveBonus: 0 },
        })));

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('PlayerAlly', 'activeConditions', expect.arrayContaining(['blinded']), campaignName);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: casterName,
            targetName: 'PlayerAlly',
            effects: [{ type: 'condition', condition: 'blinded' }],
            campaignName,
            rounds: 1,
            expireOnCreatureName: casterName,
        });
        // the prompt is consumed — results summary shows the resolved fail
        expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'pendingSaveListenerPrompts')).toHaveLength(1);
        expect(document.body.textContent).toMatch(/0\s*targets saved,\s*1\s*target failed/);
    });

    it('successful PLAYER save-result arms nothing', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_SAVE_DC })} />);
        selectTargets('PlayerAlly');
        clickApply();

        // flush before firing so the save-result listener is registered (see flake note above)
        await flush();
        expect(setRuntimeValue.mock.calls.some(c => c[1] === 'pendingSaveListenerPrompts')).toBe(true);

        const promptId = setRuntimeValue.mock.calls
            .find(c => c[1] === 'pendingSaveListenerPrompts')[2][0];
        await flush(() => fireEvent(window, new CustomEvent('save-result', {
            detail: { promptId, success: true, roll: 15, total: 16, saveBonus: 1 },
        })));

        expect(persistAndNotify).toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        const condWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(condWrites).toHaveLength(0);
    });

    it('duration is derived from spell data: "2 rounds" clock stays anchored on the caster', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_FAIL_DC, duration: '2 rounds' })} />);
        selectTargets('Goblin 1');
        clickApply();
        await flush();
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ rounds: 2, expireOnCreatureName: casterName }));
    });

    it('concentration/minute duration (Entangle twin) keeps the spell-duration lifecycle: condition lands, NO round clock', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_FAIL_DC, effects: [{ type: 'restrained', condition: 'restrained' }], conditionLabel: 'Restrained', duration: 'Concentration, up to 1 minute' })} />);
        selectTargets('Goblin 2');
        clickApply();
        await flush();
        expect(persistAndNotify).toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        const condWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(condWrites).toHaveLength(1);
        expect(condWrites[0][2]).toContain('restrained');
    });

    it('ResultsSummaryModal counts failed targets (resolveNpcTarget no longer returns null)', async () => {
        const { container } = render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_FAIL_DC })} />);
        selectTargets('Goblin 1', 'Goblin 2');
        clickApply();
        await flush();

        expect(container.textContent).toMatch(/0\s*targets saved,\s*2\s*targets failed/);
    });

    it('success summary counts saved targets', async () => {
        const { container } = render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_SAVE_DC })} />);
        selectTargets('Goblin 1', 'Goblin 2');
        clickApply();
        await flush();

        expect(container.textContent).toMatch(/2\s*targets saved,\s*0\s*targets failed/);
    });
});
