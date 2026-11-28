// @maintained-by-ai 2026-11-27 — MA-0367 lane: 'full'-row note copy byte pin + reroll cancel seam bracketed at full/half/rawDamage-0; mock keys mirrored to #1935-#1943, phantoms purged, testid/exact-copy flushes
// SavePromptModal — MA-0367 Infernal Wound: the dc_success "full" note copy and
// the reroll-success cancel seam in createSubmitSaveResult.
//
// Owned HERE:
// 1) Copy: a dc_success "full" save prompt (Infernal Glaive wound save) must
//    tell the player honestly that the damage stands in FULL regardless of the
//    save — never "half damage" / "no damage on a successful save" — because
//    this save gates only the wound. The "half" and "none" rows must never
//    leak the MA-0367 full-damage copy. (Positive display of the half/none
//    notes is already locked in SavePromptModal.rendering.test.jsx.)
// 2) Cancel seam (SavePromptModal.jsx:653-662, `success && rawDamage > 0`):
//    every discriminating leg of the branch, each with its own observable
//    outcome — full+rawDamage>0+success closes the wound via
//    cancelInfernalWoundAfterSaveSuccess exactly once and restores NO HP (the
//    damage stands); half+rawDamage>0+success keeps the legacy HP-restore lane
//    and closes nothing; full+rawDamage>0+FAILED reroll does neither; and the
//    rawDamage-0 full success skips BOTH legs (the `rawDamage > 0` gate).
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic .... .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .... .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ........... .holy-aura.test.jsx (#1942)
// - Reroll-button availability matrix / once-per-save gate / cap ladder
//   .................................................. .indomitable.test.jsx (#1943)
// - Fanatical Focus / Disciplined Survivor / Guarded Mind / Living Legend
//   reroll lanes ...................................... .rerolls.test.jsx
// - Handler contract + wound service internals (te strip, clock cancel,
//   closed-log) ....................................... infernalWoundService.test.js
// - Prompt/result-panel copy for the half/none rows ... .rendering.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
    default: { getName: (name) => name || 'Unknown' },
}));

// importOriginal spread per #1943: automationExpressions.js pulls
// canRollExpression/rollExpressionMaximized from this module through
// automationService (a real SavePromptModal import) — a bare two-key factory
// risks crashing that graph.
vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, rollD20: vi.fn(), rollExpression: vi.fn() };
});

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock even though this lane never sends (#1935-#1943 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
    clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
    computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Flat +3 CON/DEX/WIS save bonus for this lane's fixtures; never overridden
// here, so no beforeEach re-baseline needed.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilitySaveBonus: vi.fn(() => 3),
}));

// Graph keys mirrored to the nine sibling lanes (#1935-#1943): no
// useSyncedState/listeners phantoms — this modal never imports them.
// deleteRuntimeKey/setRuntimeObject/getAllStoreKeys back real graph imports
// (savePrompt.js, evasionUtils.js, store probes).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => null),
    getStore: vi.fn(() => new Map()),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    deleteRuntimeKey: vi.fn(),
    setRuntimeObject: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn(), get: vi.fn(() => null) },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(() => []),
}));

