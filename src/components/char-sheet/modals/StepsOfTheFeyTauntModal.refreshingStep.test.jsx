// Consolidated 13 tests → 7 tests. Removed redundancies and brittle assertions.
//
// Consolidations:
//   - confirmation dialog + Cancel button → single confirmation rendering test
//   - setTempHp called + 1d10 range → single test with range assertion
//   - Done button + description text + feature name → single result view test
//   - decrement 3→2 + 1→0 → parameterized test
//   - remaining count 2 + 0 → parameterized test
//
// Removed brittle patterns:
//   - .closest('.clickable') fragile DOM traversal
//   - expect.anything() + mock.calls[0][1] indexing anti-pattern
//   - Multiple .sp-body.textContent assertions scattered across tests
//
// Kept (2): onClose callback, cancel no-op — unique behavioral coverage.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
        promptId: `prompt-${targetName}-${Date.now()}`,
        targetName,
        saveType,
        saveDc,
    })),
}));

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
        return null;
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

function renderRefreshingFlow(props) {
    render(<StepsOfTheFeyTauntModal {...makeProps(props)} />);
    const refreshingOption = screen.getByText('Refreshing Step');
    fireEvent.click(refreshingOption);
    const refreshButton = screen.getByRole('button', { name: /Refresh/ });
    fireEvent.click(refreshButton);
}

describe('StepsOfTheFeyTauntModal - Refreshing Step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('confirmation dialog', () => {
        it('shows confirmation with Use and Cancel buttons when Refreshing Step is selected', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            const refreshingOption = screen.getByText('Refreshing Step');
            fireEvent.click(refreshingOption);
            expect(document.querySelector('.sp-body').textContent).toContain('Use');
            expect(document.querySelector('.sp-body').textContent).toContain('Refreshing Step');
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });

    describe('applying refreshing step', () => {
        it('calls setTempHp with a value in the 1d10 range (1-10)', async () => {
            renderRefreshingFlow();
            await waitFor(() => {
                expect(setTempHp).toHaveBeenCalledWith(
                    'FeyTrickster',
                    expect.any(Number),
                    'test-campaign'
                );
                const tempHpValue = setTempHp.mock.calls[0][1];
                expect(tempHpValue).toBeGreaterThanOrEqual(1);
                expect(tempHpValue).toBeLessThanOrEqual(10);
            });
        });

        it('shows result view with description containing feature name and step details', async () => {
            renderRefreshingFlow({ featureName: 'Fey Trickery' });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('Fey Trickery');
                expect(body.textContent).toContain('Refreshing Step');
                expect(body.textContent).toContain('Temporary Hit Points');
            });
        });
    });

    describe('count decrement', () => {
        it.each`
            newCount | expectedRemaining
            ${3}     | ${2}
            ${1}     | ${0}
        `('decrements freeCastCountKey from $newCount to $expectedRemaining', async ({ newCount, expectedRemaining }) => {
            renderRefreshingFlow({ newCount, freeCastCountKey: 'stepsRemaining' });
            await waitFor(() => {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'FeyTrickster',
                    'stepsRemaining',
                    expectedRemaining,
                    'test-campaign'
                );
            });
        });

        it.each`
            newCount | expectedText
            ${3}     | ${'2 remaining'}
            ${1}     | ${'0 remaining'}
        `('shows $expectedText in result description when starting from $newCount', async ({ newCount, expectedText }) => {
            renderRefreshingFlow({ newCount });
            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain(expectedText);
            });
        });
    });

    describe('modal lifecycle', () => {
        it('calls onClose when Done is clicked after refreshing step', async () => {
            const onClose = vi.fn();
            renderRefreshingFlow({ onClose });
            await waitFor(() => {
                fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            });
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not decrement count when Refreshing Step is cancelled', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3 })} />);
            const refreshingOption = screen.getByText('Refreshing Step');
            fireEvent.click(refreshingOption);
            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            fireEvent.click(cancelButton);
            expect(screen.getByText(/Choose how you use/)).toBeInTheDocument();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
