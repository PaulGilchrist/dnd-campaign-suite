// @maintained-by-ai
// Integration lane: genuine cross-step seams only — overlay-click close behavior
// spanning choice→result (non-interactive copy hosts are asserted, never clicked —
// pass #261 rec), the null freeCastCountKey guard on the decrement lane (text renders
// no count when no write lands — pass #258), the mistyEscape free-cast skip log/result
// seam, and the taunting chooser→skip→result flow.
// Copy is owned by render.test.jsx; exact step payloads by refreshingStep,
// disappearingStep (#256), dreadfulStep (#257), and bewitching (#254).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepsOfTheFeyTauntModal from './StepsOfTheFeyTauntModal.jsx';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js';
import { addEntry } from '../../../services/ui/logService.js';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';

const promptState = vi.hoisted(() => ({ n: 0 }));

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
    // Real contract (savePrompt.js:105-145): (campaignName, config) =>
    // { promptId, promise }. Deterministic name-agnostic unique-per-mint ids
    // (mirrors utils.guid() minting; the old Math.random suffix was
    // non-deterministic, and prompt-<targetName> ids latent-collide across
    // listeners sharing a prompt name — fix#1426/#1431 family). The promise
    // routes event.detail BY its own promptId on a one-shot 'save-result'
    // listener (savePrompt.js:121-131).
    createSaveListener: vi.fn((_campaignName, _config) => {
        const promptId = `save-guid-${++promptState.n}`;
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
    getTargetFromAttacker: vi.fn(() => null),
}));

const basePlayerStats = { name: 'FeyTrickster' };
const baseTargets = [
    { name: 'Goblin1', currentHp: 5, maxHp: 7 },
    { name: 'Orc1', currentHp: 12, maxHp: 15 },
];

const baseProps = {
    mode: 'normal',
    title: 'Steps of the Fey',
    targets: baseTargets,
    action: { name: 'Steps of the Fey', automation: { type: 'class_feature' } },
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    saveDc: 14,
    featureName: 'Steps of the Fey',
    newCount: 3,
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

describe('StepsOfTheFeyTauntModal - Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('never closes on overlay clicks — holds the choice step, then the result view', async () => {
        const onClose = vi.fn();
        const { container } = render(<StepsOfTheFeyTauntModal {...makeProps({ onClose })} />);

        // Choice step: an overlay click must not close or advance. The prompt <p> is
        // non-interactive — asserted present with its exact copy instead of clicked
        // (the old fireEvent.click on it was no-op theater, pass #261 rec).
        fireEvent.click(container.firstChild);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText(/Choose how you use/).textContent)
            .toBe('Choose how you use Steps of the Fey:');

        // Resolve the refreshing lane to reach the result view.
        fireEvent.click(screen.getByText('Refreshing Step'));
        fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        // Result view: same click-through behavior — only Done closes. The bold
        // 'Refreshing Step:' label lives in the non-interactive sp-body — asserted,
        // not clicked (no-op theater removed, pass #261 rec).
        fireEvent.click(container.firstChild);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText('Refreshing Step:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('completes the refreshing lane without any runtime write when freeCastCountKey is null', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 3, freeCastCountKey: null })} />);
        fireEvent.click(screen.getByText('Refreshing Step'));
        fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        // Lane ran to completion — the temp-HP benefit landed...
        expect(setTempHp).toHaveBeenCalledWith('FeyTrickster', expect.any(Number), 'test-campaign');
        // ...while the missing counter key wrote nothing to the runtime store...
        expect(setRuntimeValue).not.toHaveBeenCalled();
        // ...and the result copy renders NO remaining-count (pass #258: the
        // '(N remaining)' suffix is returned by decrementCount only when a
        // write lands; this branch previously claimed '(2 remaining)' unwritten).
        const body = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal').querySelector('.sp-body');
        expect(body.textContent).not.toContain('remaining');
    });

    it('free-cast skip in mistyEscape mode logs the free cast, shows the remaining count, and consumes no uses', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps({ mode: 'mistyEscape', newCount: 3 })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Misty Step only (free cast)' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });
        expect(screen.getByText(/3 remaining/)).toBeInTheDocument();

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'FeyTrickster',
            abilityName: 'Steps of the Fey',
            description: expect.stringContaining('cast Misty Step for free'),
        }));
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('skip from the taunting chooser resolves to a no-targets Taunting result without dispatching saves or writes', async () => {
        render(<StepsOfTheFeyTauntModal {...makeProps({ newCount: 5 })} />);

        // Cross-step seam: choice → taunting target chooser.
        fireEvent.click(screen.getByText('Taunting Step'));
        expect(screen.getByText('Taunting Step: Select creatures to taunt.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        });

        const body = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal').querySelector('.sp-body');
        // Exact bytes: skipped choice is 'taunting', so the bold label must
        // be Taunting Step regardless of modal mode (derivation source: choice).
        expect(body.textContent).toBe(
            'Steps of the Fey: Cast Misty Step without expending a spell slot (5 remaining).Taunting Step: No targets selected.'
        );
        expect(body.innerHTML).toBe(
            'Steps of the Fey: Cast Misty Step without expending a spell slot (5 remaining).<br><br><b>Taunting Step:</b> No targets selected.'
        );
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
