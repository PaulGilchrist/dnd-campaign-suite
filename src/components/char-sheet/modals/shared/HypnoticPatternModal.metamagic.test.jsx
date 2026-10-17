// @maintained-by-ai
// HypnoticPatternModal metamagic lane: Heightened Spell (note + radio wiring and
// the disadvantage roll on the marked target) and Careful Spell (ally badges,
// NPC auto-success resolution, player prompt skip). Overlay guard + teardown live
// in .advanced.test.jsx, plain NPC saves in .npc-saves.test.jsx, player saves in
// .player-saves.test.jsx, SP-069 latch in .sp069.test.jsx.
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
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
    addTargetResult: vi.fn().mockResolvedValue(undefined),
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

import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

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

function rowFor(name) {
    return [...document.querySelectorAll('.secondary-target-row')].find(row => row.textContent.includes(name));
}

function saveEntriesFor(name, success) {
    return addEntry.mock.calls
        .map(call => call[1])
        .filter(entry => entry?.type === 'save_result'
            && entry?.targetName === name
            && (success === undefined || entry.success === success));
}

function conditionWritesFor(name) {
    return setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions' && call[0] === name);
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('HypnoticPatternModal - Metamagic', () => {
    describe('Heightened Spell', () => {
        it('renders the heighten note and one Heighten radio per target only when metamagicHeighten is active', () => {
            const { unmount } = render(<HypnoticPatternModal {...makeProps({ metamagicHeighten: true })} />);
            expect(document.querySelector('.sp-note').textContent).toContain('Heightened Spell');
            expect(document.querySelector('.sp-note').textContent).toContain('one target will have disadvantage');
            expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(baseCombatSummary.creatures.length);

            unmount();
            render(<HypnoticPatternModal {...makeProps()} />);
            expect(document.querySelector('.sp-note').textContent).not.toContain('Heightened');
            expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
        });

        it('rolls the heighten-marked target with disadvantage — min of two d20s fails where the first draw alone would have succeeded', async () => {
            // Disadvantage draws min(20, 2) = 2 + 0 < DC 14. If the heighten pick
            // never reached rollNpcSave, the single first draw (20) would succeed.
            vi.spyOn(Math, 'random').mockReturnValueOnce(0.95).mockReturnValueOnce(0.05).mockReturnValue(0.95);
            render(<HypnoticPatternModal {...makeProps({ metamagicHeighten: true })} />);

            await act(async () => { fireEvent.click(rowFor('Goblin')); });
            await act(async () => { fireEvent.click(rowFor('Goblin').querySelector('input[name="heightenTarget"]')); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(1\)/ }));
            });

            await waitFor(() => {
                const entries = saveEntriesFor('Goblin', false);
                expect(entries.length).toBe(1);
                expect(entries[0]).toMatchObject({ roll: 2, total: 2, saveBonus: 0, saveDc: 14, saveType: 'WIS' });
            });
            expect(conditionWritesFor('Goblin')[0][2]).toEqual(expect.arrayContaining(['charmed', 'incapacitated', 'speed_zero']));
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
                saveResult: 'failure',
                conditions: ['charmed', 'incapacitated', 'speed_zero'],
            }));
        });
    });

    describe('Careful Spell', () => {
        it('badges exactly the ally targets as protected when metamagicCareful is active', () => {
            getAllyList.mockReturnValue(['PlayerAlly']);
            render(<HypnoticPatternModal {...makeProps({ metamagicCareful: true })} />);

            expect(rowFor('PlayerAlly').textContent).toContain('Careful Spell protected');
            expect(rowFor('Goblin').textContent).not.toContain('Careful Spell protected');
            expect(rowFor('Orc').textContent).not.toContain('Careful Spell protected');
        });

        it('resolves careful-protected targets without touching the save lanes: NPC logs an auto-success and is recorded, player gets no prompt, neither gains conditions', async () => {
            getAllyList.mockReturnValue(['Goblin', 'PlayerAlly']);
            render(<HypnoticPatternModal {...makeProps({ metamagicCareful: true })} />);

            await act(async () => { fireEvent.click(rowFor('Goblin')); });
            await act(async () => { fireEvent.click(rowFor('PlayerAlly')); });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Hypnotic Pattern \(2\)/ }));
            });

            await waitFor(() => {
                const npcEntries = saveEntriesFor('Goblin');
                expect(npcEntries.length).toBe(1);
                expect(npcEntries[0].success).toBe(true);
                expect(npcEntries[0].description).toContain('Careful Spell protected');
                expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    targetName: 'Goblin',
                    saveResult: 'success',
                    conditions: [],
                }));
            });

            // Careful-protected targets never enter the prompt/condition machinery.
            expect(sendSavePrompt).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'campaign',
                'pendingSaveListenerPrompts',
                expect.any(Array),
                campaignName,
            );
            expect(saveEntriesFor('PlayerAlly')).toHaveLength(0);
            expect(conditionWritesFor('Goblin')).toHaveLength(0);
            expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });
});
