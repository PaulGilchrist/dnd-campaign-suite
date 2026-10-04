// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CalmEmotionsModal from './CalmEmotionsModal.jsx';

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

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/spells/calmEmotionsHandler.js', () => ({
    applyCalmEmotionsImmunity: vi.fn().mockResolvedValue(undefined),
    applyCalmEmotionsIndifferent: vi.fn().mockResolvedValue(undefined),
    resolveCalmEmotionsEligibility: vi.fn().mockImplementation(async ({ creatures }) => ({
        eligible: (creatures || []).map(c => c.name),
        ineligible: [],
        advisory: [],
    })),
    logCalmEmotionsEligibility: vi.fn().mockResolvedValue(undefined),
    registerCalmEmotionsExpiration: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { storeSpellLastAttack } from '../../../../services/automation/common/damageRollback.js';
import { applyCalmEmotionsImmunity, applyCalmEmotionsIndifferent, resolveCalmEmotionsEligibility, registerCalmEmotionsExpiration, logCalmEmotionsEligibility } from '../../../../services/automation/handlers/spells/calmEmotionsHandler.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Calm Emotions',
    automation: { type: 'calm_emotions' },
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

async function castAll() {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Cast Calm Emotions \(3\)/ }));
    });
}

async function setChoice(name, index) {
    await act(async () => {
        const radios = document.querySelectorAll(`input[name="choice-${name}"]`);
        fireEvent.click(radios[index]);
    });
}

