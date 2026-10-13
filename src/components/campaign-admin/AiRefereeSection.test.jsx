// L5-005 §9.2 — AI referee console: off-parity, suggest confirm gate, autopilot atomic auto-apply.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const synced = {};
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: (key, prop, defaultValue) => {
        if (!(prop in synced)) synced[prop] = defaultValue;
        return [synced[prop], (v) => { synced[prop] = v; }];
    },
}));
vi.mock('../../services/ui/clientId.js', () => ({
    getClientId: () => 'cid-test-1',
    withClientId: (h = {}) => ({ ...h, 'X-Client-Id': 'cid-test-1' }),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 9, rolls: [4, 5] })),
    rollAdvantage: vi.fn(() => ({ total: 17, rolls: [8, 17] })),
    rollDisadvantage: vi.fn(() => ({ total: 3, rolls: [3, 12] })),
}));
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    getEffectDefinition: vi.fn(() => null),
}));

import { addEntry } from '../../services/ui/logService.js';
import AiRefereeSection from './AiRefereeSection.jsx';

const CN = 'test-campaign';
const characters = [{ name: 'Rakan' }, { name: 'Mira' }];
const CONFIGURED = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', mode: 'suggest' };
const DICE = { type: 'dice', expression: '1d20+5', explanation: 'swing', confidence: 0.8 };

function stubFetch({ referee = { ok: true, ruling: DICE }, aiConfig = { ok: true } } = {}) {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (String(url).includes('/ai/status')) return { ok: true, json: async () => ({ configured: !!synced.aiConfig, mode: synced.aiConfig?.mode || 'off', model: synced.aiConfig?.model || null, reachable: { reachable: true, models: ['x'] } }) };
        if (String(url).includes('/ai/referee')) return { ok: true, json: async () => referee };
        if (String(url).endsWith('/aiConfig')) return { ok: aiConfig.ok, status: aiConfig.ok ? 200 : 400, json: async () => (aiConfig.ok ? { message: 'ok' } : { reason: aiConfig.reason }) };
        return { ok: true, json: async () => ({}) };
    }));
}

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
    vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe('AiRefereeSection', () => {
    it('aiConfig unset ⇒ NO console, no ask button (L1–4 parity)', async () => {
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/not configured/)).toBeInTheDocument());
        expect(document.querySelector('.ai-action-input')).toBeNull();
        expect(screen.queryByText(/Ask AI referee/)).toBeNull();
    });

    it('suggest mode ⇒ proposal appears and NOTHING applies until Confirm', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(document.querySelector('.ai-action-input'), { target: { value: 'I swing my sword at the goblin' } });
        fireEvent.click(screen.getByText(/Ask AI referee/));
        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument());
        // still only the proposal — no roll log yet beyond nothing applied
        const appliedLogs = addEntry.mock.calls.filter(c => String(c[1]?.description || '').includes('applied: dice'));
        expect(appliedLogs.length).toBe(0);

        fireEvent.click(screen.getByText(/Confirm & Apply/));
        await waitFor(() => expect(screen.getByText(/Applied:.*→ 9/)).toBeInTheDocument());
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_ruling_applied', description: expect.stringContaining('applied: dice') }));
        expect(screen.queryByText(/AI proposes: dice/)).toBeNull();
    });

    it('dismiss discards the proposal without applying', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(document.querySelector('.ai-action-input'), { target: { value: 'do a thing' } });
        fireEvent.click(screen.getByText(/Ask AI referee/));
        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument());
        fireEvent.click(screen.getByText('Dismiss'));
        await waitFor(() => expect(screen.queryByText(/AI proposes: dice/)).toBeNull());
        expect(screen.queryByText(/Applied:/)).toBeNull();
    });

    it('autopilot auto-applies atomic dice at once; automation still waits', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(document.querySelector('.ai-action-input'), { target: { value: 'I cast magic missile' } });
        fireEvent.click(screen.getByText(/Ask AI referee/));
        await waitFor(() => expect(screen.getByText(/Applied:.*→ 9/)).toBeInTheDocument());

        stubFetch({ referee: { ok: true, ruling: { type: 'automation', actionName: 'Breath Weapon', explanation: 'fire' } } });
        fireEvent.change(document.querySelector('.ai-action-input'), { target: { value: 'the dragon breathes' } });
        fireEvent.click(screen.getByText(/Ask AI referee/));
        await waitFor(() => expect(screen.getByText(/AI proposes: automation/)).toBeInTheDocument());
        expect(screen.queryByText(/Applied: automation/)).toBeNull(); // automation NOT auto-run
    });

    it('needs_human proposal is surfaced for the referee, never applied', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubFetch({ referee: { ok: false, code: 'AI_NEEDS_HUMAN', ruling: { type: 'needs_human', text: 'AI referee unavailable — the referee adjudicates.' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(document.querySelector('.ai-action-input'), { target: { value: 'hmm?' } });
        fireEvent.click(screen.getByText(/Ask AI referee/));
        await waitFor(() => expect(screen.getByText(/AI proposes: needs_human/)).toBeInTheDocument());
        expect(screen.queryByText(/Applied:/)).toBeNull();
    });

    it('server-refused config shows the honest reason', async () => {
        stubFetch({ aiConfig: { ok: false, reason: 'aiConfig.endpoint must be a LOCAL http(s) URL (D3)' } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        const selects = document.querySelectorAll('.ai-config-row select');
        fireEvent.change(selects[0], { target: { value: 'suggest' } });
        fireEvent.click(screen.getByText(/Save AI config/));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('LOCAL http(s)'));
    });
});
