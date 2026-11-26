// @maintained-by-ai 2026-11-22
// Backlog 2026-11-22 UI23 follow-up: refused-edit preservation. The freshness
// 409 honestly refuses a stale save, but the lane's founding doctrine is
// "navigating away never discards them" — so the refused bytes are parked in
// the module-scoped preservation memory and re-presented behind the notice on
// the next mount (never a silent rehydrate to the server's bytes). The parked
// copy POSTs nothing on its own (no 409 retry storm while the notice dwells);
// it is resolved only by an explicit Reload plan (discard) or the new
// Keep my version (re-arm on the server's current stamp, then one POST).
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

const CONFLICT_ERROR = 'The build plan was modified in another tab or session since you loaded it — reload the plan to get the newer version — your edit was NOT saved.';

const STORED_PLAN = { scope: 'arc', storySummary: 'Cult on the ice', entityPlan: [{ kind: 'npc', count: 2 }], savedAt: 5 };

// Comfortably past the component's 400 ms save debounce.
const PLAN_WAIT_MS = 700;

// The other tab's newer save the refused tab is stale against.
const NEWER_PLAN = { scope: 'arc', storySummary: 'Cult on the ice', entityPlan: [{ kind: 'npc', count: 3 }], savedAt: 40 };

// Fresh module instance per test: the preservation Map is module-scoped by
// design (it survives unmounts), so it must not bleed across tests.
let AiDesignerSection;

beforeEach(async () => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.getAiStatus.mockResolvedValue({ configured: true });
    api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: STORED_PLAN, lastError: null });
    api.saveDesignerPendingPlan.mockResolvedValue({ ok: true, pending: true, savedAt: 11 });
    vi.resetModules();
    AiDesignerSection = (await import('./AiDesignerSection.jsx')).default;
});

// Stage an edit, let the debounced POST get refused 409, and settle.
async function refuseAnEdit(viewCampaign, count = '9') {
    const view = render(<AiDesignerSection campaignName={viewCampaign} />);
    await screen.findByText('Review the build plan');
    api.saveDesignerPendingPlan.mockResolvedValue({ ok: false, conflict: true, error: CONFLICT_ERROR });
    fireEvent.change(screen.getByLabelText('npcs'), { target: { value: count } });
    await screen.findByRole('alert');
    return view;
}

