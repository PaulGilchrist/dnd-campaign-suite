// §9.4 — world keeper console: generate → card → Log it/Add quest/Dismiss.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/ai/aiClient.js', () => ({ askWorldKeeper: vi.fn() }));
vi.mock('../../services/ai/applyWorldProposal.js', () => ({ applyWorldProposal: vi.fn(async () => ({ applied: true, detail: 'logged.' })) }));

import { askWorldKeeper } from '../../services/ai/aiClient.js';
import { applyWorldProposal } from '../../services/ai/applyWorldProposal.js';
import AiWorldConsole from './AiWorldConsole.jsx';

const CN = 'test-campaign';

beforeEach(() => vi.clearAllMocks());

describe('AiWorldConsole', () => {
    it('generate → proposal card waits; Log it routes the proposal', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'recap', text: 'Ash and ember.', confidence: 0.9 } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(screen.getByText('Generate'));
        await waitFor(() => expect(screen.getByText('Ash and ember.')).toBeInTheDocument());
        expect(document.querySelector('.ai-world-head b').textContent).toBe('recap');
        expect(applyWorldProposal).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Log it'));
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith(expect.objectContaining({ campaignName: CN })));
        await waitFor(() => expect(screen.getByText(/Applied: logged\./)).toBeInTheDocument());
    });

    it('quest_draft offers the ledger lane, not the log', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'quest_draft', name: 'The Sunken Vault', description: 'Recover it.' } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(screen.getByText('Generate'));
        await waitFor(() => expect(screen.getByText('Add quest to ledger')).toBeInTheDocument());
        expect(screen.queryByText('Log it')).toBeNull();
        fireEvent.click(screen.getByText('Add quest to ledger'));
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalled());
    });

    it('dismiss discards without applying', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'rumor', text: 'Coin glints below.' } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(screen.getByText('Generate'));
        await waitFor(() => expect(screen.getByText('Coin glints below.')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Dismiss'));
        await waitFor(() => expect(screen.queryByText('Coin glints below.')).toBeNull());
        expect(applyWorldProposal).not.toHaveBeenCalled();
    });

    it('needs_human proposal is surfaced, offering no apply button', async () => {
        askWorldKeeper.mockResolvedValue({ ok: false, code: 'AI_NEEDS_HUMAN', proposal: { kind: 'needs_human', text: 'AI world keeper unavailable — the GM supplies this.' } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(screen.getByText('Generate'));
        await waitFor(() => expect(screen.getByText(/GM supplies this/)).toBeInTheDocument());
        expect(screen.queryByText('Log it')).toBeNull();
        expect(applyWorldProposal).not.toHaveBeenCalled();
    });
});
