// P4-a (§10.1/§10.4): session console — pills reflect phase, clicks move it
// with audit, ledger filters enforcement/AI rows, empty state stays honest.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const synced = {};
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: (key, prop, defaultValue) => {
        if (!(prop in synced)) synced[prop] = defaultValue;
        return [synced[prop], (v) => { synced[prop] = v; }];
    },
}));
const setCalls = [];
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async (who, key, value) => { setCalls.push({ who, key, value }); }),
}));
const logs = [];
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async (c, e) => { logs.push(e); }) }));

import SessionSection from './SessionSection.jsx';

const CN = 'test-campaign';

beforeEach(() => {
    Object.keys(synced).forEach(k => delete synced[k]);
    setCalls.length = 0;
    logs.length = 0;
});

it('active pill follows the synced phase; unset ⇒ exploration lit', () => {
    const { getByText } = render(<SessionSection campaignName={CN} />);
    expect(getByText('Exploration').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(getByText('Encounter').closest('button')).toHaveAttribute('aria-pressed', 'false');
});

it('pill click moves the phase through the store + writes a session_phase audit', async () => {
    const { getByText } = render(<SessionSection campaignName={CN} />);
    fireEvent.click(getByText('Encounter'));
    await waitFor(() => expect(setCalls).toHaveLength(1));
    expect(setCalls[0]).toMatchObject({ who: 'campaign', key: 'sessionState' });
    expect(setCalls[0].value).toMatchObject({ phase: 'encounter', changedBy: 'referee console' });
    expect(logs[0]).toMatchObject({ type: 'session_phase', phase: 'encounter', previousPhase: 'exploration' });
});

it('same-phase click writes nothing (no spam)', async () => {
    const { getByText } = render(<SessionSection campaignName={CN} />);
    fireEvent.click(getByText('Exploration'));
    await waitFor(() => expect(setCalls).toHaveLength(0));
    expect(logs).toHaveLength(0);
});

it('audit ledger lists enforcement + AI rows and ignores ordinary play logs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ([
            { type: 'roll', description: 'normal attack roll' },
            { type: 'enforcement_denied', description: 'FeyRanger is behind a wall' },
            { type: 'session_phase', description: 'Session phase: exploration → encounter' },
            { type: 'automation', automationType: 'ai_ruling_proposed', description: 'AI proposed dice' },
        ]),
    })));
    const { findByText, queryByText } = render(<SessionSection campaignName={CN} />);
    expect(await findByText(/behind a wall/)).toBeTruthy();
    expect(await findByText(/exploration → encounter/)).toBeTruthy();
    expect(await findByText(/AI proposed dice/)).toBeTruthy();
    expect(queryByText(/normal attack roll/)).toBeNull();
    vi.unstubAllGlobals();
});

it('empty audit shows the honest empty copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    const { findByText } = render(<SessionSection campaignName={CN} />);
    expect(await findByText(/Nothing to show/)).toBeTruthy();
    vi.unstubAllGlobals();
});

// §10.4 — the safety valve: one click hands the table back to manual.
it('Take over manually: enforcement+AI off (merged), manual_takeover audited', async () => {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
        const u = String(url);
        if (opts.method === 'POST' && u.endsWith('/enforcement')) { calls.push({ key: 'enforcement', body: JSON.parse(opts.body).value }); return { ok: true, json: async () => ({}) }; }
        if (opts.method === 'POST' && u.endsWith('/aiConfig')) { calls.push({ key: 'aiConfig', body: JSON.parse(opts.body).value }); return { ok: true, json: async () => ({}) }; }
        if (opts.method === 'POST' && u.endsWith('/log')) { calls.push({ key: 'log', body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({}) }; }
        if (u.includes('/enforcement')) return { ok: true, json: async () => ({ enforcement: { mode: 'on', turnLock: true } }) };
        if (u.includes('/aiConfig')) return { ok: true, json: async () => ({ aiConfig: { endpoint: 'http://x/v1', model: 'm', mode: 'suggest' } }) };
        return { ok: true, json: async () => [] };
    }));
    const { findByText } = render(<SessionSection campaignName={CN} />);
    fireEvent.click(await findByText(/Take over manually/));
    await waitFor(() => expect(calls.some(c => c.key === 'enforcement')).toBe(true));
    expect(calls.find(c => c.key === 'enforcement').body).toMatchObject({ mode: 'off', turnLock: true }); // flags preserved, master off
    expect(calls.find(c => c.key === 'aiConfig').body).toMatchObject({ mode: 'off', model: 'm' });          // config kept, AI off
    expect(calls.find(c => c.key === 'log').body).toMatchObject({ automationType: 'manual_takeover' });
    vi.unstubAllGlobals();
});
