// @maintained-by-ai
// HypnoticPatternModal unique lanes: the overlay-target guard and
// unmount-safety while a player save prompt is pending. NPC save resolution
// lives in .npc-saves.test.jsx, player save resolution in .player-saves.test.jsx,
// careful/heighten metamagic in .metamagic.test.jsx, SP-069 latch in .sp069.test.jsx.
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HypnoticPatternModal from './HypnoticPatternModal.jsx';

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

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { wis: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { wis: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

function playerAllyConditionWrites() {
    return setRuntimeValue.mock.calls.filter(
        call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('HypnoticPatternModal - Advanced', () => {
    it('renders nothing when overlay-targeted with an active overlay, and falls back to the selection UI otherwise', () => {
        const overlayTargeted = { ...basePlayerStats, targetName: 'overlay-123' };

        const { container: guarded } = render(<HypnoticPatternModal {...makeProps({
            playerStats: overlayTargeted,
            activeOverlay: { name: 'TestOverlay' },
        })} />);
        expect(guarded.children.length).toBe(0);

        // Second half of the && guard: overlay-targeted but no active overlay
        // must still render the full creature-selection lane.
        cleanup();
        render(<HypnoticPatternModal {...makeProps({ playerStats: overlayTargeted })} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Hypnotic Pattern \(0\)/ })).toBeDisabled();
        expect(document.querySelector('.secondary-target-list').textContent).toContain('PlayerAlly');
    });

    it('detaches the save-result listener on unmount so late events neither throw nor apply conditions', async () => {
        const { unmount } = render(<HypnoticPatternModal {...makeProps()} />);

        // Send a save prompt to the player target and leave it pending.
        const labels = document.querySelectorAll('.secondary-target-row');
        fireEvent.click(labels[2]); // PlayerAlly
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
        });
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        const promptId = sendSavePrompt.mock.calls[0][1].promptId;

        unmount();

        // Late save-result for the abandoned prompt must be inert:
        // the listener cleanup must have detached it.
        expect(() => {
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId, success: false, roll: 3, total: 4, saveBonus: 1 },
            }));
        }).not.toThrow();
        expect(playerAllyConditionWrites()).toHaveLength(0);
    });
});
