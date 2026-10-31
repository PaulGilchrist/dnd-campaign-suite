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
});
