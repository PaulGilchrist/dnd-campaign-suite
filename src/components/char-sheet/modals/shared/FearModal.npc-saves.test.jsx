// @maintained-by-ai
// FearModal NPC save-resolution lane (auto-roll at confirm): failure, success,
// Heightened Spell disadvantage, Careful Spell auto-success, and condition dedup.
// Player save resolution lives in FearModal.player-saves.test.jsx, aura suppression
// in FearModal.aura-immunity.test.jsx, rendering/selection in FearModal.test.jsx —
// not repeated here.
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
import { addEntry } from '../../../../services/ui/logService.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

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

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
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
const fearEffectWrites = () =>
    setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects' && c[0] === 'campaign')
        .flatMap(c => c[2]).filter(e => e?.effect === 'fear_end_on_los');

// Select target row 0 (Goblin), optionally mark it Heightened, and click confirm.
async function selectAndConfirm({ heighten = false, props = {} } = {}) {
    render(<FearModal {...makeProps(props)} />);
    const labels = document.querySelectorAll('.secondary-target-row');
    await act(async () => { fireEvent.click(labels[0]); });
    if (heighten) {
        const radio = labels[0].querySelector('input[name="heightenTarget"]');
        await act(async () => { fireEvent.click(radio); });
    }
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Bane \(1\)/ }));
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('FearModal NPC saves', () => {
    it('failed NPC save applies frightened with expiration and fear tracking, and logs cast, failure, and target result', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // natural 1 + 0 = 1 < DC 14
        try {
            await selectAndConfirm();

            // Save-result failure is logged last — once it lands, every
            // state write and log in the failure branch has completed.
            await waitFor(() => {
                expect(entriesOf(e =>
                    e.type === 'save_result' && e.targetName === 'Goblin' && e.success === false
                ).length).toBeGreaterThan(0);
            });

            expect(conditionWritesFor('Goblin')[0][2]).toEqual(['frightened']);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Wizard1',
                targetName: 'Goblin',
                effects: [{ type: 'condition', condition: 'frightened' }],
                campaignName,
            });

            const fearEffect = fearEffectWrites().find(e => e.target === 'Goblin');
            expect(fearEffect).toMatchObject({
                source: 'Wizard1',
                effect: 'fear_end_on_los',
                condition: 'frightened',
                dc: 14,
                duration: 'concentration',
            });

            expect(entriesOf(e =>
                e.type === 'ability_use' && e.characterName === 'Wizard1' && e.abilityName === 'Bane'
            ).length).toBeGreaterThan(0);
            expect(entriesOf(e =>
                e.type === 'condition' && e.action === 'applied' && e.characterName === 'Goblin' && e.condition === 'Frightened'
            ).length).toBeGreaterThan(0);
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
                saveResult: 'failure',
                conditions: ['frightened'],
            }));
        } finally {
            Math.random.mockRestore();
        }
    });

    it('heightened spell target NPC rolls with disadvantage — min of two d20s fails where the first roll would have succeeded', async () => {
        // Disadvantage draws min(20, 2) = 2 + 0 < DC 14. Without the heighten
        // flag reaching rollNpcSave, the single first draw (20) would succeed.
        vi.spyOn(Math, 'random').mockReturnValueOnce(0.95).mockReturnValueOnce(0.05).mockReturnValue(0.95);
        try {
            await selectAndConfirm({ heighten: true, props: { metamagicHeighten: true } });

            await waitFor(() => {
                const entries = entriesOf(e =>
                    e.type === 'save_result' && e.targetName === 'Goblin' && e.success === false
                );
                expect(entries.length).toBeGreaterThan(0);
                expect(entries[0]).toMatchObject({ roll: 2, total: 2, saveBonus: 0 });
            });

            expect(conditionWritesFor('Goblin')[0][2]).toContain('frightened');
            expect(fearEffectWrites().some(e => e.target === 'Goblin')).toBe(true);
        } finally {
            Math.random.mockRestore();
        }
    });

    it('successful NPC save applies no frightened leg and logs the success', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99); // natural 20 + 0 >= DC 14
        try {
            await selectAndConfirm();

            await waitFor(() => {
                expect(entriesOf(e =>
                    e.type === 'save_result' && e.targetName === 'Goblin' && e.success === true
                ).length).toBeGreaterThan(0);
            });

            expect(entriesOf(e =>
                e.type === 'save_result' && e.targetName === 'Goblin'
            )[0].description).toContain('succeeded on CHA save (DC 14, rolled 20 + 0 = 20)');
            expect(conditionWritesFor('Goblin')).toHaveLength(0);
            expect(addExpiration).not.toHaveBeenCalled();
            expect(fearEffectWrites()).toHaveLength(0);
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
                saveResult: 'success',
                conditions: [],
            }));
        } finally {
            Math.random.mockRestore();
        }
    });

    it('careful spell protected NPC auto-succeeds despite rolling a natural 1', async () => {
        getAllyList.mockReturnValue(['Goblin']);
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // natural 1 — unprotected would frighten
        try {
            await selectAndConfirm({ props: { metamagicCareful: true } });

            await waitFor(() => {
                expect(entriesOf(e =>
                    e.type === 'save_result' && e.targetName === 'Goblin'
                ).length).toBeGreaterThan(0);
            });

            const saveEntry = entriesOf(e =>
                e.type === 'save_result' && e.targetName === 'Goblin'
            )[0];
            expect(saveEntry.success).toBe(true);
            expect(saveEntry.description).toContain('Careful Spell protected');
            expect(conditionWritesFor('Goblin')).toHaveLength(0);
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
                saveResult: 'success',
                conditions: [],
            }));
        } finally {
            Math.random.mockRestore();
        }
    });

    it('failed save on an already-frightened NPC writes exactly one frightened entry', async () => {
        // activeConditions canonically stores lowercase condition strings.
        getRuntimeValue.mockImplementation((key, category) =>
            category === 'activeConditions' && key === 'Goblin' ? ['frightened'] : []);
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        try {
            await selectAndConfirm();

            await waitFor(() => {
                expect(conditionWritesFor('Goblin').length).toBeGreaterThan(0);
            });

            expect(conditionWritesFor('Goblin')[0][2]).toEqual(['frightened']);
        } finally {
            Math.random.mockRestore();
        }
    });
});
