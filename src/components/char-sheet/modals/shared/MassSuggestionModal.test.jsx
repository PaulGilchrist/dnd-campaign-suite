// @maintained-by-ai
// Base render / NPC-resolution / dispatch lane of MassSuggestionModal: chooser rendering,
// skip-to-close, the confirm dispatch trail (storeSpellLastAttack, ability_use log, local
// NPC save resolution incl. charmed dedup, persistAndNotify), and player prompt dispatch.
// The save-result event lane lives in MassSuggestionModal.saveResults.test.jsx; the
// pay-at-confirm slot lane lives in MassSuggestionModal.pay-at-confirm.test.jsx.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MassSuggestionModal from './MassSuggestionModal.jsx';

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

// Need to import after mocking
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
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
    name: 'Mass Suggestion',
    automation: { type: 'mass_suggestion' },
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

function confirmButton() {
    return screen.getByRole('button', { name: /Mass Suggestion \(\d+\)/ });
}

function activeConditionWrites(targetName) {
    return setRuntimeValue.mock.calls.filter(
        call => call[0] === targetName && call[1] === 'activeConditions'
    );
}

// Shared lane: check a target's row, wait for the confirm button to arm with the
// selection count, then cast.
async function selectAndConfirm(targetName) {
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(targetName) }));
    await waitFor(() => {
        expect(confirmButton()).toBeEnabled();
        expect(confirmButton()).toHaveAccessibleName(expect.stringContaining('(1)'));
    });
    await act(async () => {
        fireEvent.click(confirmButton());
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    persistAndNotify.mockReturnValue(undefined);
});

describe('MassSuggestionModal', () => {
    it('renders the chooser with every combat target; Skip closes without dispatching anything', async () => {
        const onClose = vi.fn();
        render(<MassSuggestionModal {...makeProps({ onClose })} />);

        expect(screen.getByText('Mass Suggestion')).toBeInTheDocument();
        for (const name of ['Goblin', 'Orc', 'PlayerAlly']) {
            expect(screen.getByRole('checkbox', { name: new RegExp(name) })).toBeInTheDocument();
        }
        expect(confirmButton()).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(persistAndNotify).not.toHaveBeenCalled();
    });

    describe.each([
        {
            label: 'failed save applies charmed once',
            random: 0.26, // roll 6 + 0 = 6 < DC 14
            existingConditions: [],
            expectedConditions: ['charmed'],
        },
        {
            label: 'failed save dedupes an already-charmed target without dropping other conditions',
            random: 0.01, // roll 1 < DC 14
            existingConditions: ['charmed', 'frightened'],
            expectedConditions: ['frightened', 'charmed'],
        },
        {
            label: 'succeeded save applies nothing',
            random: 0.76, // roll 16 + 0 >= DC 14
            existingConditions: [],
            expectedConditions: null,
        },
    ])('NPC save resolution — $label', ({ random, existingConditions, expectedConditions }) => {
        it('runs the full confirm dispatch trail for an NPC target', async () => {
            getRuntimeValue.mockImplementation((key, subKey) =>
                key === 'Goblin' && subKey === 'activeConditions' ? existingConditions : []);
            vi.spyOn(Math, 'random').mockReturnValue(random);
            try {
                render(<MassSuggestionModal {...makeProps()} />);
                await selectAndConfirm('Goblin');

                // persistAndNotify is the last call in the resolution chain — waiting on
                // it means the whole trail has landed.
                await waitFor(() => {
                    expect(persistAndNotify).toHaveBeenCalledWith(baseCombatSummary, campaignName);
                });

                // Attack stamp + cast log happen regardless of save outcome.
                expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                    casterName: 'Wizard1',
                    spellName: 'Mass Suggestion',
                    saveType: 'WIS',
                    saveDc: 14,
                    attackScope: 'aoe',
                });
                expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Wizard1',
                    abilityName: 'Mass Suggestion',
                    description: 'Mass Suggestion: Selecting 1 target(s) for save (DC 14 WIS)',
                }));
                // NPCs resolve locally — no player save prompt on this lane.
                expect(sendSavePrompt).not.toHaveBeenCalled();

                const charmedWrites = activeConditionWrites('Goblin');
                if (expectedConditions) {
                    expect(charmedWrites).toHaveLength(1);
                    expect(charmedWrites[0][2]).toEqual(expectedConditions);
                    expect(addExpiration).toHaveBeenCalledTimes(1);
                    expect(addExpiration).toHaveBeenCalledWith({
                        attackerName: 'Wizard1',
                        targetName: 'Goblin',
                        effects: [{ type: 'charmed', condition: 'charmed' }],
                        campaignName,
                    });
                    expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                        targetName: 'Goblin',
                        saveResult: 'failure',
                        conditions: ['charmed'],
                        appliedDamage: 0,
                    }));
                } else {
                    expect(charmedWrites).toHaveLength(0);
                    expect(addExpiration).not.toHaveBeenCalled();
                    expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                        targetName: 'Goblin',
                        saveResult: 'success',
                        conditions: [],
                        appliedDamage: 0,
                    }));
                }
            } finally {
                vi.restoreAllMocks();
            }
        });
    });

    it('player targets get a save prompt: promptId is sent, tracked on the campaign, and nothing resolves locally', async () => {
        render(<MassSuggestionModal {...makeProps()} />);
        await selectAndConfirm('PlayerAlly');

        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        const [promptCampaign, payload] = sendSavePrompt.mock.calls[0];
        expect(promptCampaign).toBe(campaignName);
        expect(payload).toEqual(expect.objectContaining({
            targetName: 'PlayerAlly',
            saveType: 'WIS',
            saveDc: 14,
            sourceName: 'Wizard1',
        }));
        expect(typeof payload.promptId).toBe('string');

        // The exact dispatched promptId is the one tracked for the listener.
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'pendingSaveListenerPrompts',
            [payload.promptId],
            campaignName,
        );

        // The player's save answer belongs to the save-result lane, not the cast lane.
        expect(activeConditionWrites('PlayerAlly')).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
    });
});
