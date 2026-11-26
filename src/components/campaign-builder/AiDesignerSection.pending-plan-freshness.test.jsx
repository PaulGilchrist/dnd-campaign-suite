// @maintained-by-ai 2026-11-22
// Designer pendingPlan freshness contract (backlog 2026-11-22): every save —
// debounced edit, explicit clear, and the unmount flush — echoes the savedAt
// stamp the tab loaded, so a second GM tab's newer save can be refused 409
// instead of silently clobbered. This pins the client half: the echo, the
// plain-English inline notice (mirroring the NPC stale-form 409 face) with
// the editor staying open and staged bytes intact, the Reload-plan recovery,
// and stamp adoption from successful responses.
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

// The rejected-plan preservation memory is module-scoped (it must survive
// component unmounts), so each test needs a fresh module instance — a plain
// static import would bleed a parked edit into the next test's mount.
let AiDesignerSection;

beforeEach(async () => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.getAiStatus.mockResolvedValue({ configured: true });
    api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: STORED_PLAN, lastError: null });
    api.saveDesignerPendingPlan.mockResolvedValue({ ok: true, pending: true, savedAt: 11 });
    vi.resetModules();
    AiDesignerSection = (await import('./AiDesignerSection.jsx')).default;
});

async function openRehydratedEditor() {
    render(<AiDesignerSection campaignName="c" />);
    await screen.findByText('Review the build plan');
}

describe('pendingPlan freshness contract', () => {
    it('echoes the savedAt stamp it loaded on the debounced plan save', async () => {
        await openRehydratedEditor();
        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '4' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith(
            expect.objectContaining({
                campaignName: 'c',
                savedAt: 5, // the stamp carried by the plan this tab loaded
                scope: expect.objectContaining({
                    entityPlan: expect.arrayContaining([expect.objectContaining({ kind: 'npc', count: 4 })]),
                }),
            })
        ));
    });

    it('surfaces a refused (409) save as an inline notice — editor stays open, staged bytes kept', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        api.saveDesignerPendingPlan.mockResolvedValue({ ok: false, conflict: true, error: CONFLICT_ERROR });
        await openRehydratedEditor();
        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '9' } });

        const notice = await screen.findByRole('alert');
        expect(notice.textContent).toContain('modified in another tab or session');
        expect(notice.textContent).toContain('reload the plan to get the newer version');
        expect(notice.textContent).toContain('NOT saved');
        expect(notice.className).toContain('ai-designer-conflict');
        // The plan was NOT silently applied or discarded: the editor is still
        // open showing the user's staged count.
        expect(screen.getByText('Review the build plan')).toBeTruthy();
        expect(screen.getByLabelText('npcs').value).toBe('9');
        // Conflict is a benign rejected edit (NPC-lane law): warn, never red error.
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('the notice offers Reload plan, which rehydrates the server bytes and re-arms the echo stamp', async () => {
        api.saveDesignerPendingPlan.mockResolvedValue({ ok: false, conflict: true, error: CONFLICT_ERROR });
        await openRehydratedEditor();
        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '9' } });
        await screen.findByRole('alert');

        // The other tab's newer save: npcs 3, stamp 77.
        api.loadDesignerConversation.mockResolvedValue({
            messages: [], pendingPlan: { ...STORED_PLAN, entityPlan: [{ kind: 'npc', count: 3 }], savedAt: 77 }, lastError: null,
        });
        fireEvent.click(screen.getByRole('button', { name: /reload plan/i }));
        await waitFor(() => expect(screen.getByLabelText('npcs').value).toBe('3'));
        expect(screen.queryByRole('alert')).toBeNull();

        // Next save echoes the RELOADED stamp, not the stale one.
        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '6' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenLastCalledWith(
            expect.objectContaining({ campaignName: 'c', savedAt: 77 })
        ));
    });

    it('adopts the new server stamp from a successful save so the next echo stays fresh', async () => {
        await openRehydratedEditor();
        fireEvent.change(screen.getByLabelText('encounters'), { target: { value: '4' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith(
            expect.objectContaining({ savedAt: 5 })
        ));
        // Response reported savedAt 11 — the follow-up edit must echo THAT,
        // otherwise the tab would conflict with its own save.
        fireEvent.change(screen.getByLabelText('encounters'), { target: { value: '6' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenLastCalledWith(
            expect.objectContaining({ savedAt: 11 })
        ));
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('the unmount flush rides the same echo — a rejected flush warns (no setState) and the newer save survives', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        api.loadDesignerConversation.mockResolvedValue({ messages: [], pendingPlan: STORED_PLAN, lastError: null });
        const view = render(<AiDesignerSection campaignName="c" />);
        await screen.findByText('Review the build plan');
        // Stage an edit and LEAVE the view inside the 400 ms debounce window.
        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '9' } });
        api.saveDesignerPendingPlan.mockResolvedValue({ ok: false, conflict: true, error: CONFLICT_ERROR });
        view.unmount();

        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith(
            expect.objectContaining({
                campaignName: 'c',
                savedAt: 5, // flush echoes the loaded stamp — the refuse is the contract
                scope: expect.objectContaining({
                    entityPlan: expect.arrayContaining([expect.objectContaining({ kind: 'npc', count: 9 })]),
                }),
            })
        ));
        // Refusal on a dead view only warns — nothing tries to set state.
        await waitFor(() => expect(warnSpy).toHaveBeenCalledWith(
            '[ai-designer] pending plan flush rejected', CONFLICT_ERROR
        ));
        warnSpy.mockRestore();
    });

    it('a never-loaded editor (no stored plan) saves with a null echo and no notice', async () => {
        api.loadDesignerConversation.mockResolvedValue({ messages: [{ role: 'gm', content: 'hi', at: 1 }], pendingPlan: null, lastError: null });
        api.designerPlan.mockResolvedValue({ ok: true, scope: { scope: 'bespoke', entityPlan: [] }, savedAt: 21 });
        render(<AiDesignerSection campaignName="c" />);
        fireEvent.click(await screen.findByRole('button', { name: /propose build plan/i }));
        await screen.findByText('Review the build plan');

        fireEvent.change(screen.getByLabelText('npcs'), { target: { value: '2' } });
        // The /plan response echoed savedAt 21 — the first edit carries it.
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith(
            expect.objectContaining({ campaignName: 'c', savedAt: 21 })
        ));
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
