// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';

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

describe('StepsOfTheFeyTauntModal - Disappearing Step', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('disappearing step flow', () => {
        it('applies invisible condition and adds expiration when Disappear is clicked', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            const disappearingOption = screen.getByText('Disappearing Step').closest('.clickable');
            fireEvent.click(disappearingOption);
            const disappearButton = screen.getByRole('button', { name: /Disappear/ });
            fireEvent.click(disappearButton);

            await waitFor(() => {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'FeyTrickster',
                    'activeConditions',
                    expect.arrayContaining(['invisible']),
                    'test-campaign'
                );
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'FeyTrickster', targetName: 'FeyTrickster', effects: expect.arrayContaining([expect.objectContaining({ type: 'condition', condition: 'invisible' })]), campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'FeyTrickster' });
                const body = document.querySelector('.sp-body');
                expect(body.textContent).toContain('Disappearing Step');
                expect(body.textContent).toContain('Invisible condition');
                expect(body.textContent).toContain('2 remaining');
            });
        });

        it('refreshes expiration when invisible condition is already present', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((key, prop) => {
                if (prop === 'activeConditions' && key === 'FeyTrickster') return ['invisible'];
                return null;
            });

            render(<StepsOfTheFeyTauntModal {...makeProps()} />);
            const disappearingOption = screen.getByText('Disappearing Step').closest('.clickable');
            fireEvent.click(disappearingOption);
            const disappearButton = screen.getByRole('button', { name: /Disappear/ });
            fireEvent.click(disappearButton);

            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalled();
            });
        });

        it('decrements free cast count when freeCastCountKey is provided', async () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ freeCastCountKey: 'stepsRemaining' })} />);
            const disappearingOption = screen.getByText('Disappearing Step').closest('.clickable');
            fireEvent.click(disappearingOption);
            const disappearButton = screen.getByRole('button', { name: /Disappear/ });
            fireEvent.click(disappearButton);

            await waitFor(() => {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'FeyTrickster',
                    'stepsRemaining',
                    2,
                    'test-campaign'
                );
            });
        });
    });
});
