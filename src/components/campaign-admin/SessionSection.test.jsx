// @maintained-by-ai
// P4-a (§10.1/§10.4): session console — which pill is lit, clicks move the
// phase with an audit, the ledger filters/enforces/caps honestly, and the
// Take-over-manually safety valve switches enforcement + AI off.
//
// The runtime-store mocks share ONE backing object so the two halves of the
// component's contract (synced read path + runtime write path) stay coherent.
// Service-level semantics (same-phase silence, invalid-phase refusal) are
// covered by sessionService.test.js — the console delegates to setSessionPhase
// and adds no guard of its own, so those paths are not re-tested here.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const store = {}; // campaign runtime store as both hooks see `sessionState`
const setCalls = [];
const logs = [];

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (who, key) => store[key] ?? null,
    setRuntimeValue: vi.fn(async (who, key, value) => { setCalls.push({ who, key, value }); store[key] = value; }),
}));
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: (key, prop, defaultValue) => [
        store[prop] ?? defaultValue,
        (v) => { store[prop] = v; },
    ],
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async (c, e) => { logs.push(e); }) }));

import SessionSection from './SessionSection.jsx';

const CN = 'test-campaign';
const LOG_URL = '/api/campaigns/test-campaign/log';

/** Stub fetch: GETs of the log route return `rows`; everything else returns {}. */
function stubFetch(rows = []) {
    const fetchMock = vi.fn(async (url, opts = {}) => {
        const u = String(url);
        if (opts.method === 'POST') return { ok: true, json: async () => ({}) };
        if (u === LOG_URL) return { ok: true, json: async () => rows };
        return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    setCalls.length = 0;
    logs.length = 0;
    stubFetch(); // silent empty log for mount refreshes
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('session console', () => {
    it('lights one pill: exploration by default, synced sessionState wins when set', () => {
        const first = render(<SessionSection campaignName={CN} />);
        expect(first.getByRole('button', { name: 'Exploration' })).toHaveAttribute('aria-pressed', 'true');
        expect(first.getByRole('button', { name: 'Encounter' })).toHaveAttribute('aria-pressed', 'false');
        first.unmount();

        store.sessionState = { phase: 'travel', changedBy: 'initiative tracker' };
        const second = render(<SessionSection campaignName={CN} />);
        for (const p of ['Exploration', 'Encounter', 'Travel', 'Roleplay']) {
            expect(second.getByRole('button', { name: p })).toBeInTheDocument();
        }
        expect(second.getByRole('button', { name: 'Travel' })).toHaveAttribute('aria-pressed', 'true');
        expect(second.getByRole('button', { name: 'Exploration' })).toHaveAttribute('aria-pressed', 'false');
        expect(second.getByText(/Last moved by initiative tracker/i)).toBeInTheDocument();
    });

    it('pill click moves the phase through the store + writes a session_phase audit', async () => {
        const { getByRole } = render(<SessionSection campaignName={CN} />);
        fireEvent.click(getByRole('button', { name: 'Encounter' }));
        await waitFor(() => expect(setCalls).toHaveLength(1));
        expect(setCalls[0]).toMatchObject({ who: 'campaign', key: 'sessionState' });
        expect(setCalls[0].value).toMatchObject({ phase: 'encounter', changedBy: 'referee console' });
        expect(store.sessionState).toMatchObject({ phase: 'encounter' }); // the same store SSE echoes back
        expect(logs[0]).toMatchObject({ type: 'session_phase', phase: 'encounter', previousPhase: 'exploration' });
    });
});

describe('enforcement & AI audit ledger', () => {
    it('lists enforcement, phase and AI rows newest-first; ignores ordinary play logs', async () => {
        stubFetch([
            { type: 'roll', description: 'normal attack roll' },
            { type: 'enforcement_denied', description: 'FeyRanger is behind a wall' },
            { type: 'session_phase', description: 'Session phase: exploration → encounter' },
            { type: 'automation', automationType: 'ai_ruling_proposed', description: 'AI proposed dice' },
        ]);
        const { findAllByText, queryByText, findByText } = render(<SessionSection campaignName={CN} />);
        const rows = await findAllByText(/behind a wall|exploration → encounter|AI proposed dice/);
        expect(rows).toHaveLength(3);
        expect(queryByText(/normal attack roll/)).toBeNull();
        // newest entry renders first
        expect(rows.map(el => el.textContent)).toEqual([
            'AI proposed dice',
            'Session phase: exploration → encounter',
            'FeyRanger is behind a wall',
        ]);
        // audit types render human-readable (underscores → spaces)
        expect(await findByText('enforcement denied')).toBeInTheDocument();
        expect(await findByText('session phase')).toBeInTheDocument();
    });

    it('keeps the ledger readable: only the newest 25 audit rows', async () => {
        stubFetch(Array.from({ length: 30 }, (_, i) => ({
            type: 'enforcement_triggered',
            description: `entry-${i + 1}`,
        })));
        const { queryByText, findAllByText } = render(<SessionSection campaignName={CN} />);
        const items = await findAllByText(/entry-\d+/);
        expect(items).toHaveLength(25);
        expect(items[0]).toHaveTextContent('entry-30');   // newest kept, rendered first…
        expect(queryByText('entry-5')).toBeNull();        // …oldest five dropped
    });

    it('stays honestly empty on a failed fetch, then fills on Refresh', async () => {
        let fail = true;
        let rows = [];
        const fetchMock = vi.fn(async (url, opts = {}) => {
            if (opts.method === 'POST') return { ok: true, json: async () => ({}) };
            if (String(url) === LOG_URL) {
                return fail ? { ok: false, json: async () => [] } : { ok: true, json: async () => rows };
            }
            return { ok: true, json: async () => ({}) };
        });
        vi.stubGlobal('fetch', fetchMock);
        const { findByText, getByRole, queryByText } = render(<SessionSection campaignName={CN} />);
        // failed fetch must not crash or show stale data — just the honest empty copy
        expect(await findByText(/Nothing to show/)).toBeInTheDocument();

        fail = false;
        rows = [{ type: 'enforcement_denied', description: 'wall denied the move' }];
        fireEvent.click(getByRole('button', { name: /Refresh/i }));
        expect(await findByText(/wall denied the move/)).toBeInTheDocument();
        expect(queryByText(/Nothing to show/)).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith(LOG_URL);
    });
});

describe('Take over manually (§10.4 safety valve)', () => {
    it('one click switches enforcement + AI off, preserving sub-flags and config', async () => {
        const calls = [];
        vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
            const u = String(url);
            if (opts.method === 'POST') {
                const body = JSON.parse(opts.body);
                calls.push({ key: u.split('/').pop(), body: u.endsWith('/log') ? body : body.value });
                return { ok: true, json: async () => ({}) };
            }
            if (u.includes('/enforcement')) return { ok: true, json: async () => ({ enforcement: { mode: 'on', turnLock: true } }) };
            if (u.includes('/aiConfig')) return { ok: true, json: async () => ({ aiConfig: { endpoint: 'http://x/v1', model: 'm', mode: 'suggest' } }) };
            return { ok: true, json: async () => [] };
        }));
        const { findByText } = render(<SessionSection campaignName={CN} />);
        fireEvent.click(await findByText(/Take over manually/));
        await waitFor(() => expect(calls).toHaveLength(3));
        expect(calls.map(c => c.key)).toEqual(['enforcement', 'aiConfig', 'log']);
        expect(calls[0].body).toMatchObject({ mode: 'off', turnLock: true }); // flags preserved, master off
        expect(calls[1].body).toMatchObject({ mode: 'off', model: 'm' });      // config kept, AI off
        expect(calls[2].body).toMatchObject({ type: 'automation', automationType: 'manual_takeover' });
    });
});