function saveResultCalls(targetName) {
    return addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result' && call[1]?.targetName === targetName
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
    getAllyList.mockReturnValue(null);
    resolveCalmEmotionsEligibility.mockImplementation(async ({ creatures }) => ({
        eligible: (creatures || []).map(c => c.name),
        ineligible: [],
        advisory: [],
    }));
    logCalmEmotionsEligibility.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CalmEmotionsModal - Cast Flow', () => {
    // ── Confirm / cast behavior (SP-020 B1) ──

    describe('confirm / cast behavior', () => {
        it('B1: saves roll BEFORE any effect — successful NPC saves get no effect, players get prompts', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            render(<CalmEmotionsModal {...makeProps()} />);
            await castAll();

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Wizard1',
                abilityName: 'Calm Emotions',
                description: expect.stringContaining('Selecting 3 target'),
            }));
            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                casterName: 'Wizard1',
                spellName: 'Calm Emotions',
                saveType: 'CHA',
                saveDc: 14,
                attackScope: 'aoe',
            });
            // Successful saves — no effect applied to anyone
            expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
            expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
            // Players are prompted even with the default immunity choice
            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'CHA',
                saveDc: 14,
                sourceName: 'Wizard1',
            }));
        });

        it('B1/B6: failed NPC saves apply the chosen effect and log save_result', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            render(<CalmEmotionsModal {...makeProps()} />);
            await castAll();

            await waitFor(() => {
                expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({
                    targetName: 'Goblin',
                    casterName: 'Wizard1',
                    campaignName,
                    dc: 14,
                }));
                expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({
                    targetName: 'Orc',
                }));
            });
            expect(saveResultCalls('Goblin').length).toBeGreaterThan(0);
            expect(saveResultCalls('Orc').length).toBeGreaterThan(0);
            expect(saveResultCalls('Goblin')[0][1].success).toBe(false);
        });

        it('B5: registers the concentration duration clock on cast', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            render(<CalmEmotionsModal {...makeProps()} />);
            await castAll();

            expect(registerCalmEmotionsExpiration).toHaveBeenCalledWith({
                casterName: 'Wizard1',
                campaignName,
            });
        });

        it('B2/B4: logs ineligible creatures and sphere advisories on cast', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            render(<CalmEmotionsModal {...makeProps()} />);
            await castAll();

            expect(logCalmEmotionsEligibility).toHaveBeenCalledWith(expect.objectContaining({
                casterName: 'Wizard1',
                campaignName,
            }));
        });
    });

    // ── NPC save resolution (SP-020 B3) ──

    describe('NPC save resolution with indifferent choice', () => {
        it('rolls save and applies indifference on failure for NPC with indifferent choice', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            render(<CalmEmotionsModal {...makeProps()} />);

            await setChoice('Orc', 1);
            await castAll();

            await waitFor(() => {
                expect(applyCalmEmotionsIndifferent).toHaveBeenCalledWith(expect.objectContaining({
                    targetName: 'Orc',
                    casterName: 'Wizard1',
                    campaignName,
                    dc: 14,
                }));
            });
            expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Goblin' }));
        });

        it('rolls save and applies nothing on success for NPC with indifferent choice', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            render(<CalmEmotionsModal {...makeProps()} />);

            await setChoice('Goblin', 1);
            await castAll();

            await waitFor(() => {
                const goblinIndifferentCalls = applyCalmEmotionsIndifferent.mock.calls.filter(
                    call => call[0]?.targetName === 'Goblin'
                );
                expect(goblinIndifferentCalls).toHaveLength(0);
                expect(saveResultCalls('Goblin').length).toBeGreaterThan(0);
            });
        });
    });

    // ── Careful Spell protection ──

    describe('careful spell protection', () => {
        it('automatically succeeds for careful spell protected NPCs', async () => {
            getAllyList.mockReturnValue(['Goblin']);
            render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);

            await setChoice('Goblin', 1);
            await castAll();

            expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
            expect(applyCalmEmotionsImmunity).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Goblin' }));

            const entries = saveResultCalls('Goblin');
            expect(entries.length).toBeGreaterThan(0);
            expect(entries[0][1].description).toContain('Careful Spell protected');
        });

        it('does not send save prompt or apply effects for careful spell protected players', async () => {
            getAllyList.mockReturnValue(['PlayerAlly']);
            render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);

            await setChoice('PlayerAlly', 1);
            await castAll();

            const playerPrompts = sendSavePrompt.mock.calls.filter(
                call => call[1]?.targetName === 'PlayerAlly'
            );
            expect(playerPrompts).toHaveLength(0);
            expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
        });
    });

    // ── Player save prompts (SP-020 B1) ──

    describe('player save prompts', () => {
        it('sends save prompt for player targets with indifferent choice', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            render(<CalmEmotionsModal {...makeProps()} />);

            await setChoice('PlayerAlly', 1);
            await castAll();

            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'CHA',
                saveDc: 14,
                sourceName: 'Wizard1',
            }));
        });

        it('sends save prompt for player with immunity choice too (no save-skipping)', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            render(<CalmEmotionsModal {...makeProps()} />);

            await castAll();

            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
            }));
            expect(applyCalmEmotionsImmunity).not.toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'PlayerAlly',
            }));
        });
    });

    // ── Player save result handling ──

    describe('player save result handling', () => {
        it('applies indifference when player fails save via save-result event', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            const onClose = vi.fn();
            render(<CalmEmotionsModal {...makeProps({ onClose })} />);

            await setChoice('PlayerAlly', 1);
            await castAll();

            const savePromptCall = sendSavePrompt.mock.calls[0];
            const actualPromptId = savePromptCall[1].promptId;

            await act(async () => {
                const event = new CustomEvent('save-result', {
                    detail: {
                        promptId: actualPromptId,
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                });
                window.dispatchEvent(event);
            });

            await waitFor(() => {
                expect(applyCalmEmotionsIndifferent).toHaveBeenCalledWith(expect.objectContaining({
                    targetName: 'PlayerAlly',
                    casterName: 'Wizard1',
                    campaignName,
                    dc: 14,
                }));
            });
        });

        it('applies immunity when player with immunity choice fails save', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            const onClose = vi.fn();
            render(<CalmEmotionsModal {...makeProps({ onClose })} />);

            await castAll();

            const savePromptCall = sendSavePrompt.mock.calls.find(
                call => call[1]?.targetName === 'PlayerAlly'
            );
            const actualPromptId = savePromptCall[1].promptId;

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId: actualPromptId,
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                }));
            });

            await waitFor(() => {
                expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({
                    targetName: 'PlayerAlly',
                }));
            });
        });

        it('applies nothing when player passes save', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            const onClose = vi.fn();
            render(<CalmEmotionsModal {...makeProps({ onClose })} />);

            await setChoice('PlayerAlly', 1);
            await castAll();

            const savePromptCall = sendSavePrompt.mock.calls[0];
            const actualPromptId = savePromptCall[1].promptId;

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId: actualPromptId,
                        success: true,
                        roll: 18,
                        total: 19,
                        saveBonus: 1,
                    },
                }));
            });

            const playerIndifferentCalls = applyCalmEmotionsIndifferent.mock.calls.filter(
                call => call[0]?.targetName === 'PlayerAlly'
            );
            expect(playerIndifferentCalls).toHaveLength(0);
            const playerImmunityCalls = applyCalmEmotionsImmunity.mock.calls.filter(
                call => call[0]?.targetName === 'PlayerAlly'
            );
            expect(playerImmunityCalls).toHaveLength(0);
        });

        it('closes modal when all pending prompts are resolved', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.99);
            const onClose = vi.fn();
            render(<CalmEmotionsModal {...makeProps({ onClose })} />);

            await castAll();

            const savePromptCall = sendSavePrompt.mock.calls.find(
                call => call[1]?.targetName === 'PlayerAlly'
            );
            const actualPromptId = savePromptCall[1].promptId;

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', {
                    detail: {
                        promptId: actualPromptId,
                        success: false,
                        roll: 5,
                        total: 6,
                        saveBonus: 1,
                    },
                }));
            });

            await waitFor(() => {
                expect(onClose).toHaveBeenCalledTimes(1);
            });
        });
    });
});
