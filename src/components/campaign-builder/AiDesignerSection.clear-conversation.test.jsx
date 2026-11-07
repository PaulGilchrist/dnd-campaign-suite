// @maintained-by-ai
// Backlog 2026-11-07 DJ: authoring residue (design-notes.json) lives outside
// the Admin "Clear Change Data" lane, so the designer carries its own reset.
// The "Clear Designer Conversation" button opens the shared DeleteConfirmModal
// role="dialog" tier (never window.confirm), and confirming blanks the ledger
// through the dedicated clear route while the section resets chat/plan/error
// state in place — no reload, no other campaign data touched.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const api = vi.hoisted(() => ({
    getAiStatus: vi.fn(),
    loadDesignerConversation: vi.fn(),
    clearDesignerConversation: vi.fn(),
    saveDesignerPendingPlan: vi.fn(),
    designerChat: vi.fn(),
    designerPlan: vi.fn(),
    designerGenerate: vi.fn(),
}));
vi.mock('../../services/ai/aiClient.js', () => api);

import AiDesignerSection from './AiDesignerSection.jsx';

beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.getAiStatus.mockResolvedValue({ configured: true });
    api.loadDesignerConversation.mockResolvedValue({
        storySummary: 'spine',
        messages: [
            { role: 'gm', content: 'A frost cult', at: 1 },
            { role: 'ai', content: 'Love it — what is its public face?', at: 2 },
        ],
        plans: [{ scope: 'arc', proposedAt: 3 }],
        pendingPlan: null,
        lastError: null,
    });
    api.saveDesignerPendingPlan.mockResolvedValue({ ok: true, pending: false });
    api.clearDesignerConversation.mockResolvedValue({
        ok: true,
        notes: { storySummary: null, messages: [], plans: [], pendingPlan: null, lastError: null },
    });
});

describe('AiDesignerSection clear-conversation (2026-11-07 DJ)', () => {
    it('opens the shared role="dialog" confirm; Cancel keeps the conversation and never POSTs', async () => {
        render(<AiDesignerSection campaignName="c" />);
        await screen.findByText('A frost cult');

        fireEvent.click(screen.getByRole('button', { name: /clear designer conversation/i }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.textContent).toContain('design-notes.json');

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(api.clearDesignerConversation).not.toHaveBeenCalled();
        expect(screen.getByText('A frost cult')).toBeTruthy();
    });

    it('confirming clears through the dedicated lane and resets the thread without a reload', async () => {
        render(<AiDesignerSection campaignName="c" />);
        await screen.findByText('A frost cult');

        fireEvent.click(screen.getByRole('button', { name: /clear designer conversation/i }));
        fireEvent.click(await screen.findByRole('button', { name: /yes, clear/i }));

        await waitFor(() => expect(api.clearDesignerConversation).toHaveBeenCalledWith({ campaignName: 'c' }));
        // Chat state reset in place: the fresh-campaign empty copy is back and
        // the old thread rows are gone.
        expect(await screen.findByText(/tell the AI your story ideas/i)).toBeTruthy();
        expect(screen.queryByText('A frost cult')).toBeNull();
        expect(screen.queryByText(/public face/)).toBeNull();
        // Only the clear lane was hit — the pending-plan lane was NOT
        // re-POSTed (the server-side blank already covers it).
        expect(api.saveDesignerPendingPlan).not.toHaveBeenCalled();
    });

    it('clearing from the PlanEditor view drops the plan back to a clean chat', async () => {
        api.loadDesignerConversation.mockResolvedValue({
            messages: [{ role: 'gm', content: 'A frost cult', at: 1 }],
            plans: [{ scope: 'arc', proposedAt: 3 }],
            pendingPlan: { scope: 'arc', storySummary: 's', entityPlan: [{ kind: 'npc', count: 2 }], savedAt: 4 },
            lastError: { stage: 'generate', error: 'stale failure', at: 5 },
        });
        render(<AiDesignerSection campaignName="c" />);
        await screen.findByText('Review the build plan');
        expect(screen.getByRole('alert').textContent).toContain('stale failure');

        fireEvent.click(screen.getByRole('button', { name: /clear designer conversation/i }));
        fireEvent.click(await screen.findByRole('button', { name: /yes, clear/i }));

        await waitFor(() => expect(api.clearDesignerConversation).toHaveBeenCalled());
        expect(await screen.findByPlaceholderText('What are we building?')).toBeTruthy();
        expect(screen.queryByText('Review the build plan')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByText('A frost cult')).toBeNull();
    });

    it('a failed clear surfaces the server error instead of silently resetting', async () => {
        api.clearDesignerConversation.mockResolvedValue({ ok: false, error: 'clear lane exploded' });
        render(<AiDesignerSection campaignName="c" />);
        await screen.findByText('A frost cult');

        fireEvent.click(screen.getByRole('button', { name: /clear designer conversation/i }));
        fireEvent.click(await screen.findByRole('button', { name: /yes, clear/i }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('clear lane exploded');
        // conversation preserved — nothing reset on failure
        expect(screen.getByText('A frost cult')).toBeTruthy();
    });
});
