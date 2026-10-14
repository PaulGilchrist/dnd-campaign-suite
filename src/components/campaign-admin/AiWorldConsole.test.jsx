// @improved-by-ai
// §9.4 — world keeper console (component lane only): the request carries the
// referee's kind/focus, the card's exit is chosen by proposal kind, nothing
// writes until the referee acts, and every failure stays honest.
// Lane internals (apply routing, refusal matrix, audit) are covered by
// applyWorldProposal.test.js; server-side funnel by world.test.js — not re-tested here.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs at the transport seam only — the component's own routing,
// card rendering, and confirm-gate logic run for real.
vi.mock('../../services/ai/aiClient.js', () => ({ askWorldKeeper: vi.fn() }));
vi.mock('../../services/ai/applyWorldProposal.js', () => ({ applyWorldProposal: vi.fn() }));

import { askWorldKeeper } from '../../services/ai/aiClient.js';
import { applyWorldProposal } from '../../services/ai/applyWorldProposal.js';
import AiWorldConsole from './AiWorldConsole.jsx';

const CN = 'test-campaign';

const recap = { kind: 'recap', text: 'Ash and ember.', confidence: 0.9 };
const questDraft = { kind: 'quest_draft', name: 'The Sunken Vault', description: 'Recover it.', rewards: '200 gp' };
const needsHuman = { kind: 'needs_human', text: 'AI world keeper unavailable — the GM supplies this.' };

const generateBtn = () => screen.getByRole('button', { name: /Generate|Writing…/ });
const focusBox = () => screen.getByPlaceholderText(/optional focus/);

/** Pick a kind (and optionally a focus), then hit Generate. */
function askFor({ kind, focus } = {}) {
    if (kind) fireEvent.change(screen.getByRole('combobox'), { target: { value: kind } });
    if (focus !== undefined) fireEvent.change(focusBox(), { target: { value: focus } });
    fireEvent.click(generateBtn());
}

beforeEach(() => {
    vi.clearAllMocks(); // clears stale mockResolvedValue from prior tests
    applyWorldProposal.mockResolvedValue({ applied: true, detail: 'logged.' });
});

describe('AiWorldConsole — the request carries the referee’s intent', () => {
    it('defaults: recap with no focus sends kind=recap, focus=null', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: recap });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());
        await waitFor(() => expect(askWorldKeeper).toHaveBeenCalledWith({ campaignName: CN, kind: 'recap', focus: null }));
    });

    it('selected kind and typed focus are forwarded verbatim', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'rumor', text: 'Coin glints below.' } });
        render(<AiWorldConsole campaignName={CN} />);
        askFor({ kind: 'rumor', focus: 'the faction tension in Bravor' });
        await waitFor(() => expect(askWorldKeeper).toHaveBeenCalledWith({
            campaignName: CN, kind: 'rumor', focus: 'the faction tension in Bravor',
        }));
        await waitFor(() => expect(screen.getByText('Coin glints below.')).toBeInTheDocument());
    });

    it('whitespace-only focus still sends null, not blank noise', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: recap });
        render(<AiWorldConsole campaignName={CN} />);
        askFor({ focus: '   ' });
        await waitFor(() => expect(askWorldKeeper).toHaveBeenCalledWith({ campaignName: CN, kind: 'recap', focus: null }));
    });

    it('while writing, Generate is disabled — repeat clicks never queue a second ask', async () => {
        let resolveAsk;
        askWorldKeeper.mockReturnValue(new Promise((r) => { resolveAsk = r; }));
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());
        await waitFor(() => expect(askWorldKeeper).toHaveBeenCalledTimes(1));
        expect(generateBtn()).toBeDisabled();
        fireEvent.click(generateBtn()); // disabled — must be a no-op
        expect(askWorldKeeper).toHaveBeenCalledTimes(1);

        resolveAsk({ ok: true, proposal: recap });
        await waitFor(() => expect(screen.getByText('Ash and ember.')).toBeInTheDocument());
        expect(generateBtn()).toBeEnabled();
    });
});

