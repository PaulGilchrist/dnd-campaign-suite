// @maintained-by-ai
// Backlog 2026-11-01 (AV) — applied-state copy on world proposal cards: a
// SUCCESSFUL apply keeps the card mounted and swaps the Apply/Log row for an
// "Applied" badge naming the proposal, leaving no affordance to re-fire the
// same write (the success notice, log pair and disk lane are owned by
// applyWorldProposal.test.js). Failed applies and needs_human keep their
// pre-existing lanes untouched — never a premature applied state.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs at the transport seams only — card rendering and the
// applied-state routing are the units under test here.
vi.mock('../../services/ai/aiClient.js', () => ({ askWorldKeeper: vi.fn() }));
vi.mock('../../services/ai/applyWorldProposal.js', () => ({ applyWorldProposal: vi.fn() }));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../services/campaign/settlementsService.js', () => ({ loadSettlements: vi.fn() }));

import { askWorldKeeper } from '../../services/ai/aiClient.js';
import { applyWorldProposal } from '../../services/ai/applyWorldProposal.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { loadSettlements } from '../../services/campaign/settlementsService.js';
import AiWorldConsole from './AiWorldConsole.jsx';

const CN = 'test-campaign';

const recap = { kind: 'recap', text: 'Ash and ember.', confidence: 0.9 };
const questDraft = { kind: 'quest_draft', name: 'The Sunken Vault', description: 'Recover it.', rewards: '200 gp' };
const needsHuman = { kind: 'needs_human', text: 'AI world keeper unavailable — the GM supplies this.' };

const generateBtn = () => screen.getByRole('button', { name: /Generate|Writing…/ });
const appliedBadge = () => screen.queryByText(/^Applied: (recap|quest 'The Sunken Vault')$/);
const cardButtons = () => document.querySelectorAll('.ai-world-card button');

beforeEach(() => {
    vi.clearAllMocks();
    applyWorldProposal.mockResolvedValue({ applied: true, detail: 'logged.' });
    loadNPCs.mockResolvedValue({ npcs: [] });
    loadSettlements.mockResolvedValue({ settlements: [] });
});

const askFor = async (proposal, kind) => {
    askWorldKeeper.mockResolvedValue(kind === 'needs_human'
        ? { ok: false, code: 'AI_NEEDS_HUMAN', proposal }
        : { ok: true, proposal });
    render(<AiWorldConsole campaignName={CN} />);
    if (kind && kind !== 'recap') fireEvent.change(screen.getByRole('combobox'), { target: { value: kind } });
    fireEvent.click(generateBtn());
    if (kind === 'needs_human') {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument());
        return;
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /Log it|Add quest/ })).toBeInTheDocument());
};

describe('AiWorldConsole — applied-state copy (card stays, action goes)', () => {
    it('successful recap apply: card stays mounted, Applied badge replaces Log it', async () => {
        await askFor(recap);
        fireEvent.click(screen.getByRole('button', { name: 'Log it' }));
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith({ campaignName: CN, proposal: recap }));

        await waitFor(() => expect(appliedBadge()).not.toBeNull());
        expect(appliedBadge().textContent.trim()).toBe('Applied: recap');
        expect(appliedBadge()).toHaveClass('ai-badge', 'ai-badge--on'); // reuses the referee pill + green
        expect(screen.getByText('Ash and ember.')).toBeInTheDocument(); // body still visible as the receipt
        expect(screen.getByText('Applied: logged.')).toBeInTheDocument(); // same success notice as before
        expect(screen.queryByRole('button', { name: 'Log it' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull(); // terminal until the next ask
    });

    it('applied quest card names the ledger row on the badge', async () => {
        await askFor(questDraft, 'quest_draft');
        fireEvent.click(screen.getByRole('button', { name: 'Add quest to ledger' }));

        await waitFor(() => expect(appliedBadge()).not.toBeNull());
        expect(appliedBadge().textContent.trim()).toBe("Applied: quest 'The Sunken Vault'");
        expect(screen.getByText('The Sunken Vault — Recover it. (rewards: 200 gp)')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add quest|Log it/ })).toBeNull();
    });

    it('the applied badge offers no way to re-fire the write', async () => {
        await askFor(questDraft, 'quest_draft');
        fireEvent.click(screen.getByRole('button', { name: 'Add quest to ledger' }));
        await waitFor(() => expect(appliedBadge()).not.toBeNull());

        fireEvent.click(appliedBadge());
        expect(applyWorldProposal).toHaveBeenCalledTimes(1); // clicking the receipt is inert
        expect(cardButtons()).toHaveLength(0); // zero clickable affordances left on the card
    });

    it('the next ask resets the receipt — a fresh card is actionable again', async () => {
        await askFor(recap);
        fireEvent.click(screen.getByRole('button', { name: 'Log it' }));
        await waitFor(() => expect(appliedBadge()).not.toBeNull());

        fireEvent.click(generateBtn());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Log it' })).toBeInTheDocument());
        expect(appliedBadge()).toBeNull();
        expect(applyWorldProposal).toHaveBeenCalledTimes(1); // reset is display-only, no extra write
    });

    it('a failed apply keeps the old lane: card clears, reason notice, no badge', async () => {
        applyWorldProposal.mockResolvedValue({ applied: false, detail: 'ledger write failed' });
        await askFor(recap);
        fireEvent.click(screen.getByRole('button', { name: 'Log it' }));

        await waitFor(() => expect(screen.getByText('Not applied: ledger write failed')).toBeInTheDocument());
        expect(appliedBadge()).toBeNull(); // never a premature applied state
        expect(screen.queryByText('Ash and ember.')).toBeNull();
        expect(generateBtn()).toBeEnabled();
    });

    it('needs_human stays dismiss-only and clears on dismiss — no badge path', async () => {
        await askFor(needsHuman, 'needs_human');
        expect(screen.queryByRole('button', { name: /Log it|Add quest/ })).toBeNull();
        expect(appliedBadge()).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByText(/GM supplies this/)).toBeNull());
        expect(applyWorldProposal).not.toHaveBeenCalled();
        expect(appliedBadge()).toBeNull();
    });
});
