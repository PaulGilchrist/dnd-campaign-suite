import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, campaignName } from './useCharActionsAutomation.test.setup.js';

// CLA-053: real confirmTelepathicSpeech with faked runtime/log seams — proves
// the producer actually writes awakenedMindTarget + activeBuffs + bond log.
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const hexWarlock = {
    name: 'HexWarlock',
    level: 14,
    proficiency: 5,
    abilities: [
        { name: 'Charisma', bonus: 3 },
        { name: 'Wisdom', bonus: 1 },
    ],
    automation: { passives: [] },
};

const awakenedMindAction = {
    name: 'Awakened Mind',
    automation: { type: 'temp_buff', effect: 'telepathic_speech', duration: 'warlock_level_minutes', action: 'bonus_action' },
};

function pickTelemetry(setModalState) {
    const call = setModalState.mock.calls.find(([arg]) => arg.secondaryTargetModal);
    return call[0].secondaryTargetModal;
}

describe('CLA-053 Awakened Mind producer wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation(() => null);
        setRuntimeValue.mockResolvedValue(undefined);
    });

    it('Establish Link chains confirmTelepathicSpeech and writes awakenedMindTarget + bond log', async () => {
        const hooks = createHooks({ playerStats: hexWarlock });
        hooks.executeHandler.mockResolvedValue({
            type: 'modal',
            modalName: 'telepathicSpeech',
            payload: {
                action: awakenedMindAction,
                playerStats: hexWarlock,
                campaignName,
                creatureTargets: [{ name: 'Bandit 1', currentHp: 11, maxHp: 11 }],
            },
        });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(awakenedMindAction);

        const picker = pickTelemetry(hooks.setModalState);
        expect(picker.confirmLabel).toBe('Establish Link');

        await picker.onTargetSelected('Bandit 1');

        // Picker closes
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
        hooks.executeHandler.mockResolvedValue({
            type: 'modal',
            modalName: 'telepathicSpeech',
            payload: {
                action: awakenedMindAction,
                playerStats: hexWarlock,
                campaignName,
                creatureTargets: [{ name: 'Bandit 1' }],
            },
        });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(awakenedMindAction);

        const picker = pickTelemetry(hooks.setModalState);
        picker.onSkip();

        expect(hooks.setModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
        expect(setRuntimeValue).not.toHaveBeenCalledWith('HexWarlock', 'awakenedMindTarget', expect.anything(), campaignName);
        expect(addEntry).not.toHaveBeenCalled();
    });
});