describe('AiWorldConsole — the card waits; kind chooses the exit', () => {
    it('recap card shows kind, body, and confidence — NOTHING applies until Log it', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: recap });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());

        await waitFor(() => expect(screen.getByText('Ash and ember.')).toBeInTheDocument());
        expect(screen.getByText('recap')).toBeInTheDocument();
        expect(screen.getByText('confidence 90%')).toBeInTheDocument();
        expect(applyWorldProposal).not.toHaveBeenCalled();
        expect(screen.queryByRole('status')).toBeNull(); // no outcome before action

        fireEvent.click(screen.getByRole('button', { name: 'Log it' }));
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith({ campaignName: CN, proposal: recap }));
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Applied: logged.'));
        expect(screen.queryByText('Ash and ember.')).toBeNull(); // card clears once routed
    });

    it('quest_draft routes to the ledger lane — rewards rendered, no Log it offered', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: questDraft });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());

        await waitFor(() => expect(screen.getByText('The Sunken Vault — Recover it. (rewards: 200 gp)')).toBeInTheDocument());
        expect(screen.getByText('quest draft')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Log it' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Add quest to ledger' }));
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith({ campaignName: CN, proposal: questDraft }));
    });

    it('npc_dialogue card prefixes the speaker and omits confidence when unknown', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'npc_dialogue', npcName: 'Mira', text: 'Trouble follows you.' } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());

        await waitFor(() => expect(screen.getByText('Mira: Trouble follows you.')).toBeInTheDocument());
        expect(screen.queryByText(/confidence/)).toBeNull();
    });

    it('dismiss discards the card without applying or announcing an outcome', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'rumor', text: 'Coin glints below.' } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());
        await waitFor(() => expect(screen.getByText('Coin glints below.')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByText('Coin glints below.')).toBeNull());
        expect(applyWorldProposal).not.toHaveBeenCalled();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('needs_human is surfaced for the GM with no apply route — only dismissal', async () => {
        askWorldKeeper.mockResolvedValue({ ok: false, code: 'AI_NEEDS_HUMAN', proposal: needsHuman });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());

        await waitFor(() => expect(screen.getByText(/GM supplies this/)).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'Log it' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Add quest/ })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByText(/GM supplies this/)).toBeNull());
        expect(applyWorldProposal).not.toHaveBeenCalled();
    });
});

describe('AiWorldConsole — failures stay honest', () => {
    it('a refused ask shows the reason, no card, no apply lane', async () => {
        askWorldKeeper.mockResolvedValue({ ok: false, code: 'AI_ERROR', error: 'AI backend exploded' });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());

        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Not applied: AI backend exploded'));
        expect(screen.queryByRole('button', { name: 'Log it' })).toBeNull();
        expect(screen.queryByText('Dismiss')).toBeNull();
        expect(applyWorldProposal).not.toHaveBeenCalled();
        expect(generateBtn()).toBeEnabled(); // referee may retry
    });

    it('a dead transport (rejected ask) recovers the button with an honest notice', async () => {
        askWorldKeeper.mockRejectedValue(new TypeError('Load failed'));
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());

        await waitFor(() => expect(screen.getByRole('status').textContent).toContain('AI request failed'));
        expect(generateBtn()).toBeEnabled(); // never stranded mid-spin
        expect(screen.queryByText('Dismiss')).toBeNull();
    });

    it('a refused apply says Not applied and clears the card', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: recap });
        applyWorldProposal.mockResolvedValue({ applied: false, detail: 'ledger write failed' });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());
        await waitFor(() => expect(screen.getByText('Ash and ember.')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Log it' }));
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Not applied: ledger write failed'));
        expect(screen.queryByText('Ash and ember.')).toBeNull();
        expect(generateBtn()).toBeEnabled();
    });
});
