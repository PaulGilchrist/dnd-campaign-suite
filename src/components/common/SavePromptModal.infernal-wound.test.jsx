// @maintained-by-ai
// @improved-by-ai
// MA-0367 Infernal Wound — SavePromptModal behavior locks (prompt copy + reroll branch).
//
// 1) Copy: a dc_success "full" save prompt (Infernal Glaive wound save) must tell
//    the player honestly that the damage stands in FULL regardless of the save —
//    never "half damage" / "no damage on a successful save" — because this save
//    gates only the wound. The "half" and "none" rows must never leak the MA-0367
//    full-damage copy. (Positive display of the half/none notes is already locked
//    in SavePromptModal.rendering.test.jsx — not duplicated here.)
// 2) Reroll branch: in createSubmitSaveResult, a rerolled SUCCESS on a "full" row
//    closes any Infernal Wound the pre-reroll failure inflicted and restores NO HP
//    (the damage stands); a "half" reroll keeps the legacy HP-restore lane and does
//    NOT close the wound; a FAILED reroll closes nothing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (n) => n || 'Unknown', guid: () => 'g' } }));
vi.mock('../../services/dice/diceRoller.js', () => ({ rollD20: vi.fn(() => 15), rollExpression: vi.fn() }));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ sendSaveResult: vi.fn(), clearSavePrompt: vi.fn() }));
vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({ computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })) }));
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({ getAbilitySaveBonus: vi.fn(() => 3) }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({ getRuntimeValue: vi.fn(() => null), setRuntimeValue: vi.fn(), getStore: vi.fn(() => new Map()), useSyncedState: vi.fn(() => [null, vi.fn()]), listeners: new Map() }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn(() => null) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn(() => null) } }));
vi.mock('../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => []) }));
vi.mock('../../services/rules/features/infernalWoundService.js', () => ({
    grantInfernalWound: vi.fn(async () => {}),
    applyInfernalWoundBleedTurnStart: vi.fn(async () => {}),
    removeInfernalWoundOnHeal: vi.fn(async () => {}),
    cancelInfernalWoundAfterSaveSuccess: vi.fn(async () => true),
}));
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isCircleOfPowerActive: vi.fn(() => false),
}));
vi.mock('./Subscriber.jsx', () => {
    // Test target is deliberately named 'Torvin' — no "half"/"full" substrings —
    // so negative text assertions (/half damage/i) can never match the name.
    function MockSubscriber({ handleEvent, campaignName }) {
        const fire = (key, data) => () => handleEvent({ key: `change-${campaignName}-${key}`, data });
        const button = (testId, data) =>
            React.createElement('button', { 'data-testid': testId, onClick: fire(`savePrompt-${data.targetName}`, data) });
        return React.createElement('div', { 'data-testid': 'subscriber' },
            button('trigger-full', { promptId: 'p-full', targetName: 'Torvin', saveType: 'con', saveDc: 12, dcSuccess: 'full', sourceName: 'Infernal Glaive' }),
            button('trigger-half', { promptId: 'p-half', targetName: 'Torvin', saveType: 'dex', saveDc: 15, dcSuccess: 'half', sourceName: 'Fireball' }),
            button('trigger-none', { promptId: 'p-none', targetName: 'Torvin', saveType: 'wis', saveDc: 16, dcSuccess: 'none', sourceName: 'Fireball' }),
            button('trigger-full-reroll', { promptId: 'p-full-reroll', targetName: 'Torvin', saveType: 'con', saveDc: 12, dcSuccess: 'full', rawDamage: 10, sourceName: 'Infernal Glaive' }),
            button('trigger-half-reroll', { promptId: 'p-half-reroll', targetName: 'Torvin', saveType: 'con', saveDc: 12, dcSuccess: 'half', rawDamage: 10, sourceName: 'Fireball' }),
        );
    }
    return { default: MockSubscriber };
});

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import { cancelInfernalWoundAfterSaveSuccess } from '../../services/rules/features/infernalWoundService.js';
import { setupDefaults, cleanupDefaults, createRageCharacter } from './SavePromptModal.test-utils.jsx';

