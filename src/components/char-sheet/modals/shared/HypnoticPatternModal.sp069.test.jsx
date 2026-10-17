// @maintained-by-ai
// HypnoticPatternModal SP-069 lane: description/note rendering (30-foot Cube
// regression pin, interpolated save + DC) and the CLA-101 re-entry latch — a
// mixed NPC+player cast with repeated confirm clicks must run the save lane
// exactly once while the player prompt stays pending. NPC save resolution lives
// in .npc-saves.test.jsx, player save resolution in .player-saves.test.jsx,
// careful/heighten metamagic in .metamagic.test.jsx, overlay/unmount guard in
// .advanced.test.jsx.
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HypnoticPatternModal from './HypnoticPatternModal.jsx';

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

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'DivinationWizard',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
};

const baseAction = {
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, saveBonuses: { wis: 0 } },
        { name: 'Bandit Captain 1', type: 'npc', currentHp: 52, maxHp: 52, saveBonuses: { wis: 3 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 19,
        onClose: vi.fn(),
        ...overrides,
    };
}

const activeConditionWrites = () =>
    setRuntimeValue.mock.calls.filter(call => call[1] === 'activeConditions');

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks(); // restores the Math.random spy so it can't leak
});

describe('HypnoticPatternModal — SP-069', () => {
    it('renders the description as a 30-foot Cube (not the old 20-foot-radius sphere) with the interpolated save, and the shake-free note', () => {
        render(<HypnoticPatternModal {...makeProps()} />);

        const description = document.querySelector('.sp-body p:not(.sp-note)');
        expect(description.textContent).toContain('30-foot Cube');
        expect(description.textContent).toContain('WIS');
        expect(description.textContent).toContain('DC 19');
        // Regression pin: the historical wrong area text must never reappear.
        expect(document.body.textContent).not.toContain('20-foot-radius sphere');

        const note = document.querySelector('.sp-note');
        expect(note.textContent).toContain('Charmed');
        expect(note.textContent).toContain('Incapacitated');
        expect(note.textContent).toContain('Speed 0');
        expect(note.textContent).toContain('shake it free');
    });

    it('CLA-101 latch: three confirm clicks on a mixed NPC+player cast run the save lane exactly once', async () => {
        // Every NPC d20 rolls 1 → forced fail vs DC 19; the player reply is
        // never sent, so the prompt stays pending and the button stays clickable
        // — exactly the scenario where an un-latched re-entry double-paid.
        vi.spyOn(Math, 'random').mockReturnValue(0.01);
        const onClose = vi.fn();

        render(<HypnoticPatternModal {...makeProps({ onClose })} />);

        const rows = [...document.querySelectorAll('.secondary-target-row')];
        await act(async () => { fireEvent.click(rows[0]); }); // Bandit 1 (npc)
        await act(async () => { fireEvent.click(rows[2]); }); // PlayerAlly (player)

        const confirm = () => screen.getByRole('button', { name: /Hypnotic Pattern \(2\)/ });
        await act(async () => { fireEvent.click(confirm()); });
        // Non-vacuity: the latch must actually fire — the button is still live.
        expect(confirm()).toBeEnabled();
        await act(async () => { fireEvent.click(confirm()); });
        await act(async () => { fireEvent.click(confirm()); });

        await waitFor(() => {
            // NPC resolved exactly once with the full condition trio.
            const npcWrites = setRuntimeValue.mock.calls.filter(
                call => call[0] === 'Bandit 1' && call[1] === 'activeConditions'
            );
            expect(npcWrites).toHaveLength(1);
            expect(npcWrites[0][2]).toEqual(['charmed', 'incapacitated', 'speed_zero']);

            // Player prompted exactly once, not resolved — still pending.
            expect(sendSavePrompt).toHaveBeenCalledTimes(1);
            expect(sendSavePrompt.mock.calls[0][1]).toMatchObject({
                targetName: 'PlayerAlly',
                saveType: 'WIS',
                saveDc: 19,
            });

            // Cast logged exactly once, with both targets accounted for.
            const abilityLogs = addEntry.mock.calls
                .map(call => call[1])
                .filter(entry => entry?.type === 'ability_use' && entry?.abilityName === 'Hypnotic Pattern');
            expect(abilityLogs).toHaveLength(1);
            expect(abilityLogs[0].description).toContain('Selecting 2 target(s)');
        });

        // Exactly one expiry schedule (the failed NPC); no other target gained
        // conditions, and the unresolved cast must not close the modal.
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Bandit 1' }));
        expect(activeConditionWrites().filter(call => call[0] !== 'Bandit 1')).toHaveLength(0);
        expect(onClose).not.toHaveBeenCalled();
    });
});
