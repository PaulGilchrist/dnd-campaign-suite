// @maintained-by-ai
// CLA-019: Aura of Courage — FearModal frightened-immunity lane.
// Two differential A/B tests, one per aura-checked leg of FearModal:
//   • player leg (save-result event): aura-covered PC suppressed, unprotected PC control still frightened
//   • NPC leg (auto-roll at confirm): aura-covered NPC suppressed, unprotected NPC control still frightened
// Suppression semantics: save still fails (save_result success:false), condition never lands
// (no activeConditions write, no addExpiration), and the suppression is logged exactly once
// via the condition_immunity_aura automation channel.
// Legacy unprotected flows are pinned in FearModal.player-saves/npc-saves.test.jsx — not repeated here.
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

// ElderPaladin hosts the party aura. Covered: PlayerAlly (player leg) and Orc (NPC leg).
// Uncovered controls: UnprotectedPC (player leg) and Goblin (NPC leg).
vi.mock('../../../../services/combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return {
        ...actual,
        getAuraConditionImmunities: vi.fn(async ({ targetName }) => (
            targetName === 'PlayerAlly' || targetName === 'Orc'
                ? { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } }
                : { immunities: [], immunitySources: {} }
        )),
    };
});

import { getCombatSummary } from '../../../../services/encounters/combatData.js';
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

// Aura host roster — the characters prop feeding the aura membership query.
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

// Select target rows by index, click confirm, return promptIds in row order.
async function selectRowsAndConfirm(indices) {
    render(<FearModal {...makeProps()} />);
    const labels = document.querySelectorAll('.secondary-target-row');
    for (const i of indices) {
        await act(async () => { fireEvent.click(labels[i]); });
    }
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Fear \(2\)/ })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Fear \(2\)/ }));
    });
    return vi.mocked(sendSavePrompt).mock.calls.map(c => c[1].promptId);
}

async function triggerSaveResult(promptId, success) {
    await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId, success, roll: 3, total: 5, saveBonus: 2 },
        }));
    });
}

const entriesOf = (filter) => addEntry.mock.calls.map(c => c[1]).filter(filter);
const immunityEntries = () => entriesOf(e => e.automationType === 'condition_immunity_aura');
const conditionWritesFor = (name) =>
    setRuntimeValue.mock.calls.filter(c => c[0] === name && c[1] === 'activeConditions');

function expectSuppressed(name) {
    expect(conditionWritesFor(name)).toHaveLength(0);
    expect(addExpiration.mock.calls.filter(c => c[0]?.targetName === name)).toHaveLength(0);
    // Save still fails and the failure is reported with no conditions attached.
    expect(entriesOf(e => e.type === 'save_result' && e.targetName === name && e.success === false)).toHaveLength(1);
    expect(addTargetResult.mock.calls.some(c =>
        c[1].targetName === name && c[1].saveResult === 'failure' && c[1].conditions.length === 0)).toBe(true);
}

function expectApplied(name) {
    const writes = conditionWritesFor(name);
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0][2]).toContain('frightened');
    expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'HexWarlock',
        targetName: name,
        effects: [{ type: 'condition', condition: 'frightened' }],
        campaignName,
    });
    // Player leg logs one condition-applied entry; the NPC leg logs one via
    // logConditionsFromSave plus the fail-summary note — assert the fact, not the count.
    expect(entriesOf(e =>
        e.type === 'condition' && e.action === 'applied' && e.characterName === name).length).toBeGreaterThan(0);
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
});

const baseCombatSummary = {
    creatures: [
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 2 } },
        { name: 'UnprotectedPC', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 0 } },
    ],
};

describe('FearModal — CLA-019 Aura of Courage', () => {
    it('player leg: covered PC has frightened suppressed and logged, unprotected control still frightened', async () => {
        const promptIds = await selectRowsAndConfirm([0, 1]); // PlayerAlly, UnprotectedPC
        expect(promptIds).toHaveLength(2);

        for (const promptId of promptIds) {
            await triggerSaveResult(promptId, false);
        }

        expectSuppressed('PlayerAlly');
        expectApplied('UnprotectedPC');

        // Suppression logged once, naming the aura and its host — and only for the covered target.
        const immunity = immunityEntries();
        expect(immunity).toHaveLength(1);
        expect(immunity[0].type).toBe('automation');
        expect(immunity[0].characterName).toBe('PlayerAlly');
        expect(immunity[0].description).toContain('PlayerAlly is immune to Frightened (Aura of Courage from ElderPaladin)');
    });

    it('NPC leg: covered NPC has frightened suppressed at confirm, unprotected control still frightened', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { wis: 0 } },
                { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { wis: 1 } },
            ],
        });
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // natural 1 — both NPC saves fail
        try {
            await selectRowsAndConfirm([0, 1]); // Goblin control, Orc covered

            await waitFor(() => {
                expect(immunityEntries().some(e => e.characterName === 'Orc')).toBe(true);
            });

            expectSuppressed('Orc');
            expectApplied('Goblin');

            // No save prompts on the NPC leg, and immunity logged only for the covered NPC.
            expect(sendSavePrompt).not.toHaveBeenCalled();
            expect(immunityEntries().map(e => e.characterName)).toEqual(['Orc']);
            expect(immunityEntries()[0].description).toContain('Orc is immune to Frightened (Aura of Courage from ElderPaladin)');
        } finally {
            Math.random.mockRestore();
        }
    });
});
