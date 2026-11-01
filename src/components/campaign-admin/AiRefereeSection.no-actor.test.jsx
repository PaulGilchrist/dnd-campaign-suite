// @maintained-by-ai
// Backlog 2026-11-01 — referee actor select "no actor" option: the combobox
// carries an explicit blank-first option, selecting it omits the actorStats
// key from the ask POST body entirely (the stats-less control lane moves from
// API-only to UI), and the default/selected-actor projection is untouched.
// Server-side gating (ACTOR STATS line only with actorStats) is locked by
// promptBuilder.test.js and campaigns-ai.test.js — not re-tested here.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs: same lane shape as AiRefereeSection.test.jsx — the synced
// store stands in for server/SSE plumbing.
const synced = {};
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: (key, prop, defaultValue) => {
        if (!(prop in synced)) synced[prop] = defaultValue;
        return [synced[prop], (v) => { synced[prop] = v; }];
    },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/ai/aiClient.js', async () => {
    const actual = await vi.importActual('../../services/ai/aiClient.js');
    return { ...actual, fetchAiModels: vi.fn(async () => ({ ok: false, error: 'no probe' })) };
});
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 9, rolls: [4, 5] })),
    rollAdvantage: vi.fn(() => ({ total: 17, rolls: [8, 17] })),
    rollDisadvantage: vi.fn(() => ({ total: 3, rolls: [3, 12] })),
}));

import AiRefereeSection from './AiRefereeSection.jsx';

const CN = 'test-campaign';
const CONFIGURED = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', mode: 'suggest' };
const DICE = { type: 'dice', expression: '1d20+5', explanation: 'swing', confidence: 0.8 };

const res = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, json: async () => body });

/** Stats-carrying roster row (raw character-file shape) so projection is non-null. */
const WIZARD = {
    name: 'DivinationWizard',
    level: 20,
    rules: '2024',
    class: { name: 'Wizard', subclass: { name: 'Evoker' } },
    abilities: [
        { name: 'Strength', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Dexterity', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Constitution', baseScore: 10, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Intelligence', baseScore: 16, featIncrease: 4, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Wisdom', baseScore: 10, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Charisma', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
    ],
    skillProficiencies: ['Arcana', 'History'],
    expertSkills: ['Arcana'],
};
const EXPECTED_STATS = {
    name: 'DivinationWizard',
    abilityMods: { str: -1, dex: -1, con: 0, int: 5, wis: 0, cha: -1 },
    proficiencyBonus: 6,
    skillProficiencies: ['Arcana', 'History'],
    expertSkills: ['Arcana'],
};

function stubFetch() {
    const fetchMock = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/ai/status')) {
            return res({ configured: !!synced.aiConfig, mode: synced.aiConfig?.mode || 'off', model: synced.aiConfig?.model || null, reachable: { reachable: true, models: ['x'] } });
        }
        if (u.endsWith('/ai/referee')) return res({ ok: true, ruling: DICE });
        return res({});
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const actorSelect = () => screen.getByRole('combobox', { name: 'Acting character' });
const refereePosts = (fetchMock) => fetchMock.mock.calls
    .filter(([url, opts]) => String(url).endsWith('/ai/referee') && opts?.method === 'POST')
    .map(([, opts]) => JSON.parse(opts.body));

function askAbout(text) {
    fireEvent.change(screen.getByPlaceholderText(/Describe what a player does/), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: /Ask AI referee|AI thinking/ }));
}

/** Wait for the nth ask to land, returning its parsed body. */
async function askBody(fetchMock, n) {
    await waitFor(() => expect(refereePosts(fetchMock)).toHaveLength(n));
    return refereePosts(fetchMock)[n - 1];
}

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
    vi.clearAllMocks();
    synced.aiConfig = CONFIGURED;
});
afterEach(() => vi.unstubAllGlobals());

describe('AiRefereeSection — no-actor option (backlog 2026-11-01)', () => {
    it('actor combobox carries an explicit "(No actor)" blank first option', async () => {
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={[WIZARD]} />);
        const select = actorSelect();
        const options = Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
        expect(options[0]).toEqual({ value: '', text: '(No actor)' });
        expect(options[1]).toEqual({ value: 'DivinationWizard', text: 'DivinationWizard' });
    });

    it('default unchanged: first roster PC pre-selected, actorStats still projected and sent', async () => {
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={[WIZARD]} />);
        expect(actorSelect()).toHaveValue('DivinationWizard');
        askAbout('I study the rune');
        const body = await askBody(fetchMock, 1);
        expect(body).toEqual({ action: 'I study the rune', characterName: 'DivinationWizard', actorStats: EXPECTED_STATS });
    });

    it('no-actor selected ⇒ the ask body OMITS the actorStats key entirely', async () => {
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={[WIZARD]} />);
        fireEvent.change(actorSelect(), { target: { value: '' } });
        askAbout('judge this roll bare');
        const body = await askBody(fetchMock, 1);
        expect('actorStats' in body).toBe(false); // key absent, not null
        expect(body).toEqual({ action: 'judge this roll bare', characterName: '' });
        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument()); // ruling still renders
    });

    it('toggling actor ⇄ no-actor in one session flips actorStats presence per ask', async () => {
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={[WIZARD]} />);
        askAbout('with actor');
        expect((await askBody(fetchMock, 1)).actorStats).toEqual(EXPECTED_STATS);

        fireEvent.change(actorSelect(), { target: { value: '' } });
        askAbout('no actor');
        expect('actorStats' in await askBody(fetchMock, 2)).toBe(false);

        fireEvent.change(actorSelect(), { target: { value: 'DivinationWizard' } });
        askAbout('actor again');
        expect((await askBody(fetchMock, 3)).actorStats).toEqual(EXPECTED_STATS);
    });
});
