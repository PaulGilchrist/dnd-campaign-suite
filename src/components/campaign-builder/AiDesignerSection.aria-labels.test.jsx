// @maintained-by-ai
// Backlog 2026-11-13 XA: every form control inside the PlanEditor
// (.ai-designer-plan) must carry an explicit, unique, non-empty aria-label that
// mirrors its visible label text, so automation can resolve controls by
// accessible name (getByRole(..., { name }) — never nth()). This test pins the
// ten controls: Scope select, Levels (min)/(max), Story spine, 7 kind counts.
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
    api.loadDesignerConversation.mockResolvedValue({ messages: [{ role: 'ai', content: 'What are we building?', at: 1 }] });
    api.saveDesignerPendingPlan.mockResolvedValue({ ok: true, pending: true });
});

// Mirrors the visible label text: PLAN_KINDS rendered as `${kind}s`.
const COUNT_LABELS = ['factions', 'settlements', 'npcs', 'quests', 'encounters', 'sessions', 'mapPlans'];

async function openPlanEditor() {
    api.designerPlan.mockResolvedValue({
        ok: true,
        scope: { scope: 'arc', storySummary: 'Cult on the ice', entityPlan: [{ kind: 'npc', count: 2 }] },
    });
    render(<AiDesignerSection campaignName="c" />);
    fireEvent.click(await screen.findByRole('button', { name: /propose build plan/i }));
    await screen.findByText('Review the build plan');
}

describe('PlanEditor accessible names', () => {
    it('gives the Scope select a unique accessible name', async () => {
        await openPlanEditor();
        const matches = screen.getAllByRole('combobox', { name: 'Scope' });
        expect(matches).toHaveLength(1);
        expect(matches[0].getAttribute('aria-label')).toBe('Scope');
    });

    it('names the Levels (min) and Levels (max) spinbuttons uniquely', async () => {
        await openPlanEditor();
        for (const name of ['Levels (min)', 'Levels (max)']) {
            const matches = screen.getAllByRole('spinbutton', { name });
            expect(matches).toHaveLength(1);
            expect(matches[0].getAttribute('aria-label')).toBe(name);
        }
    });

    it('names the Story spine textarea uniquely', async () => {
        await openPlanEditor();
        const matches = screen.getAllByRole('textbox', { name: 'Story spine' });
        expect(matches).toHaveLength(1);
        expect(matches[0].getAttribute('aria-label')).toBe('Story spine');
    });

    it('names each of the 7 entity-kind count inputs by its visible label text', async () => {
        await openPlanEditor();
        for (const label of COUNT_LABELS) {
            // exactly one match per accessible name, via role+name (no nth())
            const matches = screen.getAllByRole('spinbutton', { name: label });
            expect(matches).toHaveLength(1);
            expect(matches[0].getAttribute('aria-label')).toBe(label);
            // getByLabel resolves the same single control
            expect(screen.getByLabelText(label)).toBe(matches[0]);
        }
    });

    it('accessible-name queries still drive plan edits (no behavioral change)', async () => {
        await openPlanEditor();
        fireEvent.change(screen.getByRole('spinbutton', { name: 'npcs' }), { target: { value: '5' } });
        await waitFor(() => expect(api.saveDesignerPendingPlan).toHaveBeenCalledWith(
            expect.objectContaining({
                campaignName: 'c',
                scope: expect.objectContaining({
                    entityPlan: expect.arrayContaining([expect.objectContaining({ kind: 'npc', count: 5 })]),
                }),
            })
        ));
    });
});
