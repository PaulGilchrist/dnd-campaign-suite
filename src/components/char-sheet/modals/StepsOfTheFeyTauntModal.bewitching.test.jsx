// CLA-037: Bewitching Magic rides the StepsOfTheFeyTauntModal in its own mode —
// unlimited free Misty Step confirm, never the 4-option chooser, never the
// Steps_of_the_Fey free-cast counter, and every resolution logs.
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
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

import { addEntry } from '../../../services/ui/logService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const baseProps = {
    mode: 'bewitchingMagic',
    title: 'Bewitching Magic',
    targets: [{ name: 'Bandit', currentHp: 999, maxHp: 999 }],
    action: { name: 'Bewitching Magic', automation: { type: 'bewitching_magic', casting_time: 'passive' } },
    playerStats: { name: 'HexWarlock' },
    campaignName: 'test-campaign',
    saveDc: 16,
    featureName: 'Bewitching Magic',
    unlimited: true,
    onClose: vi.fn(),
};

describe('StepsOfTheFeyTauntModal — Bewitching Magic mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the free-cast confirm without step options or uses gating', () => {
        render(<StepsOfTheFeyTauntModal {...baseProps} />);
        expect(screen.getByTestId('bewitching-free-cast-btn')).not.toBeNull();
        expect(screen.queryByTestId('step-option-dash')).toBeNull();
        expect(screen.queryByText(/No uses remaining/i)).toBeNull();
    });

    it('logs the free cast as an ability_use without touching the Steps counter', () => {
        render(<StepsOfTheFeyTauntModal {...baseProps} />);
        fireEvent.click(screen.getByTestId('bewitching-free-cast-btn'));

        const useEntry = addEntry.mock.calls.map(c => c[1]).find(e => e && e.type === 'ability_use');
        expect(useEntry).toBeDefined();
        expect(useEntry.description).toContain('Misty Step for free via Bewitching Magic');
        expect(useEntry.description).toContain('no spell slot consumed');
        expect(useEntry.freeCastsUnlimited).toBe(true);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(screen.getByText(/without expending a spell slot/i)).not.toBeNull();
    });

    it('logs a decline entry and closes when declined', () => {
        render(<StepsOfTheFeyTauntModal {...baseProps} />);
        fireEvent.click(screen.getByText('Decline'));

        const decline = addEntry.mock.calls.map(c => c[1]).find(e => e && e.automationDetail === 'bewitching_magic_declined');
        expect(decline).toBeDefined();
        expect(decline.characterName).toBe('HexWarlock');
        expect(baseProps.onClose).toHaveBeenCalled();
    });
});
