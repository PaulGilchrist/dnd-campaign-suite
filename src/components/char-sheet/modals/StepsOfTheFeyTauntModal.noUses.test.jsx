// Redundant tests removed: 6 tests covering skip button rendering,
// Misty Step skip button text (mode/title variants), and skip/overlay
// transitions to result view were already covered in render.test.jsx and
// integration.test.jsx with equal fidelity. The skip button and overlay
// behaviors do not depend on newCount, so testing them with newCount: 0
// adds no unique coverage.
//
// Kept (2 unique behavioral tests):
//   - "No uses remaining" message renders when newCount is 0
//   - All four step options are inert when newCount is 0
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';

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

describe('StepsOfTheFeyTauntModal - No Uses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('no uses remaining (newCount is 0)', () => {
        it('renders the no uses remaining message', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 0 })} />);
            expect(screen.getByText(/No uses remaining — finish a Long Rest to regain/)).toBeInTheDocument();
        });

        it('does not transition to any step confirmation when any option is clicked', () => {
            render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 0 })} />);
            const allOptionKeys = ['refreshing', 'taunting', 'disappearing', 'dreadful'];
            for (const key of allOptionKeys) {
                const option = screen.getByTestId(`step-option-${key}`);
                fireEvent.click(option);
                expect(screen.getByText(/Choose how you use/)).toBeInTheDocument();
            }
        });
    });
});
