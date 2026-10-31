// @maintained-by-ai
// Campaign-authoring Phase 6 — the AI button on an object: instruction →
// replacement lands in the CALLER's form state (never saved here), errors
// surface inline, and a closed prompt clears state.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const refineEntity = vi.fn();
vi.mock('../../services/ai/aiClient.js', () => ({ refineEntity: (...a) => refineEntity(...a) }));

import AiRefineButton from './AiRefineButton.jsx';

beforeEach(() => refineEntity.mockReset());

describe('AiRefineButton', () => {
    it('collapsed until opened, then proposes into the editor form on success', async () => {
        const onReplaced = vi.fn();
        render(<AiRefineButton campaignName="c" kind="npc" entity={{ name: 'Oldhem' }} onReplaced={onReplaced} />);
        expect(screen.queryByPlaceholderText(/what should change/i)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'make him a cult spy' } });
        refineEntity.mockResolvedValue({ ok: true, replacement: { name: 'Oldhem', secrets: 'Cult spy' } });
        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

        await waitFor(() => expect(refineEntity).toHaveBeenCalledWith({
            campaignName: 'c', kind: 'npc', entity: { name: 'Oldhem' }, instruction: 'make him a cult spy',
        }));
        expect(onReplaced).toHaveBeenCalledWith({ name: 'Oldhem', secrets: 'Cult spy' });
        // Applied → collapsed again, ready for the next pass.
        expect(screen.getByRole('button', { name: /refine with AI/i })).toBeTruthy();
    });

    it('keeps the prompt open with joined server errors on failure', async () => {
        const onReplaced = vi.fn();
        refineEntity.mockResolvedValue({ ok: false, errors: ['attitude must be one of', 'name is required'] });
        render(<AiRefineButton campaignName="c" kind="npc" entity={{ name: 'X' }} onReplaced={onReplaced} />);
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'do it' } });
        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('attitude must be one of');
        expect(alert.textContent).toContain('name is required');
        expect(onReplaced).not.toHaveBeenCalled();
    });

    it('disabled apply until an instruction exists; cancel closes cleanly', () => {
        render(<AiRefineButton campaignName="c" kind="quest" entity={{ id: 'q1' }} onReplaced={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        expect(screen.getByRole('button', { name: /apply to form/i }).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: /close ai refine/i }));
        expect(screen.queryByPlaceholderText(/what should change/i)).toBeNull();
    });

    // Backlog refine-no-op-silent: an echo-success must surface a hint, keep
    // the row open, and NOT fire the caller's applied-success lane.
    it('surfaces "no changes" hint when the replacement echoes the input (row stays open, form untouched)', async () => {
        const onReplaced = vi.fn();
        const entity = { id: 'n1', updatedAt: 5, draft: false, name: 'Marta', description: 'Innkeeper', attitude: 'neutral' };
        render(<AiRefineButton campaignName="c" kind="npc" entity={entity} onReplaced={onReplaced} />);
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'keep as is' } });
        // Server-owned stamps never round-trip in the proposal; key order differs.
        refineEntity.mockResolvedValue({ ok: true, replacement: { description: 'Innkeeper', name: 'Marta', attitude: 'neutral' } });
        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

        const hint = await screen.findByRole('status');
        expect(hint.textContent).toMatch(/model proposed no changes/i);
        expect(onReplaced).not.toHaveBeenCalled();
        // Row stays open so the GM sees the hint, with the input ready for a new ask.
        expect(screen.getByPlaceholderText(/what should change/i).value).toBe('');
        fireEvent.click(screen.getByRole('button', { name: /close ai refine/i }));
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('applies normally (no hint) when the replacement differs in any field', async () => {
        const onReplaced = vi.fn();
        const entity = { id: 'e1', name: 'Ambush', description: 'Few bandits', selectedMonsters: [{ index: 1, name: 'Bandit', qty: 2 }] };
        render(<AiRefineButton campaignName="c" kind="encounter" entity={entity} onReplaced={onReplaced} />);
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'more guards' } });
        refineEntity.mockResolvedValue({
            ok: true,
            replacement: { name: 'Ambush', description: 'Few bandits', selectedMonsters: [{ index: 1, name: 'Bandit', qty: 3 }] },
        });
        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

        await waitFor(() => expect(onReplaced).toHaveBeenCalledWith(expect.objectContaining({
            selectedMonsters: [{ index: 1, name: 'Bandit', qty: 3 }],
        })));
        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.getByRole('button', { name: /refine with AI/i })).toBeTruthy();
    });

    // Backlog ai-instruction-inputs-undersized: the row became a modal.
    it('opens a dialog whose instruction surface is a ≥4-row textarea, closed by × or Escape (backdrop inert)', () => {
        render(<AiRefineButton campaignName="c" kind="npc" entity={{ name: 'X' }} onReplaced={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        const dialog = screen.getByRole('dialog', { name: /refine npc with ai/i });
        const box = screen.getByPlaceholderText(/what should change/i);
        expect(dialog.contains(box)).toBe(true);
        expect(box.tagName).toBe('TEXTAREA');
        expect(box.rows).toBeGreaterThanOrEqual(4);
        // Backdrop click is inert (house modal canon).
        fireEvent.click(document.querySelector('.ai-instruction-overlay'));
        expect(screen.getByPlaceholderText(/what should change/i)).toBeTruthy();
        // Escape and the named × both dismiss.
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByPlaceholderText(/what should change/i)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        fireEvent.click(screen.getByRole('button', { name: /close ai refine/i }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('treats a proposal that drops a filled-in field as a change, not an echo', async () => {
        const onReplaced = vi.fn();
        render(<AiRefineButton campaignName="c" kind="quest" entity={{ id: 'q1', name: 'Lost Artifact', rewards: '500gp' }} onReplaced={onReplaced} />);
        fireEvent.click(screen.getByRole('button', { name: /refine with AI/i }));
        fireEvent.change(screen.getByPlaceholderText(/what should change/i), { target: { value: 'polish it' } });
        refineEntity.mockResolvedValue({ ok: true, replacement: { name: 'Lost Artifact' } });
        fireEvent.click(screen.getByRole('button', { name: /apply to form/i }));

        await waitFor(() => expect(onReplaced).toHaveBeenCalledWith({ name: 'Lost Artifact' }));
        expect(screen.queryByRole('status')).toBeNull();
    });
});
