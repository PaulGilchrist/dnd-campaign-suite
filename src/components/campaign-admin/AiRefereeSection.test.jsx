// @improved-by-ai
// L5-005 §9.2 — AI referee console (component lane only): visibility gating,
// suggest confirm gate, autopilot auto-apply scope, §10.4 proposal override,
// config save/refuse notices, and campaign-scoped requests.
// Lane internals (server dice oracle, effect registry, HP floor) are covered
// by applyRuling.test.js; world keeper cards by AiWorldConsole.test.jsx —
// not re-tested here.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs: the synced-store hook and runtime store stand in for the
// server/SSE plumbing; dice and log are frozen so assertions are deterministic.
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
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 9, rolls: [4, 5] })),
    rollAdvantage: vi.fn(() => ({ total: 17, rolls: [8, 17] })),
    rollDisadvantage: vi.fn(() => ({ total: 3, rolls: [3, 12] })),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import AiRefereeSection from './AiRefereeSection.jsx';

const CN = 'test-campaign';
const characters = [{ name: 'Rakan' }, { name: 'Mira' }];
const CONFIGURED = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', mode: 'suggest' };
const DICE = { type: 'dice', expression: '1d20+5', explanation: 'swing', confidence: 0.8 };

const res = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, json: async () => body });

/** Stub transport for the section's endpoints; returns the fetch mock for payload assertions. */
function stubFetch({ referee = { ok: true, ruling: DICE }, refereeStatus = 200, save = { ok: true } } = {}) {
    const fetchMock = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/ai/status')) {
            return res({ configured: !!synced.aiConfig, mode: synced.aiConfig?.mode || 'off', model: synced.aiConfig?.model || null, reachable: { reachable: true, models: ['x'] } });
        }
        if (u.endsWith('/ai/referee')) return res(referee, refereeStatus === 200, refereeStatus);
        if (u.endsWith('/aiConfig')) return res(save.ok ? { message: 'ok' } : { reason: save.reason }, save.ok, save.ok ? 200 : 400);
        return res({});
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const askButton = () => screen.getByRole('button', { name: /Ask AI referee|AI thinking/ });

/** Type an action and hit Ask; returns the fetch mock's POST body to /ai/referee. */
function askAbout(text) {
    fireEvent.change(screen.getByPlaceholderText(/Describe what a player does/), { target: { value: text } });
    fireEvent.click(askButton());
}

function refereePosts(fetchMock) {
    return fetchMock.mock.calls
        .filter(([url, opts]) => String(url).endsWith('/ai/referee') && opts?.method === 'POST')
        .map(([, opts]) => JSON.parse(opts.body));
}

const auditEntries = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ai_ruling_applied');

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null); // clearAllMocks keeps implementations — reset explicitly
});
afterEach(() => vi.unstubAllGlobals());

describe('AiRefereeSection — gating (L1–4 parity)', () => {
    it('aiConfig unset ⇒ honest badge, no console, no referee traffic', async () => {
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/not configured/)).toBeInTheDocument());
        expect(screen.queryByPlaceholderText(/Describe what a player does/)).toBeNull();
        expect(screen.queryByRole('button', { name: /Ask AI referee/ })).toBeNull();
        expect(refereePosts(fetchMock)).toHaveLength(0);
    });

    it('aiConfig present but mode off ⇒ console stays hidden', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'off' };
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/· off/)).toBeInTheDocument()); // let the status fetch settle
        expect(screen.queryByPlaceholderText(/Describe what a player does/)).toBeNull();
        expect(refereePosts(fetchMock)).toHaveLength(0);
    });

    it('Ask waits for a real description — blank and whitespace never fire', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/· suggest/)).toBeInTheDocument()); // settle status fetch
        const box = screen.getByPlaceholderText(/Describe what a player does/);
        expect(askButton()).toBeDisabled();
        fireEvent.change(box, { target: { value: '   ' } });
        expect(askButton()).toBeDisabled();
        fireEvent.change(box, { target: { value: 'I light a lantern' } });
        expect(askButton()).toBeEnabled();
        expect(refereePosts(fetchMock)).toHaveLength(0); // nothing sent until clicked
    });

    it('server-refused config shows the honest reason and posts to this campaign', async () => {
        const fetchMock = stubFetch({ save: { ok: false, reason: 'aiConfig.endpoint must be a LOCAL http(s) URL (D3)' } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'suggest' } });
        fireEvent.click(screen.getByRole('button', { name: /Save AI config/ }));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('LOCAL http(s)'));
        const [url, opts] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/aiConfig'));
        expect(url).toContain(`/campaigns/${CN}/`);
        expect(JSON.parse(opts.body).value).toMatchObject({ mode: 'suggest' });
    });

    it('saving config posts the chosen values and leaves no error showing', async () => {
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'suggest' } });
        fireEvent.click(screen.getByRole('button', { name: /Save AI config/ }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const [url, opts] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/aiConfig'));
        expect(url).toContain(`/campaigns/${CN}/`);
        expect(JSON.parse(opts.body).value).toMatchObject({ mode: 'suggest', provider: 'openai' });
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('AiRefereeSection — suggest mode: AI proposes, human disposes', () => {
    it('proposal appears and NOTHING rolls or logs until Confirm; the ask carries the typed action and selected character', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I swing my sword at the goblin');

        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument());
        expect(refereePosts(fetchMock)).toEqual([{ action: 'I swing my sword at the goblin', characterName: 'Rakan' }]);
        // the gate: engine untouched, no audit, nothing marked applied
        expect(rollExpression).not.toHaveBeenCalled();
        expect(auditEntries()).toHaveLength(0);
        expect(screen.queryByText(/Applied:/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Confirm & Apply/ }));
        await waitFor(() => expect(screen.getByText(/Applied:.*→ 9/)).toBeInTheDocument());
        expect(rollExpression).toHaveBeenCalledWith('1d20+5');
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'roll', total: 9 }));
        expect(auditEntries().at(-1)).toMatchObject({ type: 'ai_ruling_applied', description: expect.stringContaining('applied: dice') });
        expect(screen.queryByText(/AI proposes: dice/)).toBeNull();
    });

    it('dismiss discards the proposal without applying', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('do a thing');
        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByText(/AI proposes: dice/)).toBeNull());
        expect(screen.queryByText(/Applied:/)).toBeNull();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(auditEntries()).toHaveLength(0);
    });

    it('referee transport failure says so honestly — no proposal, no apply', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch({ referee: { error: 'AI backend exploded' }, refereeStatus: 500 });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I cast detect magic');
        await waitFor(() => expect(screen.getByText(/Not applied:.*AI backend exploded/)).toBeInTheDocument());
        expect(screen.queryByText(/AI proposes:/)).toBeNull();
        expect(rollExpression).not.toHaveBeenCalled();
    });
});

