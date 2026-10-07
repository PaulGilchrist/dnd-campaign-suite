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
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// SP-079: the confirm lane is the ONLY place the lv6 slot is spent + the ONLY
// producer of the spell cast log. Mock it so the ledger is observable.
vi.mock('../../../../services/rules/spells/spellPreparationService.js', () => ({
    prepareSpellCast: vi.fn(),
    isFreeCastAuthorized: vi.fn(() => false),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../../../services/rules/spells/spellPreparationService.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'DivinationWizard',
    level: 20,
    proficiency: 6,
    class: { name: 'Wizard' },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    spellAbilities: { spell_slots_level_6: 2, saveDc: 19 },
};

const baseAction = {
    name: 'Mass Suggestion',
    automation: { type: 'mass_suggestion' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, saveBonuses: { wis: 1 } },
        { name: 'Bandit 2', type: 'npc', currentHp: 11, maxHp: 11, saveBonuses: { wis: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 19,
        // SP-079 pay-at-confirm flags threaded from the open lane:
        deferSlotPayment: true,
        slotLevel: 6,
        castingTime: 'Action',
        onClose: vi.fn(),
        ...overrides,
    };
}

async function selectAndConfirm() {
    const labels = document.querySelectorAll('.secondary-target-row');
    await act(async () => { fireEvent.click(labels[0]); });
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /Mass Suggestion \(1\)/ })).toBeInTheDocument();
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Mass Suggestion \(1\)/ }));
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    addEntry.mockResolvedValue(undefined);
    prepareSpellCast.mockResolvedValue({ modifiedSpell: { level: 6 }, metaCtx: {}, slotConsumed: true });
    isFreeCastAuthorized.mockReturnValue(false);
});

describe('SP-079 MassSuggestionModal pay-at-confirm', () => {
    it('OPEN (no confirm): spends no spell slot', () => {
        render(<MassSuggestionModal {...makeProps()} />);

        expect(prepareSpellCast).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.filter(c => c[1].type === 'spell')).toHaveLength(0);
    });

    it('SKIP: spends nothing, emits no spell log, just closes', async () => {
        const onClose = vi.fn();
        render(<MassSuggestionModal {...makeProps({ onClose })} />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skip' })); });

        expect(prepareSpellCast).not.toHaveBeenCalled();
        expect(addEntry.mock.calls.filter(c => c[1].type === 'spell')).toHaveLength(0);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('CONFIRM: consumes exactly one lv6 slot + logs exactly one spell entry', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.26); // save roll 6 + 1 = 7 < DC 19 → fail
        try {
            render(<MassSuggestionModal {...makeProps()} />);
            await selectAndConfirm();

            await waitFor(() => {
                expect(prepareSpellCast).toHaveBeenCalledTimes(1);
            });
            expect(prepareSpellCast).toHaveBeenCalledWith(
                { name: 'Mass Suggestion', level: 6 },
                {},
                expect.objectContaining({ playerName: 'DivinationWizard', campaignName }),
            );

            const spellLogs = addEntry.mock.calls.filter(c => c[1].type === 'spell');
            expect(spellLogs).toHaveLength(1);
            expect(spellLogs[0][1]).toEqual(expect.objectContaining({
                type: 'spell',
                characterName: 'DivinationWizard',
                spellName: 'Mass Suggestion',
                spellLevel: 6,
                saveDC: 19,
                concentration: false,
            }));
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('CONFIRM: saves/stamps preserved — charmed stamp + condition applied on failed save', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.26);
        try {
            render(<MassSuggestionModal {...makeProps()} />);
            await selectAndConfirm();

            await waitFor(() => {
                expect(addExpiration).toHaveBeenCalledWith({
                    attackerName: 'DivinationWizard',
                    targetName: 'Bandit 1',
                    effects: [{ type: 'charmed', condition: 'charmed' }],
                    campaignName,
                });
            });
            // End-on-damage advisory log leg retained.
            const charmNote = addEntry.mock.calls.find(c =>
                c[1].type === 'condition' && /ends if .* deal damage/i.test(c[1].note || ''));
            expect(charmNote).toBeTruthy();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('CONFIRM re-entry: a second confirm click never re-spends the slot', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.26);
        try {
            render(<MassSuggestionModal {...makeProps()} />);
            await selectAndConfirm();
            await waitFor(() => { expect(prepareSpellCast).toHaveBeenCalledTimes(1); });

            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Mass Suggestion \(1\)/ }));
            });

            expect(prepareSpellCast).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls.filter(c => c[1].type === 'spell')).toHaveLength(1);
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('control: unfree, un-upcast paid cast — no free-cast bypass', async () => {
        isFreeCastAuthorized.mockReturnValue(false);
        prepareSpellCast.mockResolvedValue({ modifiedSpell: { level: 6 }, metaCtx: {}, slotConsumed: false, freeCastUsed: false });
        const onClose = vi.fn();
        render(<MassSuggestionModal {...makeProps({ onClose })} />);
        await selectAndConfirm();

        // No slot available → refuse, no saves resolved.
        expect(prepareSpellCast).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
