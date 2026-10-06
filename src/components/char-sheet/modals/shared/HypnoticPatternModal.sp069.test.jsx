// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addEntry } from '../../../../services/ui/logService.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'DivinationWizard',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
};

const baseAction = {
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, saveBonuses: { wis: 0 } },
        { name: 'Bandit Captain 1', type: 'npc', currentHp: 52, maxHp: 52, saveBonuses: { wis: 3 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 19,
        onClose: vi.fn(),
        ...overrides,
    };
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('HypnoticPatternModal — SP-069', () => {
    it('describes the 30-foot Cube area from spell data (not 20-foot-radius sphere)', () => {
        render(<HypnoticPatternModal {...makeProps()} />);

        const text = document.body.textContent;
        expect(text).toContain('30-foot Cube');
        expect(text).not.toContain('20-foot-radius sphere');
    });

    it('confirm spends the save lane exactly once on repeated clicks (CLA-101 re-entry latch)', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // forced fail
        render(<HypnoticPatternModal {...makeProps()} />);

        const labels = document.querySelectorAll('.secondary-target-row');
        await act(async () => { fireEvent.click(labels[0]); });
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ })).toBeInTheDocument();
        });

        const confirmBtn = screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ });
        await act(async () => { fireEvent.click(confirmBtn); });
        await act(async () => { fireEvent.click(confirmBtn); });
        await act(async () => { fireEvent.click(confirmBtn); });

        await waitFor(() => {
            const abilityUseLogs = addEntry.mock.calls
                .map(c => c[1])
                .filter(e => e.type === 'ability_use' && e.abilityName === 'Hypnotic Pattern');
            expect(abilityUseLogs.length).toBe(1);
        });

        const conditionWrites = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'activeConditions' && call[0] === 'Bandit 1'
        );
        expect(conditionWrites.length).toBe(1);
    });
});
