// @maintained-by-ai
// Refreshing Step lane: confirmation copy + Cancel round-trip (chooser restored,
// inert until confirmed) and the accept dispatch with Math.random pinned — exact
// setTempHp payload (d10 bounds), exact decrement write with freeCastCountKey
// present, exact campaign-log entry (free cast + THP outcome — previously unlogged,
// violating the app-wide "every automation must log" rule), exact result copy,
// Done closes. The null-freeCastCountKey guard is
// owned by integration.test.jsx; chooser copy by render.test.jsx; zero-use
// gating by noUses.test.jsx; other steps' payloads by their own lane files.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js';

// Honest savePrompt mock of the REAL contract (savePrompt.js:105-145):
// createSaveListener(campaignName, config) => { promptId, promise }. The real
// promptId is utils.guid() — name-agnostic, unique per mint — so the mock
// mints `save-guid-<n>` instead of prompt-<targetName>-<n> (name-based ids
// latent-collide across listeners sharing a prompt name; fix#1426/#1431
// family). The promise routes resolution BY its own promptId on a one-shot
// 'save-result' window listener (savePrompt.js:121-131), matching arity+shape
// (fix#215 fidelity law). This lane never dispatches saves (pinned below).
const nextPrompt = vi.hoisted(() => ({ n: 0 }));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn((_campaignName, _config) => {
        const promptId = `save-guid-${++nextPrompt.n}`;
        const promise = new Promise((resolve) => {
            const handleSaveResult = (event) => {
                if (event.detail.promptId !== promptId) return;
                window.removeEventListener('save-result', handleSaveResult);
                resolve(event.detail);
            };
            window.addEventListener('save-result', handleSaveResult);
        });
        return { promptId, promise };
    }),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

const baseProps = {
    mode: 'normal',
    title: 'Steps of the Fey',
    targets: [
        { name: 'Goblin1', currentHp: 5, maxHp: 7 },
        { name: 'Orc1', currentHp: 12, maxHp: 15 },
    ],
    action: { name: 'Steps of the Fey', automation: { type: 'class_feature' } },
    playerStats: { name: 'FeyTrickster' },
    campaignName: 'test-campaign',
    saveDc: 14,
    featureName: 'Steps of the Fey',
    newCount: 3,
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

function clickRefreshingOption() {
    fireEvent.click(screen.getByText('Refreshing Step'));
}

describe('StepsOfTheFeyTauntModal - Refreshing Step', () => {
    let randomSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        randomSpy = vi.spyOn(Math, 'random');
    });

    afterEach(() => {
        randomSpy.mockRestore();
    });

    it('confirms Refreshing Step with exact copy, stays inert until confirmed, and Cancel restores the chooser without dispatching', () => {
        render(<StepsOfTheFeyTauntModal {...makeProps()} />);
        clickRefreshingOption();

        expect(screen.getByText('Refreshing Step')).toBeInTheDocument();
        expect(screen.getByText(/gain 1d10 Temporary Hit Points/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

        // Inert before confirmation — nothing applied, no log, no result view.
        expect(setTempHp).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.getByText(/Choose how you use/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
        expect(setTempHp).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(baseProps.onClose).not.toHaveBeenCalled();
    });

    it.each`
        newCount | randomValue | tempHp | expectedRemaining | featureName
        ${3}     | ${0.99}     | ${10}  | ${2}              | ${'Steps of the Fey'}
        ${1}     | ${0}        | ${1}   | ${0}              | ${'Fey Trickery'}
    `('accepting Refreshing Step from $newCount use(s) grants exactly $tempHp temp HP (Math.random $randomValue), decrements to $expectedRemaining, shows the exact result copy, and Done closes', async ({ newCount, randomValue, tempHp, expectedRemaining, featureName }) => {
        randomSpy.mockReturnValue(randomValue);
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount, featureName, freeCastCountKey: 'stepsRemaining' })} />);
        clickRefreshingOption();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        expect(setTempHp).toHaveBeenCalledTimes(1);
        expect(setTempHp).toHaveBeenCalledWith('FeyTrickster', tempHp, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('FeyTrickster', 'stepsRemaining', expectedRemaining, 'test-campaign');
        // Regression: the resolution must log to the campaign log exactly once
        // with full bytes (app rule "every automation must log"); the temp-HP
        // and decrement writes precede the log.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Refreshing Step',
            description: `FeyTrickster cast Misty Step for free via ${featureName} — no spell slot consumed — teleporting up to 30 feet to an unoccupied space they can see (GM-positioned). Refreshing Step: FeyTrickster gained ${tempHp} Temporary Hit Points.`,
            timestamp: expect.any(Number),
        });
        expect(setTempHp.mock.invocationCallOrder.at(-1)).toBeLessThan(addEntry.mock.invocationCallOrder.at(-1));
        expect(setRuntimeValue.mock.invocationCallOrder.at(-1)).toBeLessThan(addEntry.mock.invocationCallOrder.at(-1));
        expect(document.querySelector('.sp-body').innerHTML).toBe(
            `${featureName}: Cast Misty Step without expending a spell slot (${expectedRemaining} remaining).<br><br><b>Refreshing Step:</b> Gained ${tempHp} Temporary Hit Points.`
        );
        // This lane resolves without any save prompt.
        expect(createSaveListener).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
});
