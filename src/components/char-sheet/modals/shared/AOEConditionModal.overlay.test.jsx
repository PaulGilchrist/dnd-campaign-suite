//
// Consolidation analysis (2026-08-19):
//
// Removed 7 redundant/brittle tests whose behavior is already covered by
// AOEConditionModal.save-flow.test.jsx (same handler functions, same side effects):
//
//   1. "logs ability_use when handleApplyOverride is called via overlay"
//      → covered by save-flow.test.jsx "logs ability_use entry when targets are selected"
//   2. "calls storeSpellLastAttack when handleApplyOverride is invoked via overlay"
//      → covered by save-flow.test.jsx "calls storeSpellLastAttack when targets are selected"
//   3. "invokes handleApplyOverride with correct context from overlay"
//      → brittle: asserts internal ctx.selected Set contents and function-typed props
//         breaks on structural changes to the context object shape
//      → covered by save-flow.test.jsx normal-path handler tests
//   4. "invokes handleSaveResultOverride capture for success path"
//      → covered by save-flow.test.jsx "applies blinded when player fails save via save-result event"
//         (success path: save_result logged, addTargetResult called, persistAndNotify called)
//   5. "invokes handleSaveResultOverride capture for failure path"
//      → covered by save-flow.test.jsx "does not apply condition when player passes save"
//         (failure path: condition applied, save_result logged, addTargetResult called)
//   6. "handleSaveResultOverride does nothing with missing promptId"
//      → covered by save-flow.test.jsx "handles save-result event with missing optional fields"
//   7. "handleSaveResultOverride does nothing with non-matching promptId"
//      → covered by save-flow.test.jsx "handles save-result event with missing optional fields"
//
// Kept 1 test (unique behavioral coverage):
//   - "renders AreaEffectTargetModalBase when player is overlay targeted"
//     → verifies the early-return render path (line 638-659 of AOEConditionModal.jsx)
//        that switches to AreaEffectTargetModalBase when targetName starts with 'overlay-'
//
import { render, screen } from '@testing-library/react';
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

vi.mock('./AreaEffectTargetModalBase.jsx', () => ({
    default: function MockAreaEffectTargetModalBase(props) {
        return (
            <div data-testid="area-effect-target-modal-base">
                <div data-testid="feature-name">{props.featureName}</div>
                <div data-testid="save-type">{props.saveType}</div>
                <div data-testid="save-dc">{props.saveDc}</div>
                <button
                    data-testid="apply-btn"
                    onClick={() => {
                        const ctx = {
                            selected: new Set(['Goblin']),
                            setProcessing: () => {},
                            setResults: () => {},
                            setPendingPrompts: () => {},
                        };
                        if (props.handleApplyOverride) props.handleApplyOverride(ctx);
                    }}
                    type="button"
                >
                    Apply
                </button>
            </div>
        );
    },
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
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

// ── Tests ──

describe('AOEConditionModal Overlay', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    describe('overlay targeting path', () => {
        it('renders AreaEffectTargetModalBase when player is overlay targeted with active overlay', () => {
            render(<AOEConditionModal {...makeProps({
                playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
                activeOverlay: { name: 'TestOverlay' },
            })} />);
            expect(screen.getByTestId('area-effect-target-modal-base')).toBeInTheDocument();
            expect(screen.getByTestId('feature-name')).toHaveTextContent('Blinding Darkness');
            expect(screen.getByTestId('save-type')).toHaveTextContent('CON');
            expect(screen.getByTestId('save-dc')).toHaveTextContent('12');
        });
    });
});
