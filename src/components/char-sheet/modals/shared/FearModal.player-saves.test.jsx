// @maintained-by-ai
// FearModal player-save lane: prompt issuance, per-target save-result routing,
// failed/success save resolution, missing-field defaults, and Careful Spell
// player auto-success. NPC auto-roll lives in FearModal.npc-saves.test.jsx,
// aura suppression in FearModal.aura-immunity.test.jsx, rendering/selection in
// FearModal.test.jsx — not repeated here.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FearModal from './FearModal.jsx';

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

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Bane',
    automation: { type: 'bane' },
};

// Two PCs so multi-target prompt routing is exercised:
// PlayerAlly (row 2) and SecondPC (row 3) in the rendered target list.
const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
        { name: 'SecondPC', type: 'player', currentHp: 20, maxHp: 20, saveBonuses: { cha: 3 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CHA',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

const entriesOf = (filter) => addEntry.mock.calls.map(c => c[1]).filter(filter);
const conditionWritesFor = (name) =>
    setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions' && c[0] === name);
const savePromptCalls = () => vi.mocked(sendSavePrompt).mock.calls.map(c => c[1]);

// Cast at the target rows with the given indices; returns the issued save
// prompts ({promptId, targetName}) in row order. Pass expectedPrompts: 0
// when the cast should issue no prompts (e.g. Careful Spell auto-success).
async function castAtRows(indices, { expectedPrompts = indices.length, ...props } = {}) {
    render(<FearModal {...makeProps(props)} />);
    const labels = document.querySelectorAll('.secondary-target-row');
    for (const i of indices) {
        await act(async () => { fireEvent.click(labels[i]); });
    }
    const confirmLabel = new RegExp(`Bane \\(${indices.length}\\)`);
    await waitFor(() => {
        expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: confirmLabel }));
    });
    await waitFor(() => {
        expect(savePromptCalls()).toHaveLength(expectedPrompts);
    });
    return savePromptCalls();
}

async function triggerSaveResult(promptId, detail = {}) {
    await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId, success: false, roll: 5, total: 6, saveBonus: 1, ...detail },
        }));
    });
}

// getRuntimeValue('campaign','pendingSaveListenerPrompts') feeds the tracked
// prompt list; make it stateful so multi-prompt tracking accumulates faithfully.
let trackedPromptIds;

beforeEach(() => {
    vi.resetAllMocks();
    trackedPromptIds = [];
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getAllyList.mockReturnValue(null);
    setRuntimeValue.mockImplementation((key, category, value) => {
        if (key === 'campaign' && category === 'pendingSaveListenerPrompts') {
            trackedPromptIds = [...value];
        }
    });
    getRuntimeValue.mockImplementation((key, category) => {
        if (key === 'campaign' && category === 'pendingSaveListenerPrompts') {
            return trackedPromptIds;
        }
        return [];
    });
    addEntry.mockResolvedValue(undefined);
});

