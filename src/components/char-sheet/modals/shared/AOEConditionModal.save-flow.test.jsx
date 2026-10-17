// @maintained-by-ai
// Save-flow lane for AOEConditionModal (NON-overlay path): cast logging +
// storeSpellLastAttack, NPC auto-save resolution, player save prompts and
// save-result handling, Careful Spell protection (NPC and player branches),
// mixed targets in one cast.
// Sibling lanes (do not duplicate here): test.jsx = render/selection UI;
// results.test.jsx = activeConditions dedup + trap-blocking truth table;
// overlay.test.jsx = overlay-only OVERRIDE handlers; expiry.test.jsx =
// SP-024 expiry clocks; integration.test.jsx = Heightened Spell.
//
// Determinism: no Math.random spies (React internals consume randomness during
// clicks). DCs are engineered so every outcome is fixed: DC 1 always saves,
// DC 21 fails even a +0 save, DC 23 fails even Orc's +2 CON (roll ≤ 20).
// Listener-registration flake fix mirrors expiry.test.jsx: flush once after
// apply (registers the window 'save-result' listener) BEFORE dispatching.

import { render, screen, fireEvent, act } from '@testing-library/react';
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

// Clock CONTENT is asserted by expiry.test.jsx; the real expirationQueue
// (needs combatData.getCurrentCombatRound) stays inert in this harness.
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
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

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

const ALWAYS_SAVE_DC = 1;   // any d20 + 0 ≥ 1 → NPC always saves
const ALWAYS_FAIL_DC = 21;  // any d20 + 0 < 21 → +0 save always fails
const FAIL_ANY_SAVE_DC = 23; // any d20 + 2 < 23 → even Orc's +2 CON fails

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

// ── Helpers ──