describe('refused plan edit preservation', () => {
    it('a refused edit survives a view-leave and return — editor re-presents the rejected bytes behind the notice, zero re-POSTs', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = await refuseAnEdit('preserve');

        // Navigating away: the debounced POST already fired, so the unmount
        // flush finds nothing staged — and must NOT invent a retry POST.
        const postsAtRefusal = api.saveDesignerPendingPlan.mock.calls.length;
        view.unmount();

        // Returning to the view: the editor shows the REJECTED bytes (9), not
        // the server's newer ones (3), and the notice is maintained.
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: NEWER_PLAN, lastError: null });
        render(<AiDesignerSection campaignName="preserve" />);
        await screen.findByText('Review the build plan');
        expect(screen.getByLabelText('npcs').value).toBe('9');
        const notice = await screen.findByRole('alert');
        expect(notice.className).toContain('ai-designer-conflict');
        expect(notice.textContent).toContain('NOT saved');
        expect(api.saveDesignerPendingPlan.mock.calls.length).toBe(postsAtRefusal);

        // The dwelling notice stays silent: past the debounce window nothing
        // re-arms the POST lane (criterion 3 — no 409 retry storm).
        await new Promise(resolve => setTimeout(resolve, PLAN_WAIT_MS));
        expect(api.saveDesignerPendingPlan.mock.calls.length).toBe(postsAtRefusal);
        warnSpy.mockRestore();
    });

    it('the preserved refused edit stays write-gated on its stale stamp — a further edit is refused again, never silently pushed', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = await refuseAnEdit('gated');
        view.unmount();
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: NEWER_PLAN, lastError: null });
        render(<AiDesignerSection campaignName="gated" />);
        await screen.findByRole('alert');

        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '7' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenLastCalledWith(
            // Echoes the REFUSED stamp (5), not the freshly-read server stamp
            // (40): the parked edit cannot sneak past the freshness contract.
            expect.objectContaining({ campaignName: 'gated', savedAt: 5 })
        ));
        expect(screen.getByLabelText('npcs').value).toBe('7');
        expect(screen.getByRole('alert').textContent).toContain('NOT saved');
        warnSpy.mockRestore();
    });

    it('Reload plan after a return adopts the server bytes, clears the notice, and retires the parked edit', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = await refuseAnEdit('reload-return');
        view.unmount();
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: NEWER_PLAN, lastError: null });
        const view2 = render(<AiDesignerSection campaignName="reload-return" />);
        await screen.findByRole('alert');

        fireEvent.click(screen.getByRole('button', { name: /reload plan/i }));
        await waitFor(() => expect(screen.getByLabelText('npcs').value).toBe('3'));
        expect(screen.queryByRole('alert')).toBeNull();

        // Discard is terminal: another view-leave and return rehydrates the
        // server's version — the parked edit is gone.
        view2.unmount();
        render(<AiDesignerSection campaignName="reload-return" />);
        await screen.findByText('Review the build plan');
        expect(screen.getByLabelText('npcs').value).toBe('3');
        expect(screen.queryByRole('alert')).toBeNull();
        warnSpy.mockRestore();
    });

    it('Keep my version adopts the server stamp then pushes the editor bytes once — notice clears and the parked edit is spent', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = await refuseAnEdit('keep');
        view.unmount();
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: NEWER_PLAN, lastError: null });
        const view2 = render(<AiDesignerSection campaignName="keep" />);
        await screen.findByRole('alert');
        const postsBeforeKeep = api.saveDesignerPendingPlan.mock.calls.length;
        api.saveDesignerPendingPlan.mockResolvedValue({ ok: true, pending: true, savedAt: 41 });

        fireEvent.click(screen.getByRole('button', { name: /keep my version/i }));
        // Exactly one POST, echoed against the CURRENT server stamp (40).
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenLastCalledWith(
            expect.objectContaining({
                campaignName: 'keep',
                savedAt: 40,
                scope: expect.objectContaining({
                    entityPlan: expect.arrayContaining([expect.objectContaining({ kind: 'npc', count: 9 })]),
                }),
            })
        ));
        expect(api.saveDesignerPendingPlan.mock.calls.length).toBe(postsBeforeKeep + 1);
        expect(screen.queryByRole('alert')).toBeNull();

        // Server now holds this tab's bytes: a return shows them with no notice.
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: { ...NEWER_PLAN, entityPlan: [{ kind: 'npc', count: 9 }], savedAt: 41 }, lastError: null });
        view2.unmount();
        render(<AiDesignerSection campaignName="keep" />);
        await screen.findByText('Review the build plan');
        expect(screen.getByLabelText('npcs').value).toBe('9');
        expect(screen.queryByRole('alert')).toBeNull();
        warnSpy.mockRestore();
    });

    it('an edit refused by the unmount flush also returns preserved — leaving inside the debounce never discards it', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const view = render(<AiDesignerSection campaignName="flush-refused" />);
        await screen.findByText('Review the build plan');
        // Stage an edit and LEAVE inside the 400 ms debounce: the flush POST
        // rides unmounted and is refused.
        api.saveDesignerPendingPlan.mockResolvedValue({ ok: false, conflict: true, error: CONFLICT_ERROR });
        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '9' } });
        view.unmount();
        await waitFor(() => expect(warnSpy).toHaveBeenCalledWith(
            '[ai-designer] pending plan flush rejected', CONFLICT_ERROR
        ));

        // Return: the refused flush bytes are re-presented behind the notice.
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: NEWER_PLAN, lastError: null });
        render(<AiDesignerSection campaignName="flush-refused" />);
        await screen.findByRole('alert');
        expect(screen.getByLabelText('npcs').value).toBe('9');
        warnSpy.mockRestore();
    });

    it('a plain (never-refused) mount still rehydrates the server bytes — the memory is inert without a conflict', async () => {
        render(<AiDesignerSection campaignName="inert" />);
        await screen.findByText('Review the build plan');
        expect(screen.getByLabelText('npcs').value).toBe('2');
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
