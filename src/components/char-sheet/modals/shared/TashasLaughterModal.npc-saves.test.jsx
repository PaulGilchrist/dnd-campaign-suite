// @maintained-by-ai
// TashasLaughterModal NPC save-resolution lane (auto-roll at confirm): full failure
// effect set, clean success with close, mixed-confirm seam, condition dedup,
// targetEffects replacement, Heightened Spell disadvantage, and NPC-vs-player routing.
// Player save resolution lives in TashasLaughterModal.player-saves.test.jsx;
// rendering, selection, maxTargets, skip, and empty-state live in
// TashasLaughterModal.test.jsx — not repeated here.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TashasLaughterModal from './TashasLaughterModal.jsx';

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

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_hideous_laughter' },
};

// saveBonuses are read with fully-lowercase keys (rollNpcSave lowercases saveType).
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

const entriesOf = (filter) => addEntry.mock.calls.map(c => c[1]).filter(filter);
const saveResultsFor = (name) =>
    entriesOf(e => e.type === 'save_result' && e.targetName === name);
const conditionWritesFor = (name) =>
    setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions' && c[0] === name);
const targetEffectWrites = () =>
    setRuntimeValue.mock.calls
        .filter(c => c[1] === 'targetEffects' && c[0] === 'campaign')
        .map(c => c[2]);

// Route runtime reads by category so seeding does not depend on call order.
function routeRuntimeValues(valuesByCategory) {
    getRuntimeValue.mockImplementation((key, category) => {
        const value = valuesByCategory[category];
        return value !== undefined ? value : [];
    });
}

// Deterministic d20 draws consumed in target order (1 draw per NPC save without
// disadvantage, 2 with; issuePlayerSavePrompt also draws once per prompt id).
// The last seeded value repeats as a fallback so later draws never NaN.
function seedRolls(draws) {
    const seq = [...draws];
    vi.spyOn(Math, 'random').mockImplementation(() => (seq.length > 1 ? seq.shift() : seq[0]));
}

async function selectRows(indices) {
    for (const i of indices) {
        await act(async () => {
            fireEvent.click(document.querySelectorAll('.secondary-target-row')[i]);
        });
    }
}

async function clickConfirm() {
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Tasha's Hideous Laughter \(\d+\)/ })).toBeEnabled();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Tasha's Hideous Laughter \(\d+\)/ }));
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
});

