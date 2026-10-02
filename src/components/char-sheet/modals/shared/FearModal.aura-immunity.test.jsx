// CLA-019: Aura of Courage — FearModal legs suppress frightened for aura-covered
// targets (save still fails, condition never lands, suppression logged); unprotected
// control targets keep the legacy apply path.
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

// ElderPaladin hosts the party aura: PlayerAlly covered, Goblin unprotected control.
vi.mock('../../../../services/combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return {
        ...actual,
        getAuraConditionImmunities: vi.fn(async ({ targetName }) => (
            targetName === 'PlayerAlly'
                ? { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } }
                : { immunities: [], immunitySources: {} }
        )),
    };
});

import { getCombatSummary, } from '../../../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'HexWarlock',
    level: 14,
    proficiency: 5,
    abilities: [{ name: 'Charisma', bonus: 5 }],
};

const baseAction = {
    name: 'Fear',
    automation: { type: 'fear' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { wis: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { wis: 1 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 2 } },
    ],
};

const characters = [
    {
        name: 'ElderPaladin',
        computedStats: {
            automation: { passives: [
                { name: 'Aura of Protection' },
                { name: 'Aura of Courage', conditionImmunity: 'frightened' },
            ] },
        },
    },
];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 16,
        onClose: vi.fn(),
        characters,
        ...overrides,
    };
}

async function selectRowAndConfirm(index) {
    render(<FearModal {...makeProps()} />);
    const labels = document.querySelectorAll('.secondary-target-row');
    await act(async () => { fireEvent.click(labels[index]); });
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Fear \(1\)/ })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Fear \(1\)/ }));
    });
    const promptCall = vi.mocked(sendSavePrompt).mock.calls.at(-1);
    return promptCall ? promptCall[1].promptId : null;
}

async function triggerSaveResult(promptId, success, overrides = {}) {
    await act(async () => {
        const event = new CustomEvent('save-result', {
            detail: {
                promptId,
                success,
                roll: overrides.roll ?? 3,
                total: overrides.total ?? 5,
                saveBonus: overrides.saveBonus ?? 2,
            },
        });
        window.dispatchEvent(event);
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
});

describe('FearModal — CLA-019 Aura of Courage', () => {
    it('aura-covered PC save-fail: frightened suppressed, immunity logged, no applied log', async () => {
        const promptId = await selectRowAndConfirm(2); // PlayerAlly
        expect(promptId).toBeTruthy();

        await triggerSaveResult(promptId, false);

        const conditionWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'PlayerAlly' && c[1] === 'activeConditions');
        expect(conditionWrites).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();

        const immunity = addEntry.mock.calls.map(c => c[1]).filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0].type).toBe('automation');
        expect(immunity[0].characterName).toBe('PlayerAlly');
        expect(immunity[0].description).toContain('PlayerAlly is immune to Frightened (Aura of Courage from ElderPaladin)');

        expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);

        const targetResults = addTargetResult.mock.calls.map(c => c[1]);
        expect(targetResults.some(r => r.targetName === 'PlayerAlly' && r.saveResult === 'failure' && r.conditions.length === 0)).toBe(true);
    });

    it('unprotected PC control save-fail: frightened applied + condition-applied log (legacy path)', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                ...baseCombatSummary.creatures,
                { name: 'UnprotectedPC', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 0 } },
            ],
        });
        const promptId = await selectRowAndConfirm(3); // UnprotectedPC — outside the aura
        expect(promptId).toBeTruthy();

        await triggerSaveResult(promptId, false);

        const conditionWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'UnprotectedPC' && c[1] === 'activeConditions');
        expect(conditionWrites.length).toBeGreaterThan(0);
        expect(conditionWrites[0][2]).toContain('frightened');
        expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'condition' && e.action === 'applied')).toBe(true);
    });

    it('unprotected NPC control failed save: frightened still applied', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // force save fail
        try {
            await selectRowAndConfirm(0); // Goblin — outside the aura

            await waitFor(() => {
                const conditionWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'Goblin' && c[1] === 'activeConditions');
                expect(conditionWrites.length).toBeGreaterThan(0);
                expect(conditionWrites[0][2]).toContain('frightened');
            });
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'HexWarlock', targetName: 'Goblin', effects: [{ type: 'condition', condition: 'frightened' }], campaignName });
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        } finally {
            Math.random.mockRestore();
        }
    });
});
