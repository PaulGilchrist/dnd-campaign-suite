// @maintained-by-ai
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

// Goblin fails saves on low rolls (cha +0), Orc fails only below 12 (cha +2),
// so constant-random pins exercise both NPCs through the same roll.
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
        fireEvent.click(screen.getByRole('button', { name: /Cast Calm Emotions \(\d+\)/ }));
    });
}

async function setChoice(name, index) {
    await act(async () => {
        const radios = document.querySelectorAll(`input[name="choice-${name}"]`);
        fireEvent.click(radios[index]);
    });
}

async function dispatchSaveResult(promptId, detail) {
    await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId, ...detail },
        }));
    });
}

function saveResultCalls(targetName) {
    return addEntry.mock.calls.filter(
        call => call[1]?.type === 'save_result' && call[1]?.targetName === targetName
    );
}

function promptIdFor(targetName) {
    const call = sendSavePrompt.mock.calls.find(c => c[1]?.targetName === targetName);
    expect(call, `save prompt sent for ${targetName}`).toBeDefined();
    return call[1].promptId;
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
    it('cast with successful saves: logs use, stores rollback, registers duration, prompts players, applies nothing', async () => {
        // Every roll is a natural 20 — SP-020 B1: everyone saves, no effects land.
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
        // SP-020 B5/B2: duration clock registered and eligibility outcome recorded.
        expect(registerCalmEmotionsExpiration).toHaveBeenCalledWith({ casterName: 'Wizard1', campaignName });
        expect(logCalmEmotionsEligibility).toHaveBeenCalledWith(expect.objectContaining({
            casterName: 'Wizard1',
            campaignName,
        }));
        // Successful saves — no effect applied to anyone, but every NPC save is logged.
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
        expect(saveResultCalls('Goblin')[0][1].success).toBe(true);
        expect(saveResultCalls('Orc')[0][1].success).toBe(true);
        // Players are prompted (even with the default immunity choice) instead of rolled here.
        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'PlayerAlly',
            saveType: 'CHA',
            saveDc: 14,
            sourceName: 'Wizard1',
        }));
        expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);
    });

    it('failed NPC saves apply the per-target chosen effect and log failures', async () => {
        // Constant low roll: Goblin (cha +0) and Orc (cha +2) both fail DC 14.
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        render(<CalmEmotionsModal {...makeProps()} />);

        await setChoice('Orc', 1); // Become Indifferent; Goblin keeps default immunity
        await castAll();

        await waitFor(() => {
            expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Goblin', casterName: 'Wizard1', campaignName, dc: 14,
            }));
            expect(applyCalmEmotionsIndifferent).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Orc', casterName: 'Wizard1', campaignName, dc: 14,
            }));
        });
        // Each target receives only its own chosen effect.
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Orc' }));
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Goblin' }));
        expect(saveResultCalls('Goblin')[0][1].success).toBe(false);
        expect(saveResultCalls('Orc')[0][1].success).toBe(false);
        // Player lane waits for its own prompt response.
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'PlayerAlly' }));
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'PlayerAlly' }));
    });

    it('heightened target saves at disadvantage and still fails on a high first draw', async () => {
        // Draw order: Goblin +0 → 20 (succeeds); heightened Orc +2 draws twice →
        // min(13, 1) = 1 + 2 = 3 < DC 14, so it fails even though its first
        // draw alone (13 + 2 = 15) would have succeeded.
        vi.spyOn(Math, 'random')
            .mockReturnValueOnce(0.99)
            .mockReturnValueOnce(0.6)
            .mockReturnValue(0.01);
        render(<CalmEmotionsModal {...makeProps({ metamagicHeighten: true })} />);

        await setChoice('Orc', 1);
        await act(async () => {
            const orcRow = [...document.querySelectorAll('.secondary-target-row')]
                .find(row => row.textContent.includes('Orc'));
            fireEvent.click(orcRow.querySelector('input[name="heightenTarget"]'));
        });
        await castAll();

        await waitFor(() => {
            expect(applyCalmEmotionsIndifferent).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Orc', casterName: 'Wizard1', campaignName, dc: 14,
            }));
        });
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
        expect(saveResultCalls('Orc')[0][1].success).toBe(false);
    });

    it('Careful Spell auto-succeeds protected NPC and player while unprotected targets still suffer', async () => {
        getAllyList.mockReturnValue(['Goblin', 'PlayerAlly']);
        // Constant low roll: Goblin fails raw but Careful forces success; Orc (non-ally) fails.
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        render(<CalmEmotionsModal {...makeProps({ metamagicCareful: true })} />);

        await setChoice('Goblin', 1);
        await castAll();

        await waitFor(() => {
            // Unprotected Orc still takes its chosen/default effect — protection is per-ally.
            expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Orc' }));
        });
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Goblin' }));
        const goblinEntries = saveResultCalls('Goblin');
        expect(goblinEntries.length).toBeGreaterThan(0);
        expect(goblinEntries[0][1].success).toBe(true);
        expect(goblinEntries[0][1].description).toContain('Careful Spell protected');
        // Protected players skip the save prompt entirely.
        expect(sendSavePrompt).not.toHaveBeenCalled();
    });

    it('player save prompts resolve per choice: failures apply the chosen effect, successes nothing, modal closes when all answered', async () => {
        const playerSummary = {
            creatures: [
                { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
                { name: 'PlayerOne', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
                { name: 'PlayerTwo', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
                { name: 'PlayerThree', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
            ],
        };
        getCombatSummary.mockReturnValue(playerSummary);
        // Deterministic rolls that all succeed (>= 15 + bonus) AND yield distinct
        // promptIds per draw — a constant random would collide the players' promptIds.
        let tick = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => 0.7 + (tick++ % 30) / 100);
        const onClose = vi.fn();
        render(<CalmEmotionsModal {...makeProps({ onClose })} />);

        await setChoice('PlayerTwo', 1); // Become Indifferent; One and Three keep immunity
        await castAll();

        // Every unprotected player is prompted; nothing is applied before they answer.
        expect(['PlayerOne', 'PlayerTwo', 'PlayerThree'].map(n => promptIdFor(n)).every(Boolean)).toBe(true);
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalled();
        expect(applyCalmEmotionsIndifferent).not.toHaveBeenCalled();

        // Success — no effect, and the modal stays open while others are pending.
        await dispatchSaveResult(promptIdFor('PlayerThree'), { success: true, roll: 18, total: 19, saveBonus: 1 });
        await waitFor(() => expect(saveResultCalls('PlayerThree')[0][1].success).toBe(true));
        expect(applyCalmEmotionsImmunity).not.toHaveBeenCalledWith(expect.objectContaining({ targetName: 'PlayerThree' }));
        expect(onClose).not.toHaveBeenCalled();

        // Failure with immunity choice — immunity applied, modal still open.
        await dispatchSaveResult(promptIdFor('PlayerOne'), { success: false, roll: 5, total: 6, saveBonus: 1 });
        await waitFor(() => {
            expect(applyCalmEmotionsImmunity).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'PlayerOne', casterName: 'Wizard1', campaignName, dc: 14,
            }));
            expect(saveResultCalls('PlayerOne')[0][1].success).toBe(false);
        });
        expect(onClose).not.toHaveBeenCalled();

        // Failure with indifferent choice — indifference applied; last prompt resolved, modal closes.
        await dispatchSaveResult(promptIdFor('PlayerTwo'), { success: false, roll: 5, total: 6, saveBonus: 1 });
        await waitFor(() => {
            expect(applyCalmEmotionsIndifferent).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'PlayerTwo', casterName: 'Wizard1', campaignName, dc: 14,
            }));
            // Modal auto-closes ~500ms after the final prompt resolves.
            expect(onClose).toHaveBeenCalledTimes(1);
        }, { timeout: 2000 });
    });
});