describe('FearModal player saves', () => {
    it('queues a tracked save prompt per player target, logs the cast, and nothing resolves before the players roll', async () => {
        const onClose = vi.fn();
        const prompts = await castAtRows([2, 3], { onClose });

        // One prompt per player, each addressed to the right target, from the caster.
        expect(prompts.map(p => p.targetName)).toEqual(['PlayerAlly', 'SecondPC']);
        expect(prompts.every(p => p.promptId)).toBe(true);
        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            saveType: 'CHA',
            saveDc: 14,
            sourceName: 'Wizard1',
        }));

        // Prompt ids are tracked in the campaign runtime store for cross-tab routing.
        expect(trackedPromptIds).toEqual(expect.arrayContaining(prompts.map(p => p.promptId)));

        expect(entriesOf(e =>
            e.type === 'ability_use' && e.characterName === 'Wizard1' && e.abilityName === 'Bane'
        ).length).toBe(1);

        // Cast is persisted even while the players' saves are still pending…
        expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);
        // …but nothing is resolved yet: no conditions, no save-result logs.
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(conditionWritesFor('SecondPC')).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(entriesOf(e => e.type === 'save_result')).toHaveLength(0);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('routes each save-result to its own target and closes only after the final prompt resolves', async () => {
        const onClose = vi.fn();
        const prompts = await castAtRows([2, 3], { onClose });

        // First PC fails: frightened lands on that PC only, modal stays open.
        await triggerSaveResult(prompts[0].promptId, {
            roll: 5, total: 6, saveBonus: 1,
        });
        expect(conditionWritesFor('PlayerAlly')[0][2]).toContain('frightened');
        expect(conditionWritesFor('SecondPC')).toHaveLength(0);
        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            saveResult: 'failure',
            conditions: ['frightened'],
        }));
        expect(onClose).not.toHaveBeenCalled();

        // Second PC succeeds: no condition for it; the final resolution schedules close.
        await triggerSaveResult(prompts[1].promptId, {
            success: true, roll: 18, total: 21, saveBonus: 3,
        });
        expect(conditionWritesFor('SecondPC')).toHaveLength(0);
        expect(entriesOf(e =>
            e.type === 'save_result' && e.targetName === 'SecondPC' && e.success === true
        ).length).toBe(1);

        // The prompt is dropped and close is scheduled shortly after the last resolution.
        await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
        }, { timeout: 1500 });
    });

    it('failed save applies frightened, expiration, and fear tracking, defaults missing roll fields to 0, and logs the full failure chain', async () => {
        const { promptId } = (await castAtRows([2]))[0];

        // Detail omits roll/total/saveBonus — they must default to 0, not crash or leak undefined.
        await triggerSaveResult(promptId, { roll: undefined, total: undefined, saveBonus: undefined });

        await waitFor(() => {
            expect(conditionWritesFor('PlayerAlly')[0][2]).toEqual(['frightened']);
        });
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Wizard1',
            targetName: 'PlayerAlly',
            effects: [{ type: 'condition', condition: 'frightened' }],
            campaignName,
        });

        const fearEffect = setRuntimeValue.mock.calls
            .filter(c => c[1] === 'targetEffects' && c[0] === 'campaign')
            .flatMap(c => c[2])
            .find(e => e?.effect === 'fear_end_on_los');
        expect(fearEffect).toMatchObject({
            target: 'PlayerAlly',
            source: 'Wizard1',
            condition: 'frightened',
            dc: 14,
            duration: 'concentration',
        });

        const saveEntry = entriesOf(e =>
            e.type === 'save_result' && e.targetName === 'PlayerAlly' && e.success === false
        )[0];
        expect(saveEntry).toMatchObject({ roll: 0, total: 0, saveBonus: 0 });
        expect(saveEntry.description).toContain('PlayerAlly failed CHA save (DC 14, rolled 0 = 0)');

        expect(entriesOf(e =>
            e.type === 'condition' && e.action === 'applied' && e.characterName === 'PlayerAlly' && e.condition === 'Frightened'
        ).length).toBeGreaterThan(0);

        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            saveResult: 'failure',
            roll: 0,
            total: 0,
            conditions: ['frightened'],
            appliedDamage: 0,
        }));
    });

    it('successful player save logs success, records a clean target result, and applies no frightened legs', async () => {
        const { promptId } = (await castAtRows([2]))[0];

        await triggerSaveResult(promptId, { success: true, roll: 18, total: 19, saveBonus: 1 });

        await waitFor(() => {
            expect(entriesOf(e =>
                e.type === 'save_result' && e.targetName === 'PlayerAlly' && e.success === true
            ).length).toBeGreaterThan(0);
        });
        expect(entriesOf(e =>
            e.type === 'save_result' && e.targetName === 'PlayerAlly'
        )[0].description).toContain('PlayerAlly succeeded on CHA save (DC 14, rolled 18 + 1 = 19)');

        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            saveResult: 'success',
            conditions: [],
        }));

        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('careful spell protected player is skipped entirely — no prompt, no condition, no save logging', async () => {
        getAllyList.mockReturnValue(['PlayerAlly']);

        await castAtRows([2], { expectedPrompts: 0, metamagicCareful: true });

        // Protected player is never prompted and never carries any save residue.
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'PlayerAlly', 'activeConditions', expect.anything(), expect.anything());
        expect(addExpiration).not.toHaveBeenCalled();
        expect(entriesOf(e => e.type === 'save_result')).toHaveLength(0);
        // The cast itself still completes and persists.
        expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);
    });

    it('ignores save-result events with no detail or an unknown promptId', async () => {
        const onClose = vi.fn();
        await castAtRows([2], { onClose });

        for (const detail of [null, { promptId: 'unknown-prompt-id', success: false }]) {
            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail }));
            });
        }

        expect(addTargetResult).not.toHaveBeenCalled();
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(onClose).not.toHaveBeenCalled();
    });
});
