// @maintained-by-ai
// Campaign-authoring Phase 4 — designer section lanes: AI-off hint, chat
// round-trip, plan proposal → editable counts → generate → draft summary,
// honest failure surfacing, and the pending-plan persistence added for the
// designer-plan-state-volatile backlog (rehydrate on mount, edits POST to
// design-notes, explicit clear, clean fresh-campaign state).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const api = vi.hoisted(() => ({
    getAiStatus: vi.fn(),
    loadDesignerConversation: vi.fn(),
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
    api.loadDesignerConversation.mockResolvedValue({ messages: [{ role: 'ai', content: 'What are we building?', at: 1 }] });
    api.saveDesignerPendingPlan.mockResolvedValue({ ok: true, pending: true });
});

describe('AiDesignerSection', () => {
    it('points to Admin config when AI is off', async () => {
        api.getAiStatus.mockResolvedValue({ configured: false });
        render(<AiDesignerSection campaignName="c" />);
        expect(await screen.findByText(/configure AI in Admin/i)).toBeTruthy();
    });

    it('loads the persisted conversation and sends a chat turn', async () => {
        api.designerChat.mockResolvedValue({ ok: true, reply: 'Love the cult idea — what is its public face?' });
        render(<AiDesignerSection campaignName="c" />);
        await screen.findByText('What are we building?');

        fireEvent.change(screen.getByPlaceholderText('What are we building?'), { target: { value: 'A frost cult' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));

        await waitFor(() => expect(api.designerChat).toHaveBeenCalledWith({ campaignName: 'c', message: 'A frost cult' }));
        expect(await screen.findByText(/public face/)).toBeTruthy();
        expect(screen.getByText('A frost cult')).toBeTruthy();
    });

    it('renders persisted gm+ai messages sharing one at-timestamp without duplicate React keys', async () => {
        // designNotes.appendMessages stamps both messages of a round-trip with the
        // SAME Date.now() — the thread must still key each row uniquely (bug: the
        // shared `at` produced "two children with the same key" on every rehydrate).
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        api.loadDesignerConversation.mockResolvedValue({
            messages: [
                { role: 'gm', content: 'Hi there', at: 1793447128891 },
                { role: 'ai', content: 'Hello GM', at: 1793447128891 },
            ],
        });
        render(<AiDesignerSection campaignName="c" />);
        expect(await screen.findByText('Hi there')).toBeTruthy();
        expect(screen.getByText('Hello GM')).toBeTruthy();

        const dupKeyCall = errSpy.mock.calls.find(args => String(args[0]).includes('same key'));
        errSpy.mockRestore();
        expect(dupKeyCall).toBeUndefined();
    });

    it('gives the composer a ≥4-row textarea so long briefs stay readable', async () => {
        render(<AiDesignerSection campaignName="c" />);
        const box = await screen.findByPlaceholderText('What are we building?');
        expect(box.tagName).toBe('TEXTAREA');
        expect(box.rows).toBeGreaterThanOrEqual(4);
    });

    it('proposes a plan, GM edits a count, generation lands as drafts', async () => {
        api.designerPlan.mockResolvedValue({
            ok: true,
            scope: { scope: 'session', sessionNumber: 4, storySummary: 'The ferry ambush', entityPlan: [{ kind: 'encounter', count: 1 }, { kind: 'npc', count: 1 }] },
        });
        api.designerGenerate.mockResolvedValue({ ok: true, created: { encounters: 1, npcs: 1, factions: 0, quests: 0, settlements: 0, sessions: 0, maps: 0 }, snapshot: 'c-2026.zip', errors: [] });
        const onGenerated = vi.fn();
        render(<AiDesignerSection campaignName="c" onGenerated={onGenerated} />);

        fireEvent.click(await screen.findByRole('button', { name: /propose build plan/i }));
        await screen.findByText('Review the build plan');

        // Editable: bump the encounter count from 1 → 2.
        const encounterInput = screen.getByLabelText('encounters');
        fireEvent.change(encounterInput, { target: { value: '2' } });

        fireEvent.click(screen.getByRole('button', { name: /generate drafts/i }));
        await waitFor(() => expect(api.designerGenerate).toHaveBeenCalledWith(
            expect.objectContaining({ campaignName: 'c' })
        ));
        const sentScope = api.designerGenerate.mock.calls[0][0].scope;
        expect(sentScope.entityPlan.find(p => p.kind === 'encounter').count).toBe(2);
        expect(sentScope.sessionNumber).toBe(4); // untouched fields ride through

        expect(await screen.findByText(/restore point/)).toBeTruthy();
        expect(onGenerated).toHaveBeenCalled();
    });

    it('surfaces generation validation errors verbatim', async () => {
        api.designerPlan.mockResolvedValue({ ok: true, scope: { scope: 'bespoke', entityPlan: [] } });
        api.designerGenerate.mockResolvedValue({ ok: false, errors: ['npcs: "Ogre" is a bestiary monster', 'encounters[0]: index unknown'] });
        render(<AiDesignerSection campaignName="c" />);
        fireEvent.click(await screen.findByRole('button', { name: /propose build plan/i }));
        await screen.findByText('Review the build plan');
        fireEvent.click(screen.getByRole('button', { name: /generate drafts/i }));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('bestiary monster');
        expect(alert.textContent).toContain('index unknown');
    });

    // --- designer-plan-state-volatile: persistence lanes -------------------

    it('rehydrates the PlanEditor (plan + edited counts) and the last error from stored notes on mount', async () => {
        api.loadDesignerConversation.mockResolvedValue({
            messages: [{ role: 'gm', content: 'A frost cult', at: 1 }],
            plans: [],
            pendingPlan: { scope: 'one_shot', storySummary: 'Cult on the ice', entityPlan: [{ kind: 'npc', count: 3 }], savedAt: 5 },
            lastError: { stage: 'generate', error: 'encounters[0]: monster index unknown', at: 6 },
        });
        render(<AiDesignerSection campaignName="c" />);
        expect(await screen.findByText('Review the build plan')).toBeTruthy();
        expect(screen.getByLabelText('npcs').value).toBe('3');
        expect(screen.getByDisplayValue('Cult on the ice')).toBeTruthy();
        // last generate error survived the navigation/reload
        expect((await screen.findByRole('alert')).textContent).toContain('monster index unknown');
    });

    it('persists plan edits to the server so navigating away cannot discard them', async () => {
        api.designerPlan.mockResolvedValue({ ok: true, scope: { scope: 'arc', storySummary: 's', entityPlan: [{ kind: 'npc', count: 1 }] } });
        render(<AiDesignerSection campaignName="c" />);
        fireEvent.click(await screen.findByRole('button', { name: /propose build plan/i }));
        await screen.findByText('Review the build plan');

        fireEvent.change(screen.getByLabelText('encounters'), { target: { value: '4' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith(
            expect.objectContaining({
                campaignName: 'c',
                scope: expect.objectContaining({
                    entityPlan: expect.arrayContaining([expect.objectContaining({ kind: 'encounter', count: 4 })]),
                }),
            })
        ));
    });

    it('a fresh campaign (no stored plan) renders the clean chat state without stale bleed', async () => {
        api.loadDesignerConversation.mockResolvedValue({ messages: [], plans: [], pendingPlan: null, lastError: null });
        render(<AiDesignerSection campaignName="c" />);
        expect(await screen.findByPlaceholderText('What are we building?')).toBeTruthy();
        expect(screen.queryByText('Review the build plan')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(api.saveDesignerPendingPlan).not.toHaveBeenCalled();
    });

    it('Back to chat explicitly clears the stored pending plan', async () => {
        api.designerPlan.mockResolvedValue({ ok: true, scope: { scope: 'arc', entityPlan: [] } });
        render(<AiDesignerSection campaignName="c" />);
        fireEvent.click(await screen.findByRole('button', { name: /propose build plan/i }));
        await screen.findByText('Review the build plan');
        fireEvent.click(screen.getByRole('button', { name: /back to chat/i }));
        expect(await screen.findByPlaceholderText('What are we building?')).toBeTruthy();
        expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith({ campaignName: 'c', scope: null });
    });
});
