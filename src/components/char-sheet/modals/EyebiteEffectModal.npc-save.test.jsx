// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

vi.mock('./shared/SecondaryTargetModal.jsx', () => {
    return {
        default: vi.fn(({ title, targets, onTargetSelected, onSkip, description, confirmLabel, confirmIcon }) => {
            const firstTargetName = targets.length > 0 ? (targets[0].name || targets[0].value) : null;
            return (
                <div data-testid="secondary-target-modal">
                    <span data-testid="stm-title">{title}</span>
                    <span data-testid="stm-icon">{confirmIcon}</span>
                    <span data-testid="stm-description">{description}</span>
                    <span data-testid="stm-confirmLabel">{confirmLabel}</span>
                    <span data-testid="stm-targetCount">{targets.length}</span>
                    <button
                        onClick={() => onTargetSelected(firstTargetName)}
                        data-testid="stm-confirm"
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                    <button onClick={onSkip} data-testid="stm-skip" type="button">
                        Skip
                    </button>
                    {targets.map((t, i) => (
                        <span key={i} data-testid={`stm-target-${i}`}>{t.name || t.value}</span>
                    ))}
                </div>
            );
        }),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as automationService from '../../../services/combat/automation/automationService.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as damageRollback from '../../../services/automation/common/damageRollback.js';
import utils from '../../../services/ui/utils.js';

const baseProps = {
    combatSummary: {
        creatures: [
            { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2, dex: 0 } },
            { name: 'Orc Warrior', type: 'npc', saveBonuses: { wis: 4, dex: 2 } },
            { name: 'Elf Mage', type: 'player', saveBonuses: { wis: 1, dex: 3 } },
        ],
    },
    attackerName: 'Witch1',
    saveDc: 13,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    characters: [],
    featureName: 'Eyebite',
    rangeFeet: 60,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('EyebiteEffectModal - NPC save', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollD20.mockReturnValue(15);
        automationService.playerIsImmuneToCondition.mockReturnValue(false);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        utils.guid.mockReturnValue('test-guid-123');
    });

    describe('NPC auto-save', () => {
        it('calls storeSpellLastAttack when target is selected', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            expect(damageRollback.storeSpellLastAttack).toHaveBeenCalled();
            const call = damageRollback.storeSpellLastAttack.mock.calls[0][1];
            expect(call.casterName).toBe('Witch1');
            expect(call.spellName).toBe('Eyebite');
            expect(call.saveType).toBe('WIS');
            expect(call.saveDc).toBe(13);
            expect(call.attackScope).toBe('single');
        });

        it('logs ability_use entry with description containing target, condition, and DC', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            expect(logService.addEntry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Witch1',
                    abilityName: 'Eyebite',
                })
            );
            const abilityUseCalls = logService.addEntry.mock.calls.filter(
                c => c[1].type === 'ability_use'
            );
            expect(abilityUseCalls.length).toBeGreaterThan(0);
            const description = abilityUseCalls[0][1].description;
            expect(description).toContain('Witch1 casts Eyebite (Asleep)');
            expect(description).toContain('Goblin1');
            expect(description).toContain('WIS save');
            expect(description).toContain('DC 13');
            expect(description).toContain('Unconscious');
        });

        it('uses NPC save bonus (WIS) in save calculation and sends result', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            expect(diceRoller.rollD20).toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
                'test-campaign',
                'Goblin1',
                expect.objectContaining({
                    success: true,
                    roll: 15,
                    total: 17,
                    saveBonus: 2,
                })
            );
        });

        it('uses 0 as saveBonus when creature has no saveBonuses.wis or saveBonuses object', async () => {
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc' },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            expect(diceRoller.rollD20).toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
                'test-campaign',
                'Goblin1',
                expect.objectContaining({
                    saveBonus: 0,
                })
            );
        });
    });

    describe('Immunity handling', () => {
        it('auto-succeeds for immune targets (NPC immunity)', async () => {
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
                'Goblin1',
                'activeConditions',
                expect.any(Array),
                'test-campaign'
            );
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    targetName: 'Goblin1',
                    saveResult: 'immune',
                    roll: 0,
                    total: 0,
                })
            );
        });

        it('logs save_result for immune targets with correct description', async () => {
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            const saveResultCalls = logService.addEntry.mock.calls.filter(
                c => c[1].type === 'save_result'
            );
            expect(saveResultCalls.length).toBeGreaterThan(0);
            const lastSaveResult = saveResultCalls[saveResultCalls.length - 1][1];
            expect(lastSaveResult).toEqual(
                expect.objectContaining({
                    type: 'save_result',
                    success: true,
                    targetName: 'Goblin1',
                    saveType: 'WIS',
                })
            );
            expect(lastSaveResult.description).toContain('immune');
            expect(lastSaveResult.description).toContain('unconscious');
            expect(lastSaveResult.description).toContain('succeeds');
        });

        it('shows popup and closes modal for immune targets', async () => {
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 2 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(screen.getByText(/Goblin1/)).toBeInTheDocument();
                expect(screen.getByText(/immune/)).toBeInTheDocument();
            });
            expect(baseProps.onClose).toHaveBeenCalled();
        });
    });

    describe('Condition application', () => {
        it('applies condition on NPC save failure', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin1',
                    'activeConditions',
                    expect.arrayContaining(['unconscious']),
                    'test-campaign'
                );
            });
        });

        it('preserves existing conditions when applying new one', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            runtimeState.getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin1',
                    'activeConditions',
                    expect.arrayContaining(['frightened', 'poisoned', 'unconscious']),
                    'test-campaign'
                );
            });
        });

        it('does not duplicate condition if already present', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            runtimeState.getRuntimeValue.mockReturnValue(['unconscious']);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                const conditionsCall = runtimeState.setRuntimeValue.mock.calls.find(
                    c => c[0] === 'Goblin1' && c[1] === 'activeConditions'
                );
                expect(conditionsCall).toBeDefined();
                const conditions = conditionsCall[2];
                const unconsciousCount = conditions.filter(c => String(c).toLowerCase() === 'unconscious').length;
                expect(unconsciousCount).toBe(1);
            });
        });

        it('calls addExpiration with correct condition structure', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Witch1', targetName: 'Goblin1', effects: expect.arrayContaining([
                        expect.objectContaining({
                            condition: 'unconscious',
                        }),
                    ]), campaignName: 'test-campaign' });
            });
        });

        it('registers targetEffect in campaign targetEffects', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                const targetEffectsCall = runtimeState.setRuntimeValue.mock.calls.find(
                    c => c[0] === 'campaign' && c[1] === 'targetEffects'
                );
                expect(targetEffectsCall).toBeDefined();
                const effects = targetEffectsCall[2];
                expect(effects).toContainEqual(
                    expect.objectContaining({
                        target: 'Goblin1',
                        effect: 'eyebite_asleep',
                        source: 'Witch1',
                        condition: 'unconscious',
                        duration: 'concentration',
                    })
                );
            });
        });

        it('calls addTargetResult with roll and total for failure', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
                    'test-campaign',
                    expect.objectContaining({
                        targetName: 'Goblin1',
                        saveResult: 'failure',
                        roll: 1,
                        total: 1,
                        conditions: ['unconscious'],
                        appliedDamage: 0,
                    })
                );
            });
        });

        it('logs save_result and condition entries on failure', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                const saveResultCalls = logService.addEntry.mock.calls.filter(
                    c => c[1].type === 'save_result' && c[1].targetName === 'Goblin1'
                );
                expect(saveResultCalls.length).toBeGreaterThan(0);
                const lastSaveResult = saveResultCalls[saveResultCalls.length - 1][1];
                expect(lastSaveResult).toEqual(
                    expect.objectContaining({
                        targetName: 'Goblin1',
                        success: false,
                        type: 'save_result',
                        saveDc: 13,
                        saveType: 'WIS',
                        rollType: 'save-eyebite',
                        characterName: 'Witch1',
                    })
                );
                expect(lastSaveResult.description).toContain('failed WIS save');
                expect(lastSaveResult.description).toContain('Eyebite');

                const conditionCalls = logService.addEntry.mock.calls.filter(
                    c => c[1].type === 'condition'
                );
                expect(conditionCalls.length).toBeGreaterThan(0);
                const lastCondition = conditionCalls[conditionCalls.length - 1][1];
                expect(lastCondition).toEqual(
                    expect.objectContaining({
                        characterName: 'Goblin1',
                        condition: 'Unconscious',
                        type: 'condition',
                        action: 'applied',
                        reason: 'Eyebite spell',
                    })
                );
                expect(lastCondition.note).toContain('Goblin1');
                expect(lastCondition.note).toContain('Unconscious');
            });
        });
    });

    describe('Popup display - NPC', () => {
        it('shows popup with creature name, spell, condition, and save result on NPC failure', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(screen.getByText(/Goblin1/)).toBeInTheDocument();
                expect(screen.getByText(/Unconscious/)).toBeInTheDocument();
                expect(screen.getByText(/failed on WIS save/)).toBeInTheDocument();
            });
        });

        it('shows popup with creature name and save result on NPC success', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(screen.getByText(/Goblin1/)).toBeInTheDocument();
                expect(screen.getByText(/succeeded on WIS save/)).toBeInTheDocument();
            });
        });

        it('modal closes when Done is clicked in popup', async () => {
            diceRoller.rollD20.mockReturnValue(1);
            render(<EyebiteEffectModal {...makeProps({
                combatSummary: {
                    creatures: [
                        { name: 'Goblin1', type: 'npc', saveBonuses: { wis: 0 } },
                    ],
                },
            })} />);
            fireEvent.click(screen.getByRole('button', { name: /Asleep/ }));
            await act(async () => {
                fireEvent.click(screen.getByTestId('stm-confirm'));
            });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Done' }));
            });
            expect(baseProps.onClose).toHaveBeenCalled();
        });
    });
});