const CAMPAIGN = 'test-campaign';
const TARGET = 'Torvin';

beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
afterEach(cleanupDefaults);

function renderModal(characters = []) {
    render(<SavePromptModal campaignName={CAMPAIGN} characters={characters} activeMapName={null} />);
}

async function openPrompt(triggerTestId) {
    fireEvent.click(screen.getByTestId(triggerTestId));
    await waitFor(() => expect(screen.getByText(/must make a/i)).toBeInTheDocument());
}

describe('MA-0367 dc_success "full" save prompt copy', () => {
    it('shows the honest full-damage note (and its wound-gating clause) with source, never reduction wording', async () => {
        renderModal();
        await openPrompt('trigger-full');

        expect(screen.getByText('Full damage regardless — this save determines any additional effect only')).toBeInTheDocument();
        expect(screen.getByText(/Source: Infernal Glaive/i)).toBeInTheDocument();
        // Nothing on a "full" row may promise damage reduction of any kind.
        expect(screen.queryByText(/half damage/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/no damage/i)).not.toBeInTheDocument();
    });

    // Positive display of each row's own note lives in rendering.test.jsx;
    // this guards only against the MA-0367 copy leaking onto other rows.
    it.each([
        ['half', 'trigger-half'],
        ['none', 'trigger-none'],
    ])('dc_success "%s" rows never render the "full damage regardless" copy', async (_dcSuccess, triggerTestId) => {
        renderModal();
        await openPrompt(triggerTestId);

        expect(screen.queryByText(/full damage regardless/i)).not.toBeInTheDocument();
    });
});

describe('MA-0367 reroll submit — dc_success "full" closes the wound, restores no HP', () => {
    // Fanatical Focus provides the reroll lane: raging, resource unused,
    // initial CON save fails (1 + 3 < DC 12), reroll succeeds (15 + 3 + 2 >= 12).
    function armRaging() {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return [{ effect: 'rage', damageBonusExpression: 'rage_damage' }];
            if (key === 'fanaticalFocusUsed') return false;
            if (key === 'activeConditions') return [];
            return null;
        });
    }

    async function failThenReroll(triggerTestId) {
        renderModal([createRageCharacter(TARGET, 2)]);
        await openPrompt(triggerTestId);
        fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
        await waitFor(() => expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Reroll Save \(\+2\)/ }));
    }

    it('rerolled SUCCESS on a "full" row cancels the Infernal Wound instead of restoring HP', async () => {
        rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
        armRaging();

        await failThenReroll('trigger-full-reroll');
        await waitFor(() => expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument());

        await waitFor(() => expect(cancelInfernalWoundAfterSaveSuccess).toHaveBeenCalledWith(TARGET, CAMPAIGN));
        // The damage stands in FULL — the legacy HP-restore lane must not run.
        expect(setRuntimeValue).not.toHaveBeenCalledWith(TARGET, 'hitPoints', expect.anything(), CAMPAIGN);
        expect(addEntry).not.toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ rollType: 'healing' }));
    });

    it('rerolled FAILURE on a "full" row closes nothing and restores nothing', async () => {
        rollD20.mockReturnValue(1);
        armRaging();

        await failThenReroll('trigger-full-reroll');
        await waitFor(() => expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument());

        expect(cancelInfernalWoundAfterSaveSuccess).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith(TARGET, 'hitPoints', expect.anything(), CAMPAIGN);
    });

    it('rerolled SUCCESS on a "half" row keeps the legacy HP-restore lane and does not close the wound', async () => {
        rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
        armRaging();

        await failThenReroll('trigger-half-reroll');
        await waitFor(() => expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument());

        // rawDamage 10, no stored lastAttack → ceil(10 / 2) = 5 HP restored + healing log.
        expect(setRuntimeValue).toHaveBeenCalledWith(TARGET, 'hitPoints', 5, CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ rollType: 'healing', total: 5 }));
        expect(cancelInfernalWoundAfterSaveSuccess).not.toHaveBeenCalled();
    });
});