// SavePromptModal.jsx imports ONLY the cancel seam of this service — the mock
// carries exactly that key (grant/bleed/heal legs live in
// infernalWoundService.test.js, not this graph).
vi.mock('../../services/rules/features/infernalWoundService.js', () => ({
    cancelInfernalWoundAfterSaveSuccess: vi.fn(async () => true),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

// Target is deliberately named 'Torvin' — no "half"/"full" substrings —
// so negative text assertions (/half damage/i) can never match the name.
vi.mock('./Subscriber.jsx', () => {
    function MockSubscriber({ handleEvent, campaignName }) {
        const fire = (key, data) => () => handleEvent({ key: `change-${campaignName}-${key}`, data });
        const button = (testId, data) =>
            React.createElement('button', { 'data-testid': testId, onClick: fire(`savePrompt-${data.targetName}`, data) });
        return React.createElement('div', { 'data-testid': 'subscriber' },
            button('trigger-full', { promptId: 'p-full', targetName: 'Torvin', saveType: 'con', saveDc: 12, dcSuccess: 'full', sourceName: 'Infernal Glaive' }),
            button('trigger-half', { promptId: 'p-half', targetName: 'Torvin', saveType: 'dex', saveDc: 15, dcSuccess: 'half', sourceName: 'Fireball' }),
            button('trigger-none', { promptId: 'p-none', targetName: 'Torvin', saveType: 'wis', saveDc: 16, dcSuccess: 'none', sourceName: 'Fireball' }),
            button('trigger-full-reroll', { promptId: 'p-full-reroll', targetName: 'Torvin', saveType: 'con', saveDc: 12, dcSuccess: 'full', rawDamage: 10, sourceName: 'Infernal Glaive' }),
            button('trigger-full-zero-reroll', { promptId: 'p-full-zero-reroll', targetName: 'Torvin', saveType: 'con', saveDc: 12, dcSuccess: 'full', rawDamage: 0, sourceName: 'Infernal Glaive' }),
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

async function openPrompt(triggerTestId) {
    fireEvent.click(screen.getByTestId(triggerTestId));
    await screen.findByTestId('active-save-prompt');
}

describe('MA-0367 dc_success "full" save prompt copy', () => {
    it('shows the honest full-damage note (and its wound-gating clause) with source, never reduction wording', async () => {
        render(<SavePromptModal campaignName={CAMPAIGN} characters={[]} activeMapName={null} />);
        await openPrompt('trigger-full');

        expect(screen.getByText('Full damage regardless — this save determines any additional effect only')).toBeInTheDocument();
        expect(screen.getByText(/Source: Infernal Glaive/i)).toBeInTheDocument();
        // Nothing on a "full" row may promise damage reduction of any kind.
        expect(screen.queryByText(/half damage/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/no damage/i)).not.toBeInTheDocument();
    });

    // Positive display of each row's own note lives in rendering.test.jsx;
    // this guards only against the MA-0367 copy leaking onto other rows
    // (kills a dropped/loosened `dcSuccess === 'full'` branch condition).
    it.each([
        ['half', 'trigger-half'],
        ['none', 'trigger-none'],
    ])('dc_success "%s" rows never render the "full damage regardless" copy', async (_dcSuccess, triggerTestId) => {
        render(<SavePromptModal campaignName={CAMPAIGN} characters={[]} activeMapName={null} />);
        await openPrompt(triggerTestId);

        expect(screen.queryByText(/full damage regardless/i)).not.toBeInTheDocument();
    });
});

describe('MA-0367 reroll cancel seam — success && rawDamage > 0 branch legs', () => {
    // Fanatical Focus supplies the reroll vehicle (its availability UX is
    // .rerolls' face): raging, resource unused, initial CON save fails
    // (1 + 3 < DC 12), reroll succeeds (15 + 3 + 2 >= 12). Seeding every
    // reroll-resource read keeps any unrelated reroll lane out of scope.
    function armRaging() {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'activeBuffs') return [{ effect: 'rage', damageBonusExpression: 'rage_damage' }];
            if (key === 'fanaticalFocusUsed') return false;
            if (key === 'activeConditions') return [];
            return null;
        });
    }

    async function failThenReroll(triggerTestId) {
        render(<SavePromptModal campaignName={CAMPAIGN} characters={[createRageCharacter(TARGET, 2)]} activeMapName={null} />);
        await openPrompt(triggerTestId);
        fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
        await screen.findByText('SAVE FAILURE');
        fireEvent.click(screen.getByRole('button', { name: 'Reroll Save (+2)' }));
    }

    const hitPointsWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === 'hitPoints');
    const healingLogs = () =>
        addEntry.mock.calls.filter(([, entry]) => entry?.rollType === 'healing');

    it('rerolled SUCCESS on a "full" row with rawDamage > 0 cancels the Infernal Wound exactly once and restores no HP', async () => {
        rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
        armRaging();

        await failThenReroll('trigger-full-reroll');
        await screen.findByText('SAVE SUCCESS');

        // The wound closes: exactly one cancel write, 2-arg (target, campaign).
        expect(cancelInfernalWoundAfterSaveSuccess).toHaveBeenCalledTimes(1);
        expect(cancelInfernalWoundAfterSaveSuccess).toHaveBeenCalledWith(TARGET, CAMPAIGN);
        // The damage stands in FULL — the legacy HP-restore lane must not run
        // (no 4-arg hitPoints write, no healing log).
        expect(hitPointsWrites()).toHaveLength(0);
        expect(healingLogs()).toHaveLength(0);
    });

    it('rerolled SUCCESS on a "half" row with rawDamage > 0 keeps the legacy HP-restore lane and closes no wound', async () => {
        rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
        armRaging();

        await failThenReroll('trigger-half-reroll');
        await screen.findByText('SAVE SUCCESS');

        // rawDamage 10, no stored lastAttack → ceil(10 / 2) = 5 HP restored,
        // pinned as the 4-arg write + healing log; the else-branch proves the
        // dcSuccess discriminator (a swapped branch fails both this leg and
        // the one above).
        expect(setRuntimeValue).toHaveBeenCalledWith(TARGET, 'hitPoints', 5, CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ rollType: 'healing', total: 5 }));
        expect(cancelInfernalWoundAfterSaveSuccess).not.toHaveBeenCalled();
    });

    it('rerolled FAILURE on a "full" row with rawDamage > 0 closes nothing and restores nothing', async () => {
        rollD20.mockReturnValue(1);
        armRaging();

        await failThenReroll('trigger-full-reroll');
        // Flush on the rerolled breakdown string itself — the SAVE FAILURE
        // caption was already on screen pre-reroll (#1943 idiom).
        await screen.findByText('d20 (1) + 5 (+2 Fanatical Focus)');

        expect(cancelInfernalWoundAfterSaveSuccess).not.toHaveBeenCalled();
        expect(hitPointsWrites()).toHaveLength(0);
    });

    it('rerolled SUCCESS on a "full" row with rawDamage 0 skips BOTH the wound cancel and the HP restore', async () => {
        // The `rawDamage > 0` half of the seam gate: a full-damage save prompt
        // whose attack actually dealt no damage must not fire the cancel
        // (there is no inflicted-wound premise) nor the restore (nothing to
        // restore). Dropping the rawDamage guard flips this leg.
        rollD20.mockReturnValueOnce(1).mockReturnValueOnce(15);
        armRaging();

        await failThenReroll('trigger-full-zero-reroll');
        await screen.findByText('SAVE SUCCESS');

        expect(cancelInfernalWoundAfterSaveSuccess).not.toHaveBeenCalled();
        expect(hitPointsWrites()).toHaveLength(0);
        expect(healingLogs()).toHaveLength(0);
    });
});