// One bounded macrotask yield inside act(): drains the un-awaited confirm
// chain (addEntry → resolveAllSaves → setPendingPrompts render → listener
// registration) deterministically. Bounded event-loop yield only.
function flush(action) {
    return act(async () => {
        if (action) action();
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

function selectTarget(name) {
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));
}

function clickApply() {
    fireEvent.click(screen.getByRole('button', { name: /Blinding Darkness/ }));
}

function loggedEntries(type) {
    return addEntry.mock.calls.map(call => call[1]).filter(e => e && e.type === type);
}

function saveResultFor(targetName) {
    return loggedEntries('save_result').find(e => e.targetName === targetName);
}

function conditionWritesFor(targetName) {
    return setRuntimeValue.mock.calls.filter(
        call => call[0] === targetName && call[1] === 'activeConditions'
    );
}

function targetResultFor(name) {
    return addTargetResult.mock.calls.map(call => call[1]).find(e => e && e.targetName === name);
}

function summaryText() {
    return document.body.textContent;
}

// ── Tests ──

describe('AOEConditionModal save flow', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    it('logs the cast, stores the AoE attack, and applies blinded with both log entries on a failed NPC save', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_FAIL_DC })} />);
        selectTarget('Goblin');
        await flush(clickApply);

        // One ability_use cast log naming the caster, spell, targets and DC.
        const abilityUse = loggedEntries('ability_use');
        expect(abilityUse).toHaveLength(1);
        expect(abilityUse[0]).toMatchObject({
            characterName: 'Wizard1',
            abilityName: 'Blinding Darkness',
            description: 'Blinding Darkness: Selecting 1 target(s) for save (DC 21 CON)',
        });

        // Rollback store gets the full AoE attack context.
        expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
            casterName: 'Wizard1',
            spellName: 'Blinding Darkness',
            saveType: 'CON',
            saveDc: ALWAYS_FAIL_DC,
            attackScope: 'aoe',
        });

        // Blinded lands exactly once, written to the campaign.
        const writes = conditionWritesFor('Goblin');
        expect(writes).toHaveLength(1);
        expect(writes[0][2]).toEqual(['blinded']);
        expect(writes[0][3]).toBe(campaignName);

        // Failed save_result carries the real roll and the +0 CON bonus.
        const save = saveResultFor('Goblin');
        expect(save).toMatchObject({
            characterName: 'Wizard1',
            targetName: 'Goblin',
            saveType: 'CON',
            saveDc: ALWAYS_FAIL_DC,
            success: false,
            saveBonus: 0,
        });
        expect(save.roll).toBeGreaterThanOrEqual(1);
        expect(save.roll).toBeLessThanOrEqual(20);
        expect(save.total).toBe(save.roll);

        // Condition-applied log identifies target, condition and source.
        const condLogs = loggedEntries('condition');
        expect(condLogs).toHaveLength(1);
        expect(condLogs[0]).toMatchObject({
            action: 'applied',
            characterName: 'Goblin',
            condition: 'Blinded',
            dc: ALWAYS_FAIL_DC,
            ability: 'CON',
            sourceName: 'Wizard1',
        });

        expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Goblin',
            saveResult: 'failure',
            conditions: ['blinded'],
            appliedDamage: 0,
        }));
        expect(persistAndNotify).toHaveBeenCalled();
        expect(summaryText()).toMatch(/0\s*targets saved,\s*1\s*target failed/);
    });

    it('logs a successful NPC save without applying the condition', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: ALWAYS_SAVE_DC })} />);
        selectTarget('Goblin');
        await flush(clickApply);

        const save = saveResultFor('Goblin');
        expect(save).toMatchObject({
            characterName: 'Wizard1',
            targetName: 'Goblin',
            saveType: 'CON',
            saveDc: ALWAYS_SAVE_DC,
            success: true,
            saveBonus: 0,
        });
        expect(save.total).toBe(save.roll);

        expect(conditionWritesFor('Goblin')).toHaveLength(0);
        expect(loggedEntries('condition')).toHaveLength(0);
        expect(targetResultFor('Goblin')).toMatchObject({ saveResult: 'success', conditions: [] });
        expect(summaryText()).toMatch(/1\s*target saved,\s*0\s*targets failed/);
    });

    it('Careful Spell auto-saves a protected NPC and skips the prompt for a protected player', async () => {
        getAllyList.mockReturnValue(['Goblin', 'PlayerAlly']);
        render(<AOEConditionModal {...makeProps({ metamagicCareful: true, saveDc: ALWAYS_FAIL_DC })} />);
        selectTarget('Goblin');
        selectTarget('PlayerAlly');
        await flush(clickApply);

        // Protected NPC: forced success, annotated log, no condition.
        const goblinSave = saveResultFor('Goblin');
        expect(goblinSave).toMatchObject({ success: true });
        expect(goblinSave.description).toContain('Careful Spell protected');
        expect(conditionWritesFor('Goblin')).toHaveLength(0);
        expect(targetResultFor('Goblin')).toMatchObject({ saveResult: 'success', conditions: [] });

        // Protected player: never prompted, never resolved locally, counted as saved.
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(loggedEntries('condition')).toHaveLength(0);
        expect(summaryText()).toMatch(/2\s*targets saved,\s*0\s*targets failed/);
    });

    it('sends a save prompt for an unprotected player and registers it in pendingSaveListenerPrompts', async () => {
        render(<AOEConditionModal {...makeProps()} />);
        selectTarget('PlayerAlly');
        await flush(clickApply);

        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        const payload = sendSavePrompt.mock.calls[0][1];
        expect(payload).toMatchObject({
            targetName: 'PlayerAlly',
            saveType: 'CON',
            saveDc: 12,
            sourceName: 'Wizard1',
        });
        expect(payload.promptId).toBeTruthy();

        const promptWrites = setRuntimeValue.mock.calls.filter(
            call => call[1] === 'pendingSaveListenerPrompts'
        );
        expect(promptWrites).toHaveLength(1);
        expect(promptWrites[0][2]).toEqual([payload.promptId]);

        // Nothing resolved locally while the prompt is pending.
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);
        expect(saveResultFor('PlayerAlly')).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('applies blinded and zero-fills the log when a player save-result fails with minimal fields', async () => {
        render(<AOEConditionModal {...makeProps()} />);
        selectTarget('PlayerAlly');
        await flush(clickApply);
        const promptId = sendSavePrompt.mock.calls[0][1].promptId;

        // Genuinely minimal detail: no roll/total/saveBonus — pins the ?? 0 fallback.
        await flush(() => fireEvent(window, new CustomEvent('save-result', {
            detail: { promptId, success: false },
        })));

        const writes = conditionWritesFor('PlayerAlly');
        expect(writes).toHaveLength(1);
        expect(writes[0][2]).toEqual(['blinded']);

        expect(saveResultFor('PlayerAlly')).toMatchObject({
            characterName: 'Wizard1',
            targetName: 'PlayerAlly',
            saveType: 'CON',
            saveDc: 12,
            success: false,
            roll: 0,
            total: 0,
            saveBonus: 0,
        });
        expect(loggedEntries('condition')).toHaveLength(1);
        expect(targetResultFor('PlayerAlly')).toMatchObject({
            saveResult: 'failure',
            conditions: ['blinded'],
        });
        expect(persistAndNotify).toHaveBeenCalled();
        expect(summaryText()).toMatch(/0\s*targets saved,\s*1\s*target failed/);
    });

    it('resolves NPCs locally and prompts the player in one cast, then folds the player result into the summary', async () => {
        render(<AOEConditionModal {...makeProps({ saveDc: FAIL_ANY_SAVE_DC })} />);
        selectTarget('Goblin');
        selectTarget('Orc');
        selectTarget('PlayerAlly');
        await flush(clickApply);

        // Both NPCs auto-resolved (DC 23 beats even Orc's +2); each gets its own write.
        expect(conditionWritesFor('Goblin')).toHaveLength(1);
        expect(conditionWritesFor('Orc')).toHaveLength(1);
        expect(conditionWritesFor('Goblin')[0][2]).toContain('blinded');
        expect(conditionWritesFor('Orc')[0][2]).toContain('blinded');

        const goblinSave = saveResultFor('Goblin');
        expect(goblinSave).toMatchObject({ success: false, saveBonus: 0 });
        expect(goblinSave.total).toBe(goblinSave.roll);

        const orcSave = saveResultFor('Orc');
        expect(orcSave).toMatchObject({ success: false, saveBonus: 2 });
        expect(orcSave.total).toBe(orcSave.roll + 2);

        // Only the player is prompted, once.
        expect(sendSavePrompt).toHaveBeenCalledTimes(1);
        expect(sendSavePrompt.mock.calls[0][1]).toMatchObject({ targetName: 'PlayerAlly' });
        expect(conditionWritesFor('PlayerAlly')).toHaveLength(0);

        // Player fail arrives → summary now counts all three.
        const promptId = sendSavePrompt.mock.calls[0][1].promptId;
        await flush(() => fireEvent(window, new CustomEvent('save-result', {
            detail: { promptId, success: false, roll: 4, total: 5, saveBonus: 1 },
        })));

        expect(conditionWritesFor('PlayerAlly')).toHaveLength(1);
        expect(summaryText()).toMatch(/0\s*targets saved,\s*3\s*targets failed/);
        expect(persistAndNotify).toHaveBeenCalled();
    });
});
