// @maintained-by-ai
// HypnoticPatternModal NPC-save lane: local NPC save resolution (conditions,
// expiry, result logging, persist), stubbing rollNpcSave at its seam so the
// fail/pass branch is driven deterministically without Math.random games.
// Overlay/unmount guard lives in .advanced.test.jsx, player save resolution in
// .player-saves.test.jsx, careful/heighten metamagic in .metamagic.test.jsx
// (incl. the heighten disadvantage A/B), SP-069 latch in .sp069.test.jsx,
// empty-state disabled Confirm in CreatureSelectionModal.test.jsx.
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

// Stub rollNpcSave at its seam: NPC fail/pass branch driven explicitly, no
// Math.random roulette. Everything else in the shared save flow stays real,
// so condition application, logging, and result recording are verified.
// Mutable shared config (not vi.fn state) so tests can arm outcomes AFTER
// the beforeEach resetAllMocks.
const npcSaveStub = vi.hoisted(() => ({ outcomes: [] }));
vi.mock('./AreaEffectSaveFlow.utils.js', async () => {
    const actual = await vi.importActual('./AreaEffectSaveFlow.utils.js');
    return {
        ...actual,
        rollNpcSave: (target, _saveType, _saveDc) => {
            const outcome = npcSaveStub.outcomes.shift();
            if (!outcome) throw new Error(`unexpected NPC save roll for ${target?.name} (no outcome queued)`);
            const { success, roll, bonus = 0 } = outcome;
            const total = roll + bonus;
            return { saveBonus: bonus, saveRoll: roll, saveTotal: total, success };
        },
    };
});

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

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

async function selectAndConfirm(indices) {
    const labels = document.querySelectorAll('.secondary-target-row');
    for (const i of indices) {
        await act(async () => { fireEvent.click(labels[i]); });
    }
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`Hypnotic Pattern \\(${indices.length}\\)`) }));
    });
}

const conditionWritesFor = (name) =>
    setRuntimeValue.mock.calls.filter(call => call[0] === name && call[1] === 'activeConditions');

const saveResultLogs = () =>
    addEntry.mock.calls.filter(call => call[1]?.type === 'save_result');

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
    npcSaveStub.outcomes = [];
});

describe('HypnoticPatternModal - NPC Saves', () => {
    it('resolves a failed NPC save locally: merges the exact conditions, schedules expiry, logs the roll, and persists without prompting', async () => {
        // Goblin arrives already charmed plus an unrelated condition: re-cast must
        // dedupe charmed and preserve unrelated conditions.
        getRuntimeValue.mockReturnValue(['stunned', 'charmed']);
        npcSaveStub.outcomes = [{ success: false, roll: 1, bonus: 0 }]; // 1 + 0 < DC 14

        render(<HypnoticPatternModal {...makeProps()} />);
        await selectAndConfirm([0]);

        await waitFor(() => {
            expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);
        });

        const writes = conditionWritesFor('Goblin');
        expect(writes).toHaveLength(1);
        expect(writes[0][2]).toEqual(['stunned', 'charmed', 'incapacitated', 'speed_zero']);

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Wizard1',
            targetName: 'Goblin',
            effects: [
                { type: 'charmed', condition: 'charmed' },
                { type: 'incapacitated', condition: 'incapacitated' },
                { type: 'speed_zero', condition: 'speed_zero' },
            ],
            campaignName,
        });

        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Goblin',
            saveResult: 'failure',
            roll: 1,
            total: 1,
            conditions: ['charmed', 'incapacitated', 'speed_zero'],
        }));

        expect(saveResultLogs()).toHaveLength(1);
        expect(saveResultLogs()[0][1]).toEqual(expect.objectContaining({
            characterName: 'Wizard1',
            targetName: 'Goblin',
            saveDc: 14,
            saveType: 'WIS',
            success: false,
            roll: 1,
            total: 1,
            saveBonus: 0,
            description: expect.stringContaining('failed WIS save (DC 14, rolled 1 + 0 = 1)'),
        }));

        // NPCs never receive save prompts — resolution is local.
        expect(sendSavePrompt).not.toHaveBeenCalled();
    });

    it('resolves each NPC against its own roll: the failing target is charmed, the passing target is untouched', async () => {
        npcSaveStub.outcomes = [
            { success: false, roll: 1, bonus: 0 },  // Goblin: 1 + 0 = 1 < DC 14 → fails
            { success: true, roll: 12, bonus: 2 },   // Orc: 12 + 2 = 14 = DC 14 → succeeds (bonus matters)
        ];

        render(<HypnoticPatternModal {...makeProps()} />);
        await selectAndConfirm([0, 1]);

        await waitFor(() => {
            expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);
        });

        const goblinWrites = conditionWritesFor('Goblin');
        expect(goblinWrites).toHaveLength(1);
        expect(goblinWrites[0][2]).toEqual(['charmed', 'incapacitated', 'speed_zero']);

        expect(conditionWritesFor('Orc')).toHaveLength(0);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Goblin' }));

        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Goblin',
            saveResult: 'failure',
        }));
        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Orc',
            saveResult: 'success',
            roll: 12,
            total: 14,
            conditions: [],
        }));

        const logs = saveResultLogs();
        expect(logs).toHaveLength(2);
        expect(logs.map(call => [call[1].targetName, call[1].success])).toEqual([
            ['Goblin', false],
            ['Orc', true],
        ]);
        expect(logs[1][1].description).toContain('succeeded on WIS save (DC 14, rolled 12 + 2 = 14)');

        expect(sendSavePrompt).not.toHaveBeenCalled();
    });
});
