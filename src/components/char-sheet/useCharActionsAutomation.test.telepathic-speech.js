// @maintained-by-ai
// CLA-053: real confirmTelepathicSpeech with faked runtime/log seams — proves
// the producer actually writes awakenedMindTarget + activeBuffs + bond log.
// Unmocked-load proof lane (#549/#552): buffHandler loads for real; ONLY the
// runtime store + log seams are faked — never add mocks here.
// Picker telemetry structure is owned by .test.class-feature-modals.js (L150-158);
// this lane pins the onTargetSelected/onSkip producer wiring (#545) only.
import { describe, it, expect, vi } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, campaignName, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

// Minimal stats the producer chain actually reads (#499): name, level
// (duration minutes), Charisma (range miles). Nothing else is consulted.
const hexWarlock = {
    name: 'HexWarlock',
    level: 14,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};

const awakenedMindAction = {
    name: 'Awakened Mind',
    automation: { type: 'temp_buff', effect: 'telepathic_speech', duration: 'warlock_level_minutes', action: 'bonus_action' },
};

const speechPayload = {
    action: awakenedMindAction,
    playerStats: hexWarlock,
    campaignName,
    creatureTargets: [{ name: 'Bandit 1', currentHp: 11, maxHp: 11 }],
};

function pickTelemetry(setModalState) {
    const call = setModalState.mock.calls.find(([arg]) => arg.secondaryTargetModal);
    return call[0].secondaryTargetModal;
}

describe('CLA-053 Awakened Mind producer wiring', () => {
    setupBeforeEach();

    it('Establish Link chains confirmTelepathicSpeech and writes awakenedMindTarget + bond log', async () => {
        const hooks = createHooks({ playerStats: hexWarlock });
        hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName: 'telepathicSpeech', payload: speechPayload });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(awakenedMindAction);

        await pickTelemetry(hooks.setModalState).onTargetSelected('Bandit 1');

        // Picker closes (#545 L68 seam)
        expect(hooks.setModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        // Producer wrote the bond key (sole writer: buffHandler.confirmTelepathicSpeech)
        expect(setRuntimeValue).toHaveBeenCalledWith('HexWarlock', 'awakenedMindTarget', 'Bandit 1', campaignName);
        // Bond log (revived)
        const bondLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Awakened Mind');
        expect(bondLog).toBeTruthy();
        expect(bondLog.description).toContain('Bandit 1');
        // Buff written (toggleBuff) + popup surfaced + badges refreshed
        const buffWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
        expect(buffWrite).toBeTruthy();
        expect(buffWrite[0]).toBe('HexWarlock');
        expect(buffWrite[2].some(b => b.effect === 'telepathic_speech')).toBe(true);
        expect(hooks.setPopupHtml).toHaveBeenCalled();
        expect(hooks.onBuffsChange).toHaveBeenCalled();
    });

    it('Skip keeps the producer inert (no bond key, no log)', async () => {
        const hooks = createHooks({ playerStats: hexWarlock });
        hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName: 'telepathicSpeech', payload: speechPayload });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(awakenedMindAction);

        pickTelemetry(hooks.setModalState).onSkip();

        // Picker closes (#545 L102 seam)
        expect(hooks.setModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        expect(setRuntimeValue).not.toHaveBeenCalledWith('HexWarlock', 'awakenedMindTarget', expect.anything(), campaignName);
        expect(addEntry).not.toHaveBeenCalled();
    });
});
