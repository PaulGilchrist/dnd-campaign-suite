// Redundant tests removed (2):
//   - "renders the dreadful description with damage and save info" → already
//     covered in render.test.jsx:100 (initial step option descriptions include
//     "2d10 Psychic damage")
//   - "renders the save DC in the dreadful description" → already covered in
//     render.test.jsx:96-100 (description rendering with DC)
//
// Kept "shows result with correct remaining count after dreadful skip" because
// integration.test.jsx:120-127 tests the free-cast skip flow (handleFreeCastSkip),
// while this test covers the normal skip flow (handleSkip) — different code paths.
//
// 14 tests → 12 tests. 4 rendering tests kept for Dreadful-specific sub-view.
// 2 skip flow tests kept (no-targets result text + remaining count display).
// 7 confirmation flow tests kept (save listeners, logging, custom params,
// multi-target, no-targets guard).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
        promptId: `prompt-${targetName}`,
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

async function selectTargetByName(name) {
    const row = screen.getByText(name).closest('.secondary-target-row');
    if (!row) return null;
    await act(async () => { fireEvent.click(row); });
    const checkbox = row.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
    return row;
}

describe('StepsOfTheFeyTauntModal - Dreadful Step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('creature selection modal rendering', () => {
        it('shows CreatureSelectionModal when Dreadful Step is selected', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            expect(screen.getByText(/Dreadful Step: Select creatures/)).toBeInTheDocument();
        });

        it('renders Dreadful button with brain icon in creature selection modal', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            expect(screen.getByRole('button', { name: /Dreadful/ })).toBeInTheDocument();
        });

        it('renders Skip button in dreadful creature selection modal', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });

        it('disables the Dreadful button when no targets are selected', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            expect(dreadfulButton).toBeDisabled();
        });
    });

    describe('skip flow', () => {
        it('skips dreadful step and shows result when Skip is clicked', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skip' })); });

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            });
            const body = document.querySelector('.sp-body');
            expect(body.textContent).toContain('No targets selected');
        });

        it('shows result with correct remaining count after dreadful skip', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3 })} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skip' })); });

            await waitFor(() => {
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('3 remaining');
            });
        });
    });

    describe('confirmation flow', () => {
        it('confirms targets and shows save prompt when Dreadful is clicked', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await selectTargetByName('Goblin1');

            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            await act(async () => { fireEvent.click(dreadfulButton); });

            await waitFor(() => {
                expect(createSaveListener).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        targetName: 'Goblin1',
                        saveType: 'WIS',
                        saveDc: 14,
                    })
                );
            });
        });

        it('logs ability_use entry when dreadful is confirmed', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await selectTargetByName('Goblin1');

            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            await act(async () => { fireEvent.click(dreadfulButton); });

            await waitFor(() => {
                expect(addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'FeyTrickster',
                        abilityName: 'Steps of the Fey',
                    })
                );
            });
        });

        it('creates save prompts for multiple selected targets', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await selectTargetByName('Goblin1');
            await selectTargetByName('Orc1');

            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            await act(async () => { fireEvent.click(dreadfulButton); });

            await waitFor(() => {
                expect(createSaveListener).toHaveBeenCalledTimes(2);
                const calls = createSaveListener.mock.calls;
                expect(calls[0][1].targetName).toBe('Goblin1');
                expect(calls[1][1].targetName).toBe('Orc1');
                expect(calls[0][1].saveType).toBe('WIS');
                expect(calls[1][1].saveType).toBe('WIS');
            });
        });

        it('does not call Dreadful when no targets are selected', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });

            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            await act(async () => { fireEvent.click(dreadfulButton); });

            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('uses custom saveDc when provided', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ saveDc: 18 })} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await selectTargetByName('Goblin1');

            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            await act(async () => { fireEvent.click(dreadfulButton); });

            await waitFor(() => {
                expect(createSaveListener).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({ saveDc: 18 })
                );
            });
        });

        it('logs ability_use with custom featureName', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ featureName: 'Fey Trickery' })} />);
            await act(async () => { fireEvent.click(screen.getByText('Dreadful Step')); });
            await selectTargetByName('Goblin1');

            const dreadfulButton = screen.getByRole('button', { name: /Dreadful/ });
            await act(async () => { fireEvent.click(dreadfulButton); });

            await waitFor(() => {
                expect(addEntry).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        type: 'ability_use',
                        abilityName: 'Fey Trickery',
                    })
                );
            });
        });
    });
});
