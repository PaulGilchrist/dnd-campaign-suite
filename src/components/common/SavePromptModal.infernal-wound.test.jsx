// MA-0367 modal copy: a dc_success "full" save prompt (Infernal Glaive wound
// save) tells the player honestly that the damage stands in FULL regardless of
// the save — it never claims "half damage" or "no damage on a successful save",
// because this save gates only the wound. Every other row stays byte-identical.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (n) => n || 'Unknown', guid: () => 'g' } }));
vi.mock('../../services/dice/diceRoller.js', () => ({ rollD20: vi.fn(() => 15), rollExpression: vi.fn() }));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ sendSaveResult: vi.fn(), clearSavePrompt: vi.fn() }));
vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({ computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({ getAbilitySaveBonus: vi.fn(() => 3) }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({ getRuntimeValue: vi.fn(() => null), setRuntimeValue: vi.fn(), getStore: vi.fn(() => new Map()), useSyncedState: vi.fn(() => [null, vi.fn()]), listeners: new Map() }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn(() => null) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn(() => null) } }));
vi.mock('../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => []) }));
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isCircleOfPowerActive: vi.fn(() => false),
}));
vi.mock('./Subscriber.jsx', () => ({
    default: function MockSubscriber({ handleEvent, campaignName }) {
        const fire = (key, data) => () => handleEvent({ key: `change-${campaignName}-${key}`, data });
        return React.createElement('div', { 'data-testid': 'subscriber' },
            React.createElement('button', { 'data-testid': 'trigger-full', onClick: fire('savePrompt-fullTarget', { promptId: 'p-full', targetName: 'fullTarget', saveType: 'con', saveDc: 12, disadvantage: false, dcSuccess: 'full', sourceName: 'Infernal Glaive' }) }),
            React.createElement('button', { 'data-testid': 'trigger-half', onClick: fire('savePrompt-halfTarget', { promptId: 'p-half', targetName: 'halfTarget', saveType: 'dex', saveDc: 15, disadvantage: false, dcSuccess: 'half', sourceName: 'Fireball' }) }),
        );
    },
}));

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
afterEach(cleanupDefaults);

describe('MA-0367 dc_success "full" save prompt copy', () => {
    it('shows the honest "full damage regardless" note and NEVER a half/no-damage note', async () => {
        render(<SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
        fireEvent.click(screen.getByTestId('trigger-full'));

        await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());

        expect(screen.getByText(/full damage regardless/i)).toBeInTheDocument();
        expect(screen.queryByText(/half damage/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/no damage on successful save/i)).not.toBeInTheDocument();
    });

    it('a dc_success "half" row stays byte-identical (half-damage note, no "full" copy)', async () => {
        render(<SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
        fireEvent.click(screen.getByTestId('trigger-half'));

        await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());

        expect(screen.getByText(/half damage/i)).toBeInTheDocument();
        expect(screen.queryByText(/full damage regardless/i)).not.toBeInTheDocument();
    });
});
