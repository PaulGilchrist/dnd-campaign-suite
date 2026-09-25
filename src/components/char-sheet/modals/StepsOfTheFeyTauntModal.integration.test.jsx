// @improved-by-ai
// @cleaned-by-ai
// Redundant tests removed: 17 tests covering result view transitions, header
// rendering, result descriptions, overlay interactions, custom titles,
// skip button labels, multi-target save listeners, no-uses selection blocking,
// and Disappearing Step confirmation were all already covered with equal or
// greater fidelity in the step-specific test files (refreshingStep, tauntingStep,
// disappearingStep, dreadfulStep), render.test.jsx, and noUses.test.jsx.
//
// Kept (5 unique behavioral tests):
//   - overlay click in result view doesn't call onClose (cross-step modal behavior)
//   - overlay click in choice step doesn't call onClose (cross-step modal behavior)
//   - freeCastCountKey: null -> no setRuntimeValue call (unique free-cast flow)
//   - free cast skip remaining count display (unique free-cast flow)
//   - skip in taunting step with no targets -> result view (cross-step flow)
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((characterKey, propertyName, _campaignName) => {
        if (propertyName === 'activeConditions' && characterKey !== 'campaign') {
            return [];
        }
        if (propertyName === 'targetEffects' && characterKey === 'campaign') {
            return [];
        }
        return [];
    }),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

const basePlayerStats = { name: 'FeyTrickster' };
const baseTargets = [
    { name: 'Goblin1', currentHp: 5, maxHp: 7 },
    { name: 'Orc1', currentHp: 12, maxHp: 15 },
];

const baseProps = {
    mode: 'normal',
    title: 'Steps of the Fey',
    targets: baseTargets,
    action: { name: 'Steps of the Fey', automation: { type: 'class_feature' } },
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    saveDc: 14,
    featureName: 'Steps of the Fey',
    newCount: 3,
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function renderToResult() {
    const refreshingOption = screen.getByText('Refreshing Step');
    fireEvent.click(refreshingOption);
    const refreshButton = screen.getByRole('button', { name: /Refresh/ });
    fireEvent.click(refreshButton);
}

describe('StepsOfTheFeyTauntModal - Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('result view', () => {
        it('does not call onClose when modal content is clicked in result view', async () => {
            const onClose = vi.fn();
            render(<StepsOfTheFeyTauntModal {...makeProps({ onClose })} />);
            renderToResult();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
            const modal = document.querySelector('.sp-modal');
            fireEvent.click(modal);
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('overlay interactions', () => {
        it('does not call onClose or transition to result view when overlay is clicked in choice step', () => {
            const onClose = vi.fn();
            render(<StepsOfTheFeyTauntModal {...makeProps({ onClose })} />);
            const overlay = document.querySelector('.sp-overlay');
            fireEvent.click(overlay);
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByText(/Choose how you use/)).toBeInTheDocument();
        });
    });

    describe('free cast flow', () => {
        it('does not call setRuntimeValue when freeCastCountKey is null', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3, freeCastCountKey: null })} />);
            renderToResult();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('shows correct remaining count after free cast skip in mistyEscape mode', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ mode: 'mistyEscape', newCount: 3 })} />);
            const skipButton = screen.getByRole('button', { name: 'Misty Step only (free cast)' });
            fireEvent.click(skipButton);
            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('3 remaining');
            });
        });
    });

    describe('edge cases', () => {
        it('transitions to result view when skip is pressed in taunting step with no targets', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 5 })} />);
            const tauntingOption = screen.getByText('Taunting Step');
            fireEvent.click(tauntingOption);
            const skipButton = screen.getByRole('button', { name: 'Skip' });
            fireEvent.click(skipButton);
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
        });
    });
});