describe('TashasLaughterModal NPC saves', () => {
    it('failed NPC save applies Prone + Incapacitated with meta, expiration, targetEffect, and full logs', async () => {
        seedRolls([0.01]); // natural 1 + 0 = 1 < DC 14
        try {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectRows([0]);
            await clickConfirm();

            // Failure save_result is logged after every state write in the branch.
            await waitFor(() => {
                expect(saveResultsFor('Goblin').length).toBe(1);
            });

            expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                casterName: 'Wizard1',
                spellName: "Tasha's Hideous Laughter",
                saveType: 'WIS',
                saveDc: 14,
                attackScope: 'single',
            });

            expect(conditionWritesFor('Goblin')).toHaveLength(1);
            expect(conditionWritesFor('Goblin')[0][2]).toEqual(['prone', 'incapacitated']);

            const metaWrite = setRuntimeValue.mock.calls
                .find(c => c[1] === 'activeConditionMeta' && c[0] === 'Goblin');
            expect(metaWrite[2]).toEqual({
                prone: { dc: 14, ability: 'wis' },
                incapacitated: { dc: 14, ability: 'wis' },
            });

            expect(addExpiration).toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Wizard1',
                targetName: 'Goblin',
                effects: [
                    { type: 'condition', condition: 'prone' },
                    { type: 'condition', condition: 'incapacitated' },
                    { type: 'tashas_laughter_expiration' },
                ],
                campaignName,
            });

            expect(targetEffectWrites()).toHaveLength(1);
            expect(targetEffectWrites()[0]).toEqual([
                {
                    target: 'Goblin',
                    effect: 'tashas_hideous_laughter',
                    source: 'Wizard1',
                    dc: 14,
                    duration: 'concentration',
                    conditions: ['prone', 'incapacitated'],
                },
            ]);

            expect(saveResultsFor('Goblin')[0]).toMatchObject({
                success: false,
                characterName: 'Wizard1',
                saveType: 'WIS',
                saveDc: 14,
                roll: 1,
                total: 1,
                saveBonus: 0,
                description: 'Goblin failed WIS save (DC 14, rolled 1 + 0 = 1) and is Prone and Incapacitated.',
            });

            expect(entriesOf(e =>
                e.type === 'condition' && e.action === 'applied' && e.characterName === 'Goblin'
            )[0]).toMatchObject({
                condition: 'Prone, Incapacitated',
                reason: "Tasha's Hideous Laughter",
                note: expect.stringContaining("can't end the Prone condition"),
            });

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 1,
                total: 1,
                conditions: ['prone', 'incapacitated'],
                appliedDamage: 0,
            });
        } finally {
            Math.random.mockRestore();
        }
    });

    it('successful NPC save logs the roll and closes without conditions, expiration, targetEffect, or popup', async () => {
        const onClose = vi.fn();
        const setPopupHtml = vi.fn();
        seedRolls([0.99]); // natural 20 + 0 >= DC 14
        try {
            render(<TashasLaughterModal {...makeProps({ onClose, setPopupHtml })} />);
            await selectRows([0]);
            await clickConfirm();

            await waitFor(() => {
                expect(saveResultsFor('Goblin').length).toBe(1);
            });

            expect(saveResultsFor('Goblin')[0]).toMatchObject({
                success: true,
                roll: 20,
                total: 20,
                saveBonus: 0,
                description: 'Goblin succeeded on WIS save (DC 14, rolled 20 + 0 = 20)',
            });
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'success',
                roll: 20,
                total: 20,
                conditions: [],
                appliedDamage: 0,
            });
            expect(conditionWritesFor('Goblin')).toHaveLength(0);
            expect(addExpiration).not.toHaveBeenCalled();
            expect(targetEffectWrites()).toHaveLength(0);

            // Popup is scheduled at 0ms and close at 500ms after resolution;
            // by the time onClose lands, a saved-only cast must have emitted no popup.
            await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 1500 });
            expect(setPopupHtml).not.toHaveBeenCalled();
        } finally {
            Math.random.mockRestore();
        }
    });

    it('mixed confirm resolves each NPC independently — Goblin fails, Orc saves — and pops a combined summary', async () => {
        const setPopupHtml = vi.fn();
        seedRolls([0.01, 0.99]); // Goblin nat 1 + 0 fails; Orc nat 20 + 2 = 22 saves
        try {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2, setPopupHtml })} />);
            await selectRows([0, 1]);
            await clickConfirm();

            // Orc's log lands last (target order), so it confirms both saves resolved.
            await waitFor(() => {
                expect(saveResultsFor('Orc').length).toBe(1);
            });

            expect(entriesOf(e => e.type === 'save_result')).toHaveLength(2);
            expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName,
                expect.objectContaining({ attackScope: 'single' }));
            expect(entriesOf(e => e.type === 'ability_use')[0].description)
                .toContain('Selecting 2 target(s)');

            expect(saveResultsFor('Goblin')[0]).toMatchObject({ success: false, roll: 1, total: 1 });
            expect(saveResultsFor('Orc')[0]).toMatchObject({
                success: true,
                roll: 20,
                total: 22,
                saveBonus: 2,
                description: 'Orc succeeded on WIS save (DC 14, rolled 20 + 2 = 22)',
            });

            // Only the failed target takes the laughter leg.
            expect(conditionWritesFor('Goblin')).toHaveLength(1);
            expect(conditionWritesFor('Goblin')[0][2]).toEqual(['prone', 'incapacitated']);
            expect(conditionWritesFor('Orc')).toHaveLength(0);
            expect(addExpiration).toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledWith(
                expect.objectContaining({ targetName: 'Goblin' })
            );
            expect(targetEffectWrites().flat()
                .filter(e => e.effect === 'tashas_hideous_laughter')).toHaveLength(1);

            await waitFor(() => expect(setPopupHtml).toHaveBeenCalledTimes(1));
            expect(setPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: "Tasha's Hideous Laughter",
                description: '1 creature(s) failed their save and are Prone and Incapacitated: Goblin. 1 creature(s) saved.',
            });
        } finally {
            Math.random.mockRestore();
        }
    });

    it('re-cast dedups prone/incapacitated case-insensitively while preserving other conditions', async () => {
        routeRuntimeValues({ activeConditions: ['Prone', 'incapacitated', 'blinded', 'poisoned'] });
        seedRolls([0.01]); // natural 1 + 0 < DC 14
        try {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectRows([0]);
            await clickConfirm();

            await waitFor(() => {
                expect(conditionWritesFor('Goblin')).toHaveLength(1);
            });
            expect(conditionWritesFor('Goblin')[0][2])
                .toEqual(['blinded', 'poisoned', 'prone', 'incapacitated']);
        } finally {
            Math.random.mockRestore();
        }
    });

    it('re-cast replaces the existing laughter targetEffect in place, refreshing the DC and preserving unrelated effects', async () => {
        const unrelated = { target: 'Orc', effect: 'fear_end_on_los', source: 'Wizard1' };
        routeRuntimeValues({
            targetEffects: [
                {
                    target: 'Goblin',
                    effect: 'tashas_hideous_laughter',
                    source: 'Wizard1',
                    dc: 10,
                    duration: 'concentration',
                    conditions: ['prone', 'incapacitated'],
                },
                unrelated,
            ],
        });
        seedRolls([0.01]); // natural 1 + 0 < DC 14
        try {
            render(<TashasLaughterModal {...makeProps()} />);
            await selectRows([0]);
            await clickConfirm();

            await waitFor(() => {
                expect(targetEffectWrites()).toHaveLength(1);
            });
            expect(targetEffectWrites()[0]).toEqual([
                {
                    target: 'Goblin',
                    effect: 'tashas_hideous_laughter',
                    source: 'Wizard1',
                    dc: 14, // refreshed from stale DC 10 seed, not appended beside it
                    duration: 'concentration',
                    conditions: ['prone', 'incapacitated'],
                },
                unrelated,
            ]);
        } finally {
            Math.random.mockRestore();
        }
    });

    it('routes NPC targets to local rolls and player targets to save prompts without touching player state', async () => {
        seedRolls([0.01, 0.5]); // Goblin nat 1 fails; second draw feeds the player prompt id
        try {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2 })} />);
            await selectRows([0, 2]);
            await clickConfirm();

            await waitFor(() => {
                expect(sendSavePrompt).toHaveBeenCalledTimes(1);
            });

            expect(conditionWritesFor('Goblin')).toHaveLength(1);
            expect(conditionWritesFor('Goblin')[0][2]).toEqual(['prone', 'incapacitated']);
            expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
            expect(saveResultsFor('PlayerAlly')).toHaveLength(0);
            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'WIS',
                saveDc: 14,
                sourceName: 'Wizard1',
                disadvantage: false,
            }));
        } finally {
            Math.random.mockRestore();
        }
    });

    it('Heightened Spell target NPC rolls with disadvantage — min of two d20s fails where the first draw alone would have succeeded', async () => {
        seedRolls([0.95, 0.05]); // min(nat 20, nat 2) = 2 + 0 < DC 14
        try {
            render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
            await selectRows([0]);
            await act(async () => {
                fireEvent.click(
                    document.querySelectorAll('.secondary-target-row')[0]
                        .querySelector('input[name="heightenTarget"]')
                );
            });
            await clickConfirm();

            await waitFor(() => {
                expect(saveResultsFor('Goblin').length).toBe(1);
            });
            expect(saveResultsFor('Goblin')[0]).toMatchObject({
                success: false,
                roll: 2,
                total: 2,
                saveBonus: 0,
            });
            expect(conditionWritesFor('Goblin')[0][2]).toEqual(['prone', 'incapacitated']);
        } finally {
            Math.random.mockRestore();
        }
    });
});