describe('AiRefereeSection — autopilot scope', () => {
    it('atomic dice rulings auto-apply at once, through the engine (never the AI)', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I cast magic missile');
        await waitFor(() => expect(screen.getByText(/Applied:.*→ 9/)).toBeInTheDocument());
        expect(rollExpression).toHaveBeenCalledWith('1d20+5');
        expect(auditEntries()).toHaveLength(1);
    });

    it('automation rulings auto-apply NEVER — the card waits for the referee', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubFetch({ referee: { ok: true, ruling: { type: 'automation', actionName: 'Breath Weapon', explanation: 'fire' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('the dragon breathes');
        await waitFor(() => expect(screen.getByText(/AI proposes: automation/)).toBeInTheDocument());
        expect(screen.getByRole('button', { name: /Confirm & Apply/ })).toBeInTheDocument(); // referee may still approve
        expect(screen.queryByText(/Applied:/)).toBeNull();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(auditEntries()).toHaveLength(0);
    });

    it('needs_human is surfaced verbatim for the referee, never applied — even in autopilot', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubFetch({ referee: { ok: false, code: 'AI_NEEDS_HUMAN', ruling: { type: 'needs_human', text: 'AI referee unavailable — the referee adjudicates.' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('hmm?');
        await waitFor(() => expect(screen.getByText(/AI proposes: needs_human/)).toBeInTheDocument());
        expect(screen.getByText(/the referee adjudicates/)).toBeInTheDocument();
        expect(screen.queryByText(/Applied:/)).toBeNull();
        expect(auditEntries()).toHaveLength(0);
    });
});

// §10.4 — referee override on a proposal before it touches the sheet.
describe('AiRefereeSection — proposal override (§10.4)', () => {
    function withRuntimeHp(who, hp) {
        getRuntimeValue.mockImplementation((w, key) => (w === who && key === 'currentHitPoints' ? hp : null));
    }

    it('hp_change: the edited amount is what applies, and the audit records the override', async () => {
        withRuntimeHp('Rakan', 20);
        synced.aiConfig = CONFIGURED;
        stubFetch({ referee: { ok: true, ruling: { type: 'hp_change', targetName: 'Rakan', amount: -7, explanation: 'claws rake Rakan' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('the claw hits');
        await waitFor(() => expect(screen.getByText(/AI proposes: hp_change/)).toBeInTheDocument());

        const override = screen.getByLabelText('Override HP amount');
        expect(override).toHaveValue(-7); // prefilled with the AI's proposal
        fireEvent.change(override, { target: { value: '-3' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm & Apply/ }));

        await waitFor(() => expect(screen.getByText(/Applied: Rakan: 20 → 17 HP/)).toBeInTheDocument());
        expect(setRuntimeValue).toHaveBeenCalledWith('Rakan', 'currentHitPoints', 17, CN);
        expect(auditEntries().at(-1).ruling).toMatchObject({ type: 'hp_change', amount: -3, overridden: true });
    });

    it('hp_change left untouched applies the original amount with no override flag', async () => {
        withRuntimeHp('Rakan', 20);
        synced.aiConfig = CONFIGURED;
        stubFetch({ referee: { ok: true, ruling: { type: 'hp_change', targetName: 'Rakan', amount: -7 } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('the claw hits');
        await waitFor(() => expect(screen.getByLabelText('Override HP amount')).toHaveValue(-7));
        fireEvent.click(screen.getByRole('button', { name: /Confirm & Apply/ }));
        await waitFor(() => expect(screen.getByText(/Applied: Rakan: 20 → 13 HP/)).toBeInTheDocument());
        expect(auditEntries().at(-1).ruling).toMatchObject({ type: 'hp_change', amount: -7 });
        expect(auditEntries().at(-1).ruling.overridden).toBeUndefined();
    });

    it('dice proposals show NO override box — engine dice stay engine dice', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I swing');
        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument());
        expect(screen.queryByLabelText('Override HP amount')).toBeNull();
    });
});
