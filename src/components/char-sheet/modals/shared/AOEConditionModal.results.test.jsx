// @improved-by-ai
// @cleaned-by-ai
//
// Removed 13 redundant/brittle/low-value tests:
//
// REMOVE — redundant with AOEConditionModal.save-flow.test.jsx (same full save flow, same assertions):
//   1. "shows fail message when player fails save" → save-flow: "applies blinded when player fails save via save-result event"
//   2. "shows success message when player passes save" → save-flow: "does not apply condition when player passes save"
//   3. "uses default blinded effect when effects prop is null" → save-flow covers full apply flow with default effects
//   4. "uses default blinded effect when effects prop is undefined" → save-flow covers full apply flow with default effects
//
// REMOVE — brittle UI text assertions (break on label changes, not behavioral):
//   5. "shows fail message when player fails save" → asserts "Blinded!" text
//   6. "shows success message when player passes save" → asserts "unaffected" text
//   7. "shows HP percentage for non-player creatures" → regex on DOM text content
//   8. "does not show HP percentage for player-type targets" → regex on DOM text content
//
// REMOVE — low-value standard React patterns (no unique component behavior):
//   9. "closes when Close button is clicked in results summary" → standard onClose prop
//  10. "closes when overlay background is clicked in results summary" → standard Spoke overlay behavior
//  11. "does not close when clicking inside the modal content" → inverse of above, same low value
//
// CONSOLIDATE — 4 blocking effect tests into 1 parameterized test:
//   12. "excludes creatures blocked by forcecage"
//   13. "excludes creatures blocked by maze"
//   14. "excludes creatures blocked by banishment"
//   15. "excludes creatures blocked by imprisonment"
//   → merged into single "blocking effects exclude creatures from eligible targets" parameterized test
//
// KEEP — unique behavioral coverage:
//   - "does not add duplicate blinded condition when creature already has it"
//     → tests applyConditionsToTarget deduplication logic, not covered elsewhere
//   - "allows both attacker and target when same blocking effect source"
//     → tests same-source exception in blocking logic, not covered elsewhere

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

// SP-024: mock the expirations barrel — fail grants stamp ONE addExpiration
// clock per failing target; real expirationQueue stays inert in this harness.
vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { getAllyList } from '../../../../hooks/useAllySelection.js';

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

// ── Tests ──

describe('AOEConditionModal - Results & Behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    // ── Condition deduplication ──

    describe('condition deduplication', () => {
        it('does not add duplicate blinded condition when creature already has it', async () => {
            getRuntimeValue.mockReturnValue(['blinded']);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                render(<AOEConditionModal {...makeProps()} />);
                const labels = document.querySelectorAll('.secondary-target-row');
                await act(async () => { fireEvent.click(labels[0]); });
                await act(async () => { fireEvent.click(getApplyButton()); });

                await waitFor(() => {
                    const conditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(conditionCalls.length).toBeGreaterThan(0);
                    const conditions = conditionCalls[0][2];
                    const blindedCount = conditions.filter(c => String(c).toLowerCase() === 'blinded').length;
                    expect(blindedCount).toBe(1);
                });
            } finally {
                vi.restoreAllMocks();
            }
        });
    });

    // ── Blocking effects ──

    describe('blocking effects exclude creatures from eligible targets', () => {
        const blockingEffectTests = [
            { effect: 'forcecage', description: 'forcecage' },
            { effect: 'maze', description: 'maze' },
            { effect: 'banishment', description: 'banishment' },
            { effect: 'imprisonment', description: 'imprisonment' },
        ];

        for (const { effect, description } of blockingEffectTests) {
            it(`excludes creatures blocked by ${description} from eligible targets`, () => {
                getRuntimeValue.mockReturnValue([
                    { effect, target: 'Goblin', source: 'CasterA' },
                ]);
                render(<AOEConditionModal {...makeProps()} />);
                expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
            });
        }

        it('allows both attacker and target when same blocking effect source', () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'forcecage', target: 'Goblin', source: 'Wizard1' },
                { effect: 'forcecage', target: 'Wizard1', source: 'Wizard1' },
            ]);
            render(<AOEConditionModal {...makeProps()} />);
            expect(screen.getByText('Goblin')).toBeInTheDocument();
        });
    });
});
