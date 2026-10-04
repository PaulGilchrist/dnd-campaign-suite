// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules ──

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
    addTargetResult: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

// SP-024: fail grants now stamp ONE addExpiration clock per failing target
// (end-of-next-turn anchor) — mock the barrel so expiry registration is assertable
// and the real expirationQueue (needs combatData.getCurrentCombatRound) stays inert.
vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';

// ── Test fixtures ──

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Blinding Darkness',
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { con: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const baseEffects = [{ type: 'blinded', condition: 'blinded' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 12,
        effects: baseEffects,
        conditionLabel: 'Blinded',
        onClose: vi.fn(),
        ...overrides,
    };
}

// ── Helper to select a target row ──

function selectTargetRow(index) {
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[index]);
}

// ── Helpers ──

function getApplyButton() {
    return screen.getByRole('button', { name: /Blinding Darkness/ });
}

// ── Tests ──

describe('AOEConditionModal', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    // ── NPC save resolution ──

    describe('NPC save resolution', () => {
        it('calls storeSpellLastAttack and logs ability_use when targets are selected', async () => {
            render(<AOEConditionModal {...makeProps()} />);
            await act(async () => selectTargetRow(0));
            await act(async () => {
                fireEvent.click(getApplyButton());
            });

            expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                casterName: 'Wizard1',
                spellName: 'Blinding Darkness',
                saveType: 'CON',
                saveDc: 12,
                attackScope: 'aoe',
            }));

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Wizard1',
                abilityName: 'Blinding Darkness',
                description: expect.stringContaining('Selecting 1 target'),
            }));
        });

        it('applies blinded condition on failed NPC save and logs save_result + condition entries', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                render(<AOEConditionModal {...makeProps()} />);
                await act(async () => selectTargetRow(0));
                await act(async () => {
                    fireEvent.click(getApplyButton());
                });

                await waitFor(() => {
                    const conditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(conditionCalls.length).toBeGreaterThan(0);
                    expect(conditionCalls[0][2]).toContain('blinded');
                });

                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'Goblin'
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1]).toEqual(expect.objectContaining({
                    type: 'save_result',
                    saveType: 'CON',
                    saveDc: 12,
                    success: false,
                }));

                const conditionEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'condition' && call[1]?.condition === 'Blinded'
                );
                expect(conditionEntries.length).toBeGreaterThan(0);
            } finally {
                vi.restoreAllMocks();
            }
        });

        it('does not apply condition on successful NPC save and logs save_result with success', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            try {
                render(<AOEConditionModal {...makeProps()} />);
                await act(async () => selectTargetRow(0));
                await act(async () => {
                    fireEvent.click(getApplyButton());
                });

                await waitFor(() => {
                    const conditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(conditionCalls.length).toBe(0);
                });

                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'Goblin'
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].success).toBe(true);
            } finally {
                vi.restoreAllMocks();
            }
        });
    });

    // ── Careful Spell protection for NPCs ──

    describe('careful spell protection for NPCs', () => {
        it('automatically succeeds for careful spell protected NPCs', async () => {
            getAllyList.mockReturnValue(['Goblin']);
            getRuntimeValue.mockReturnValue([]);
            render(<AOEConditionModal {...makeProps({ metamagicCareful: true })} />);
            await act(async () => selectTargetRow(0));
            await act(async () => {
                fireEvent.click(getApplyButton());
            });

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                );
                expect(conditionCalls.length).toBe(0);
            });

            const saveEntries = addEntry.mock.calls.filter(
                call => call[1]?.type === 'save_result' && call[1]?.targetName === 'Goblin'
            );
            expect(saveEntries.length).toBeGreaterThan(0);
            expect(saveEntries[0][1].description).toContain('Careful Spell protected');
        });
    });

    // ── Player save prompts ──

    describe('player save prompts', () => {
        it('sends save prompt for player targets instead of resolving locally', async () => {
            render(<AOEConditionModal {...makeProps()} />);
            await act(async () => selectTargetRow(2));
            await act(async () => {
                fireEvent.click(getApplyButton());
            });

            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'CON',
                saveDc: 12,
                sourceName: 'Wizard1',
            }));

            const conditionCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
            );
            expect(conditionCalls.length).toBe(0);
        });
    });

    // ── Player save result handling ──

    describe('player save result handling', () => {
        function dispatchSaveResult(success, extraFields = {}) {
            const allCalls = vi.mocked(sendSavePrompt).mock.calls;
            const savePromptCall = allCalls[allCalls.length - 1];
            const promptId = savePromptCall[1].promptId;
            return act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId,
                        success,
                        roll: extraFields.roll ?? (success ? 18 : 5),
                        total: extraFields.total ?? (success ? 19 : 6),
                        saveBonus: extraFields.saveBonus ?? 1,
                        ...extraFields,
                    },
                }));
            });
        }

        it('applies blinded when player fails save and does not when player passes', async () => {
            // Fail path
            const onCloseFail = vi.fn();
            render(<AOEConditionModal {...makeProps({ onClose: onCloseFail })} />);
            await act(async () => selectTargetRow(2));
            await act(async () => {
                fireEvent.click(getApplyButton());
            });
            await dispatchSaveResult(false);
            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toContain('blinded');
            });

            // Success path
            const onCloseSuccess = vi.fn();
            const preSuccessCallCount = setRuntimeValue.mock.calls.length;
            render(<AOEConditionModal {...makeProps({ onClose: onCloseSuccess })} />);
            await act(async () => selectTargetRow(2));
            await act(async () => {
                fireEvent.click(getApplyButton());
            });
            await dispatchSaveResult(true);
            const successCalls = setRuntimeValue.mock.calls.slice(preSuccessCallCount).filter(
                call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
            );
            expect(successCalls.length).toBe(0);
        });

        it('handles save-result event with missing optional fields', async () => {
            const onClose = vi.fn();
            render(<AOEConditionModal {...makeProps({ onClose })} />);

            await act(async () => selectTargetRow(2));
            await act(async () => {
                fireEvent.click(getApplyButton());
            });

            await dispatchSaveResult(false, {});

            await waitFor(() => {
                const conditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions' && call[0] === 'PlayerAlly'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toContain('blinded');
            });
        });
    });

    // ── Multiple targets ──

    describe('multiple targets', () => {
        it('resolves saves for mixed NPC and player targets', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                render(<AOEConditionModal {...makeProps()} />);
                await act(async () => selectTargetRow(0));
                await act(async () => selectTargetRow(2));
                await act(async () => {
                    fireEvent.click(getApplyButton());
                });

                await waitFor(() => {
                    const npcConditionCalls = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(npcConditionCalls.length).toBeGreaterThan(0);
                    expect(npcConditionCalls[0][2]).toContain('blinded');
                });

                expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    targetName: 'PlayerAlly',
                }));
            } finally {
                vi.restoreAllMocks();
            }
        });
    });
});
