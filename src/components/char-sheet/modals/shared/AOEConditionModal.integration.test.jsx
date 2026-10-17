// @maintained-by-ai
// Integration lane for AOEConditionModal: the Heightened Spell metamagic end-to-end
// path — radio rendering and the disadvantaged save roll flowing through
// resolveNpcTarget into conditions + log entries. Radio/heighten behavior is not
// covered in any sibling lane.
//
// Sibling lanes (do not duplicate here):
//   - AOEConditionModal.test.jsx        → initial render, target selection UI
//   - AOEConditionModal.save-flow.test.jsx → NPC/player save resolution, careful spell,
//                                              storeSpellLastAttack, logging, mixed targets
//   - AOEConditionModal.results.test.jsx   → dedup, blocking effects
//   - AOEConditionModal.overlay.test.jsx   → overlay early-return render path
//   - AOEConditionModal.expiry.test.jsx    → SP-024 fail-grant expiry clocks

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules ──

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
import { addEntry } from '../../../../services/ui/logService.js';

// ── Test fixtures ──

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Blinding Darkness',
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { con: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const baseEffects = [{ type: 'blinded', condition: 'blinded' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 12,
        effects: baseEffects,
        conditionLabel: 'Blinded',
        onClose: vi.fn(),
        ...overrides,
    };
}

function getApplyButton() {
    return screen.getByRole('button', { name: /Blinding Darkness/ });
}

function findSaveResult(targetName) {
    const entry = addEntry.mock.calls
        .map(call => call[1])
        .find(e => e && e.type === 'save_result' && e.targetName === targetName);
    return entry;
}

function activeConditionsCalls(targetName) {
    return setRuntimeValue.mock.calls.filter(
        call => call[0] === targetName && call[1] === 'activeConditions'
    );
}

// ── Tests ──

describe('AOEConditionModal — Heightened Spell integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    it('renders one heighten radio per eligible target only when metamagicHeighten is enabled', () => {
        const view = render(<AOEConditionModal {...makeProps({ metamagicHeighten: true })} />);
        expect(screen.getAllByRole('radio')).toHaveLength(baseCombatSummary.creatures.length);
        view.unmount();

        render(<AOEConditionModal {...makeProps({ metamagicHeighten: false })} />);
        expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('rolls the heighten-selected target with disadvantage: two-roll minimum fails an otherwise-successful save and applies the condition', async () => {
        // React dev internals consume Math.random during clicks, so roll values are
        // engineered per-ordering: before apply every roll is 20; once apply starts
        // the first roll is 20 and every later roll is 9. Whatever order the
        // consumers run in, the heighten pair's minimum lands on 9 (< DC 12),
        // while an unheightened single roll would take the first value (20, saved).
        let applyClicked = false;
        let postApplyCalls = 0;
        const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
            if (!applyClicked) return 0.95;
            return postApplyCalls++ === 0 ? 0.95 : 0.4;
        });
        try {
            render(<AOEConditionModal {...makeProps({ metamagicHeighten: true })} />);

            // Select the Goblin target, then mark it for Heightened Spell disadvantage.
            const radios = screen.getAllByRole('radio');
            const goblinRow = radios[0].closest('.secondary-target-row');
            await act(async () => { fireEvent.click(goblinRow); });
            await act(async () => { fireEvent.click(radios[0]); });
            await waitFor(() => {
                expect(radios[0]).toBeChecked();
                expect(goblinRow).toHaveClass('secondary-target-selected');
            });

            applyClicked = true;
            await act(async () => {
                fireEvent.click(getApplyButton());
            });

            // The recorded save must be the disadvantage minimum (9), failing DC 12.
            await waitFor(() => {
                const saveResult = findSaveResult('Goblin');
                expect(saveResult).toMatchObject({
                    success: false,
                    roll: 9,
                    total: 9,
                    saveBonus: 0,
                    saveDc: 12,
                    saveType: 'CON',
                });
            });
            const conditionCalls = activeConditionsCalls('Goblin');
            expect(conditionCalls).toHaveLength(1);
            expect(conditionCalls[0][2]).toContain('blinded');
        } finally {
            randomSpy.mockRestore();
        }
    });

    it('rolls an unheightened target once and applies no condition on a successful save', async () => {
        // Single roll 20 + 0 ≥ DC 12 → success. (Same mock value would also pass a
        // buggy double-roll, so this pins the success/negative path, not roll count.)
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95);
        try {
            render(<AOEConditionModal {...makeProps({ metamagicHeighten: true })} />);

            const rows = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(rows[0]); });
            await act(async () => {
                fireEvent.click(getApplyButton());
            });

            await waitFor(() => {
                const saveResult = findSaveResult('Goblin');
                expect(saveResult).toMatchObject({ success: true, roll: 20, total: 20 });
            });
            expect(activeConditionsCalls('Goblin')).toHaveLength(0);
        } finally {
            randomSpy.mockRestore();
        }
    });
});
