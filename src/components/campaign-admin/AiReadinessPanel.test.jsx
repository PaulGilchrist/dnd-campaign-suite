// @maintained-by-ai: 2026-11-22
/**
 * Deferred plan B — AiReadinessPanel: the click-only contract (mount fires
 * ZERO requests), chip derivation per check outcome, the honest listed/not-
 * listed split for chip ②, the dry-run law for the test ruling (nothing is
 * applied — the panel imports no apply lane at all), the needs_human face,
 * the bounded plain-English failure tail, and the recipe disclosure on
 * failure only.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const ai = vi.hoisted(() => ({ fetchAiModels: vi.fn(), askAiReferee: vi.fn() }));
vi.mock('../../services/ai/aiClient.js', () => ({
    fetchAiModels: (...args) => ai.fetchAiModels(...args),
    askAiReferee: (...args) => ai.askAiReferee(...args),
}));

import AiReadinessPanel, { TEST_QUESTION } from './AiReadinessPanel.jsx';

const CFG = { mode: 'suggest', provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2' };
const render_ = (aiConfig = CFG) => render(<AiReadinessPanel campaignName="test-campaign" aiConfig={aiConfig} />);

beforeEach(() => {
    ai.fetchAiModels.mockReset();
    ai.askAiReferee.mockReset();
});
afterEach(cleanup);

describe('AiReadinessPanel (plan B)', () => {
    it('mounts fully idle and contacts NOTHING without a click', () => {
        render_();
        expect(ai.fetchAiModels).not.toHaveBeenCalled();
        expect(ai.askAiReferee).not.toHaveBeenCalled();
        expect(screen.getAllByText('not checked')).toHaveLength(3);
        // No automatic re-check lanes exist: only the two manual buttons.
        expect(screen.getByRole('button', { name: 'Run a check' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ask test ruling' })).toBeInTheDocument();
    });

    it('① pass rides the SAVED config; ② turns green only when the list includes the model', async () => {
        ai.fetchAiModels.mockResolvedValue({ ok: true, models: ['llama3.2', 'qwen'] });
        render_();
        fireEvent.click(screen.getByRole('button', { name: 'Run a check' }));
        await waitFor(() => expect(ai.fetchAiModels).toHaveBeenCalledWith({ endpoint: CFG.endpoint, provider: 'ollama' }));
        await waitFor(() => expect(screen.getAllByText('pass')).toHaveLength(2));
        expect(screen.getByText('“llama3.2” is on the endpoint.')).toBeInTheDocument();
    });

    it('① pass + configured model NOT listed ⇒ ② honest red with a repair hint', async () => {
        ai.fetchAiModels.mockResolvedValue({ ok: true, models: ['mistral'] });
        render_();
        fireEvent.click(screen.getByRole('button', { name: 'Run a check' }));
        await waitFor(() => expect(screen.getByText(/is not in its list/)).toBeInTheDocument());
        expect(screen.getAllByText('fail')).toHaveLength(1);
    });

    it('① fail shows the provider error line + recipe disclosure (hidden on success)', async () => {
        ai.fetchAiModels.mockResolvedValue({ ok: false, error: 'endpoint unreachable' });
        render_();
        expect(screen.queryByText(/How to start a local model server/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Run a check' }));
        await waitFor(() => expect(screen.getByText('endpoint unreachable')).toBeInTheDocument());
        expect(screen.getByText('How to start a local model server')).toBeInTheDocument();
        expect(screen.getByText('Ollama (native API)')).toBeInTheDocument();
    });

    it('③ displays the schema-validated ruling and applies NOTHING (dry-run law)', async () => {
        ai.askAiReferee.mockResolvedValue({ ok: true, ruling: { type: 'dice', expression: '1d20+4' } });
        render_();
        fireEvent.click(screen.getByRole('button', { name: 'Ask test ruling' }));
        await waitFor(() => expect(ai.askAiReferee).toHaveBeenCalledWith(
            expect.objectContaining({ campaignName: 'test-campaign', action: TEST_QUESTION })
        ));
        expect(screen.getByText(/Model answered: dice — 1d20\+4\. Displayed only — nothing was applied\./)).toBeInTheDocument();
    });

    it('③ ok:false + AI_NEEDS_HUMAN is the fail-closed face — honest RED (the model did NOT reply)', async () => {
        ai.askAiReferee.mockResolvedValue({ ok: false, code: 'AI_NEEDS_HUMAN', ruling: { type: 'needs_human', text: 'AI referee unavailable — the referee adjudicates this turn.' } });
        render_();
        fireEvent.click(screen.getByRole('button', { name: 'Ask test ruling' }));
        await waitFor(() => expect(screen.getByText(/No usable ruling — the model was unreachable or answered invalidly/)).toBeInTheDocument());
    });

    it('③ ok:true with a needs_human ANSWER stays green — a healthy judgement deferral', async () => {
        ai.askAiReferee.mockResolvedValue({ ok: true, ruling: { type: 'needs_human', text: 'contested call' } });
        render_();
        fireEvent.click(screen.getByRole('button', { name: 'Ask test ruling' }));
        await waitFor(() => expect(screen.getByText(/Model answered: needs_human\. Displayed only — nothing was applied\./)).toBeInTheDocument());
    });

    it('③ failure reuses the bounded plain-English apply-failure tail', async () => {
        ai.askAiReferee.mockResolvedValue({ ok: false, code: 'AI_ERROR', error: 'HTTP 502' });
        render_();
        fireEvent.click(screen.getByRole('button', { name: 'Ask test ruling' }));
        await waitFor(() => expect(screen.getByText(/the save request failed — nothing was changed\. \(details: HTTP 502\)/)).toBeInTheDocument());
    });

    it('a config change resets every verdict (stale greens never linger)', async () => {
        ai.fetchAiModels.mockResolvedValue({ ok: true, models: ['llama3.2'] });
        const { rerender } = render_();
        fireEvent.click(screen.getByRole('button', { name: 'Run a check' }));
        await waitFor(() => expect(screen.getAllByText('pass').length).toBeGreaterThan(0));
        rerender(<AiReadinessPanel campaignName="test-campaign" aiConfig={{ ...CFG, endpoint: 'http://localhost:9/v1' }} />);
        await waitFor(() => expect(screen.getAllByText('not checked')).toHaveLength(3));
    });
});
