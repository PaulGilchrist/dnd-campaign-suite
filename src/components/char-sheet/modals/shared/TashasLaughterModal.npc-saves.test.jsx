// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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
import { addEntry } from '../../../../services/ui/logService.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
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
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_hideous_laughter' },
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

function selectTarget(index) {
    const checkboxes = screen.getAllByRole('checkbox');
    const label = checkboxes[index].closest('label');
    fireEvent.click(label);
}

function clickConfirm() {
    const confirmBtn = screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
    fireEvent.click(confirmBtn);
}

function clickSkip() {
    const skipBtn = screen.getByRole('button', { name: 'Skip' });
    fireEvent.click(skipBtn);
}

function findSetRuntimeValueCalls(targetName, subKey) {
    return setRuntimeValue.mock.calls.filter(
        call => call[0] === targetName && call[1] === subKey
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('TashasLaughterModal - NPC Saves', () => {
    describe('initial setup', () => {
        it('renders the modal with all creatures as selectable targets', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
        });

        it('disables confirm button when no targets are selected', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            const confirmBtn = screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
            expect(confirmBtn).toBeDisabled();
        });

        it('enables confirm button after selecting a target', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            const confirmBtn = screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
            expect(confirmBtn).toBeEnabled();
        });

        it('skips and closes modal when skip is clicked', () => {
            const onClose = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose })} />);
            clickSkip();
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('storeSpellLastAttack and ability_use logging', () => {
        it('calls storeSpellLastAttack with correct payload when targets are selected', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            clickConfirm();
            await waitFor(() => {
                expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                    casterName: 'Wizard1',
                    spellName: "Tasha's Hideous Laughter",
                    saveType: 'WIS',
                    saveDc: 14,
                    attackScope: 'single',
                });
            });
        });

        it('logs ability_use entry with correct format when targets are selected', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            clickConfirm();
            await waitFor(() => {
                expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Wizard1',
                    abilityName: "Tasha's Hideous Laughter",
                    description: expect.stringContaining('Selecting 1 target(s)'),
                }));
            });
        });

        it('logs ability_use with correct target count for multiple selections', async () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2 })} />);
            selectTarget(0);
            selectTarget(1);
            clickConfirm();
            await waitFor(() => {
                const abilityCalls = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'ability_use'
                );
                expect(abilityCalls.length).toBeGreaterThan(0);
                expect(abilityCalls[0][1].description).toContain('Selecting 2 target(s)');
            });
        });
    });

    describe('NPC failed save path', () => {
        function mockNpcSaveFailure() {
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
        }

        it('applies prone and incapacitated conditions on failed NPC save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveFailure();
            clickConfirm();
            await waitFor(() => {
                const conditionCalls = findSetRuntimeValueCalls('Goblin', 'activeConditions');
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(conditionCalls[0][2]).toEqual(expect.arrayContaining(['prone', 'incapacitated']));
            });
        });

        it('sets condition meta with DC and ability for prone and incapacitated', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveFailure();
            clickConfirm();
            await waitFor(() => {
                const metaCalls = findSetRuntimeValueCalls('Goblin', 'activeConditionMeta');
                expect(metaCalls.length).toBeGreaterThan(0);
                const meta = metaCalls[0][2];
                expect(meta.prone).toEqual(expect.objectContaining({ dc: 14, ability: 'wis' }));
                expect(meta.incapacitated).toEqual(expect.objectContaining({ dc: 14, ability: 'wis' }));
            });
        });

        it('calls addExpiration with prone, incapacitated, and tashas_laughter_expiration', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveFailure();
            clickConfirm();
            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Wizard1', targetName: 'Goblin', effects: [
                        { type: 'condition', condition: 'prone' },
                        { type: 'condition', condition: 'incapacitated' },
                        { type: 'tashas_laughter_expiration' },
                    ], campaignName });
            });
        });

        it('sets targetEffects with tashas_hideous_laughter effect', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveFailure();
            clickConfirm();
            await waitFor(() => {
                const teCalls = findSetRuntimeValueCalls('campaign', 'targetEffects');
                expect(teCalls.length).toBeGreaterThan(0);
                const effects = teCalls[0][2];
                const laughterEffect = effects.find(e => e.effect === 'tashas_hideous_laughter');
                expect(laughterEffect).toEqual(expect.objectContaining({
                    target: 'Goblin',
                    effect: 'tashas_hideous_laughter',
                    source: 'Wizard1',
                    dc: 14,
                    duration: 'concentration',
                    conditions: ['prone', 'incapacitated'],
                }));
            });
        });

        it('logs condition entry with correct reason on failed NPC save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveFailure();
            clickConfirm();
            await waitFor(() => {
                const conditionEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'condition' && call[1]?.action === 'applied'
                );
                expect(conditionEntries[0][1].characterName).toBe('Goblin');
                expect(conditionEntries[0][1].condition).toBe('Prone, Incapacitated');
                expect(conditionEntries[0][1].note).toContain("Tasha's Hideous Laughter");
                expect(conditionEntries[0][1].note).toContain("can't end the Prone condition");
            });
        });
    });

    describe('condition deduplication', () => {
        it('filters out existing prone and incapacitated before re-adding', async () => {
            getRuntimeValue.mockReturnValue(['prone', 'incapacitated', 'blinded']);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            clickConfirm();
            await waitFor(() => {
                const conditionCalls = findSetRuntimeValueCalls('Goblin', 'activeConditions');
                expect(conditionCalls.length).toBeGreaterThan(0);
                const conditions = conditionCalls[0][2];
                expect(conditions).toContain('blinded');
                expect(conditions).toContain('prone');
                expect(conditions).toContain('incapacitated');
                const proneCount = conditions.filter(c => String(c).toLowerCase() === 'prone').length;
                const incapacitatedCount = conditions.filter(c => String(c).toLowerCase() === 'incapacitated').length;
                expect(proneCount).toBe(1);
                expect(incapacitatedCount).toBe(1);
            });
        });

        it('preserves other conditions when filtering prone/incapacitated', async () => {
            getRuntimeValue
                .mockReturnValueOnce(['prone', 'incapacitated', 'blinded', 'poisoned'])
                .mockReturnValueOnce([]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            clickConfirm();
            await waitFor(() => {
                const conditionCalls = findSetRuntimeValueCalls('Goblin', 'activeConditions');
                expect(conditionCalls[0][2]).toEqual(expect.arrayContaining(['blinded', 'poisoned', 'prone', 'incapacitated']));
            });
        });
    });

    describe('targetEffects update behavior', () => {
        it('updates existing targetEffects entry if one already exists for same target/effect/source', async () => {
            getRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([{
                    target: 'Goblin',
                    effect: 'tashas_hideous_laughter',
                    source: 'Wizard1',
                    dc: 10,
                    duration: 'concentration',
                    conditions: ['prone', 'incapacitated'],
                }]);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            clickConfirm();
            await waitFor(() => {
                const teCalls = findSetRuntimeValueCalls('campaign', 'targetEffects');
                expect(teCalls.length).toBeGreaterThan(0);
                const effects = teCalls[0][2];
                expect(effects.length).toBeGreaterThan(0);
            });
        });
    });

    describe('NPC save success path', () => {
        function mockNpcSaveSuccess() {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
        }

        it('does not apply conditions, expiration, or targetEffects when NPC succeeds on save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveSuccess();
            clickConfirm();
            await waitFor(() => {
                expect(findSetRuntimeValueCalls('Goblin', 'activeConditions').length).toBe(0);
                expect(addExpiration).not.toHaveBeenCalled();
                expect(findSetRuntimeValueCalls('campaign', 'targetEffects').length).toBe(0);
            });
        });

        it('logs save_result success for NPC', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveSuccess();
            clickConfirm();
            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.success === true
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].targetName).toBe('Goblin');
            });
        });

        it('records addTargetResult with success for NPC save', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            mockNpcSaveSuccess();
            clickConfirm();
            await waitFor(() => {
                const targetResultCalls = addTargetResult.mock.calls.filter(
                    call => call[0] === campaignName && call[1]?.targetName === 'Goblin'
                );
                expect(targetResultCalls.length).toBeGreaterThan(0);
                expect(targetResultCalls[0][1].saveResult).toBe('success');
                expect(targetResultCalls[0][1].conditions).toEqual([]);
            });
        });
    });

    describe('multiple NPC targets', () => {
        it('resolves saves for multiple NPC targets', async () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2 })} />);
            selectTarget(0);
            selectTarget(1);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            clickConfirm();
            await waitFor(() => {
                const allConditionCalls = setRuntimeValue.mock.calls.filter(
                    call => call[1] === 'activeConditions'
                );
                const targetNames = allConditionCalls.map(call => call[0]);
                expect(targetNames).toContain('Goblin');
                expect(targetNames).toContain('Orc');
            });
        });

        it('resolves saves for mixed NPC and player targets', async () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2 })} />);
            selectTarget(0);
            selectTarget(2);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            clickConfirm();
            await waitFor(() => {
                const conditionCalls = findSetRuntimeValueCalls('Goblin', 'activeConditions');
                expect(conditionCalls.length).toBeGreaterThan(0);
                expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    targetName: 'PlayerAlly',
                }));
            });
        });
    });

    describe('save bonus handling', () => {
        it('uses the target save bonus for NPC saves', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(1); // Orc has wis: 2
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            clickConfirm();
            await waitFor(() => {
                const saveEntries = addEntry.mock.calls.filter(
                    call => call[1]?.type === 'save_result' && call[1]?.targetName === 'Orc'
                );
                expect(saveEntries.length).toBeGreaterThan(0);
                expect(saveEntries[0][1].saveBonus).toBe(2);
            });
        });
    });

    describe('popup notification on close', () => {
        it('shows popup when at least one creature failed save', async () => {
            const onClose = vi.fn();
            const setPopupHtml = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose, setPopupHtml })} />);
            selectTarget(0);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            clickConfirm();
            await waitFor(() => {
                expect(setPopupHtml).toHaveBeenCalled();
            });
            const popupCall = setPopupHtml.mock.calls[0][0];
            expect(popupCall.type).toBe('automation_info');
            expect(popupCall.description).toContain('failed their save');
            expect(popupCall.description).toContain('Prone and Incapacitated');
        });

        it('does not show popup when all creatures succeed on save', async () => {
            const onClose = vi.fn();
            const setPopupHtml = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose, setPopupHtml })} />);
            selectTarget(0);
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            clickConfirm();
            await waitFor(() => {
                expect(setPopupHtml).not.toHaveBeenCalled();
            });
        });

        it('closes modal after popup is shown for failed saves', async () => {
            const onClose = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose })} />);
            selectTarget(0);
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            clickConfirm();
            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        });

        it('closes modal when all targets succeed without showing popup', async () => {
            const onClose = vi.fn();
            const setPopupHtml = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose, setPopupHtml })} />);
            selectTarget(0);
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            clickConfirm();
            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
                expect(setPopupHtml).not.toHaveBeenCalled();
            });
        });
    });

    describe('player target save prompts', () => {
        it('sends save prompt for player targets', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(2); // PlayerAlly
            clickConfirm();
            await waitFor(() => {
                expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    targetName: 'PlayerAlly',
                    saveType: 'WIS',
                    saveDc: 14,
                    sourceName: 'Wizard1',
                    disadvantage: false,
                }));
            });
        });

        it('does not apply conditions immediately for player targets', async () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(2);
            clickConfirm();
            await waitFor(() => {
                const conditionCalls = findSetRuntimeValueCalls('PlayerAlly', 'activeConditions');
                expect(conditionCalls.length).toBe(0);
            });
        });
    });

    describe('spell slot level and max targets', () => {
        it('allows selecting up to spellSlotLevel targets', () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 3 })} />);
            selectTarget(0);
            selectTarget(1);
            selectTarget(2);
            const confirmBtn = screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
            expect(confirmBtn).toBeEnabled();
        });

        it('disables targets beyond spellSlotLevel limit', () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 1 })} />);
            selectTarget(0);
            const checkboxes = screen.getAllByRole('checkbox');
            // Third target (index 2) should be disabled since maxTargets=1
            expect(checkboxes[2]).toBeDisabled();
        });
    });

    describe('empty targets', () => {
        it('shows no targets message when combat has no creatures', () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
            const confirmBtn = screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
            expect(confirmBtn).toBeDisabled();
        });
    });
});
