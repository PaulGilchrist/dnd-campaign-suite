import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// CLA-053: confirm arms ONE merged 1-minute expiry clock (rounds = 10) riding
// the same setRuntimeObject as te buff + bond target (§39 merged writes);
// save-success cancels that queue entry.
vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    KEY: 'pendingExpirations',
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(() => null),
    loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    setRuntimeObject: vi.fn(),
    clearRuntimeState: vi.fn(),
}));

import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

const baseProps = {
    action: { name: 'Clairvoyant Combatant' },
    playerStats: { name: 'HexWarlock', level: 14 },
    campaignName: 'test-campaign',
    targetName: 'Bandit 1',
    saveType: 'WIS',
    saveDc: 16,
    currentUses: 0,
    maxUses: 1,
    pactSlotLevel: 0,
    pactSlotsAvailable: false,
    pactMagicRecharge: false,
    onClose: vi.fn(),
};

describe('CLA-053 ClairvoyantCombatantModal expiry clock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockImplementation(() => null);
        useRuntimeState.setRuntimeValue.mockImplementation(() => Promise.resolve());
        useRuntimeState.setRuntimeObject.mockImplementation(() => {});
    });

    it('confirm arms ONE queue entry: rounds=10, anchorless, merged effects trio', async () => {
        render(<ClairvoyantCombatantModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

        await waitFor(() => {
            expect(useRuntimeState.setRuntimeObject).toHaveBeenCalled();
        });
        const objCall = useRuntimeState.setRuntimeObject.mock.calls.find(c => c[0] === 'HexWarlock' && Array.isArray(c[1]?.pendingExpirations));
        expect(objCall).toBeDefined();
        const queue = objCall[1].pendingExpirations;
        expect(queue).toHaveLength(1);
        const entry = queue[0];
        expect(entry.expiryRounds).toBe(10); // 1_minute × 10 rounds (§5)
        expect(entry.expireOnCreatureName).toBeNull(); // anchorless (§38)
        expect(entry.appliedRound).toBe(1);
        expect(entry.target).toBe('HexWarlock');
        const types = entry.effects.map(e => e.type);
        expect(types).toEqual(expect.arrayContaining(['remove_target_effect', 'remove_active_buff', 'clear_runtime_value']));
        const teRemoval = entry.effects.find(e => e.type === 'remove_target_effect');
        expect(teRemoval.effectKey).toBe('clairvoyant_combatant');
        expect(teRemoval.target).toBe('Bandit 1');
        expect(objCall[1].clairvoyantCombatantTarget).toBe('Bandit 1');
        expect(objCall[1].activeBuffs).toContainEqual(expect.objectContaining({ effect: 'clairvoyant_combatant' }));
    });

    it('save-success cancels the armed clock + clears target/buff in one merged write', async () => {
        const queue = [{
            target: 'HexWarlock',
            effects: [{ type: 'remove_target_effect', effectKey: 'clairvoyant_combatant', source: 'Clairvoyant Combatant', target: 'Bandit 1' }],
            appliedRound: 1,
            expiryRounds: 10,
            expireOnCreatureName: null,
        }];
        useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [{ target: 'Bandit 1', source: 'Clairvoyant Combatant', effect: 'clairvoyant_combatant' }];
            if (key === 'HexWarlock' && prop === 'activeBuffs') return [{ name: 'Clairvoyant Combatant', effect: 'clairvoyant_combatant', target: 'Bandit 1' }];
            if (key === 'HexWarlock' && prop === 'pendingExpirations') return queue;
            return null;
        });

        render(<ClairvoyantCombatantModal {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: 'test-prompt-id', roll: 15, saveBonus: 0, total: 15, success: true },
        }));

        await waitFor(() => {
            const objCall = useRuntimeState.setRuntimeObject.mock.calls.find(
                c => c[0] === 'HexWarlock' && c[1]?.clairvoyantCombatantTarget === null
            );
            expect(objCall).toBeDefined();
            expect(objCall[1].pendingExpirations).toEqual([]);
            expect(objCall[1].activeBuffs).toEqual([]);
        });
    });
});
