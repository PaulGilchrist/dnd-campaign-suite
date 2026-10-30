// @maintained-by-ai
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

/**
 * Stub transport for the section's endpoints; returns the fetch mock for
 * payload assertions. The `save` object is read at call time, so tests may
 * flip `save.ok` mid-test to simulate a refused re-save.
 */
function stubFetch({ referee = { ok: true, ruling: DICE }, refereeStatus = 200, save = { ok: true }, remove = { ok: true } } = {}) {
    const fetchMock = vi.fn(async (url, opts) => {
        const u = String(url);
        if (u.includes('/ai/status')) {
            return res({ configured: !!synced.aiConfig, mode: synced.aiConfig?.mode || 'off', model: synced.aiConfig?.model || null, reachable: { reachable: true, models: ['x'] } });
        }
        if (u.endsWith('/ai/referee')) return res(referee, refereeStatus === 200, refereeStatus);
        if (u.endsWith('/aiConfig')) {
            if (opts?.method === 'DELETE') return res({}, remove.ok, remove.status ?? (remove.ok ? 200 : 403));
            return res(save.ok ? { message: 'ok' } : { reason: save.reason }, save.ok, save.ok ? 200 : 400);
        }
        return res({});
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const askButton = () => screen.getByRole('button', { name: /Ask AI referee|AI thinking/ });
const confirmButton = () => screen.getByRole('button', { name: /Confirm & Apply/ });
const saveButton = () => screen.getByRole('button', { name: /Save AI config/ });

/** Type an action and hit Ask. */
function askAbout(text) {
    fireEvent.change(screen.getByPlaceholderText(/Describe what a player does/), { target: { value: text } });
    fireEvent.click(askButton());
}

/** POSTs to the referee endpoint as { url, body } for scope/payload assertions. */
function refereePosts(fetchMock) {
    return fetchMock.mock.calls
        .filter(([url, opts]) => String(url).endsWith('/ai/referee') && opts?.method === 'POST')
        .map(([url, opts]) => ({ url, body: JSON.parse(opts.body) }));
}

const auditEntries = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ai_ruling_applied');

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null); // clearAllMocks keeps implementations — reset explicitly
});
afterEach(() => vi.unstubAllGlobals());

describe('AiRefereeSection — gating (L1–4 parity)', () => {
    it('aiConfig unset OR mode off ⇒ honest badge, no console, zero referee traffic', async () => {
        const fetchMock = stubFetch();
        // unset: badge says not configured, nothing to ask with
        const first = render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/not configured/)).toBeInTheDocument());
        expect(screen.queryByPlaceholderText(/Describe what a player does/)).toBeNull();
        expect(screen.queryByRole('button', { name: /Ask AI referee/ })).toBeNull();
        first.unmount();

        // configured but off: badge is honest about the mode, console stays hidden
        synced.aiConfig = { ...CONFIGURED, mode: 'off' };
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

    it('saving posts to this campaign — success stays quiet, refusal shows the server’s reason', async () => {
        const save = { ok: true };
        const fetchMock = stubFetch({ save });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'suggest' } });
        fireEvent.click(saveButton());

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const posts = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/aiConfig'));
        expect(posts).toHaveLength(1);
        expect(posts[0][0]).toContain(`/campaigns/${CN}/`);
        expect(JSON.parse(posts[0][1].body).value).toMatchObject({ mode: 'suggest', provider: 'openai' });
        expect(screen.queryByRole('alert')).toBeNull();

        // server refuses the next save: the honest reason surfaces, no silent fallback
        save.ok = false;
        save.reason = 'aiConfig.endpoint must be a LOCAL http(s) URL (D3)';
        fireEvent.click(saveButton());
        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('LOCAL http(s)'));
    });
});

// ai-config-null-key-retained — Turn AI off must fully wipe the key
// (delete-after-ack, mirroring the death-save result lane).
describe('AiRefereeSection — Turn AI off wipes the key (delete-after-ack)', () => {
    const offButton = () => screen.getByRole('button', { name: /Turn AI off/ });
    const aiConfigCalls = (fetchMock) => fetchMock.mock.calls
        .filter(([u]) => String(u).endsWith('/aiConfig'))
        .map(([u, opts]) => ({ url: String(u), method: opts?.method, body: opts?.body ? JSON.parse(opts.body) : undefined }));

    /** Set the mode select to off — the button flips to "Turn AI off". */
    function armOff() {
        fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'off' } });
    }

    it('POSTs null, and only after the ack DELETEs the key — in that order, quiet success face', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/· suggest/)).toBeInTheDocument()); // settle status fetch
        armOff();
        fireEvent.click(offButton());

        await waitFor(() => expect(aiConfigCalls(fetchMock)).toHaveLength(2));
        const calls = aiConfigCalls(fetchMock);
        expect(calls[0].method).toBe('POST');
        expect(calls[0].url).toContain(`/campaigns/${CN}/aiConfig`);
        expect(calls[0].body).toEqual({ value: null });
        expect(calls[1].method).toBe('DELETE');
        expect(calls[1].url).toContain(`/campaigns/${CN}/aiConfig`);
        expect(calls[1].body).toBeUndefined();
        expect(screen.queryByRole('alert')).toBeNull(); // off succeeded — no notice
    });

    it('refused POST (e.g. server lock) never fires the DELETE and shows the reason', async () => {
        synced.aiConfig = CONFIGURED;
        const save = { ok: false, reason: 'campaign is locked' };
        const fetchMock = stubFetch({ save });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        armOff();
        fireEvent.click(offButton());

        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Server refused: campaign is locked'));
        const calls = aiConfigCalls(fetchMock);
        expect(calls).toHaveLength(1); // POST only — nothing written, nothing to wipe
        expect(calls[0].method).toBe('POST');
    });

    it('failed DELETE surfaces through the same honest notice lane without eating the POST echo', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchMock = stubFetch({ remove: { ok: false } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        armOff();
        fireEvent.click(offButton());

        await waitFor(() => expect(aiConfigCalls(fetchMock)).toHaveLength(2));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Server refused:'));
        expect(aiConfigCalls(fetchMock)[0].method).toBe('POST');
        expect(aiConfigCalls(fetchMock)[1].method).toBe('DELETE');
    });

    it('404 DELETE (key already gone — wildcard honesty 2026-10-30) is the desired end state, never a false notice', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchMock = stubFetch({ remove: { ok: false, status: 404 } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        await waitFor(() => expect(screen.getByText(/· suggest/)).toBeInTheDocument()); // settle status fetch
        armOff();
        fireEvent.click(offButton());

        await waitFor(() => expect(aiConfigCalls(fetchMock)).toHaveLength(2));
        expect(aiConfigCalls(fetchMock)[1].method).toBe('DELETE');
        expect(screen.queryByRole('alert')).toBeNull(); // key gone = success, stay quiet
    });
});

describe('AiRefereeSection — suggest mode: AI proposes, human disposes', () => {
    it('proposal appears and NOTHING rolls or logs until Confirm; the ask carries the typed action and selected character', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchMock = stubFetch();
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I swing my sword at the goblin');

        await waitFor(() => expect(screen.getByText(/AI proposes: dice/)).toBeInTheDocument());
        expect(refereePosts(fetchMock)).toEqual([{
            url: expect.stringContaining(`/campaigns/${CN}/ai/referee`),
            body: { action: 'I swing my sword at the goblin', characterName: 'Rakan' },
        }]);
        expect(screen.queryByLabelText('Override HP amount')).toBeNull(); // engine dice stay engine dice
        // the gate: engine untouched, no audit, nothing marked applied
        expect(rollExpression).not.toHaveBeenCalled();
        expect(auditEntries()).toHaveLength(0);
        expect(screen.queryByText(/Applied:/)).toBeNull();

        fireEvent.click(confirmButton());
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
        expect(screen.queryByRole('button', { name: /Confirm & Apply/ })).toBeNull(); // auto, no click awaited
        expect(rollExpression).toHaveBeenCalledWith('1d20+5');
        expect(auditEntries()).toHaveLength(1);
    });

    it('automation rulings auto-apply NEVER — the card waits for the referee', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubFetch({ referee: { ok: true, ruling: { type: 'automation', actionName: 'Breath Weapon', explanation: 'fire' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('the dragon breathes');
        await waitFor(() => expect(screen.getByText(/AI proposes: automation/)).toBeInTheDocument());
        expect(confirmButton()).toBeInTheDocument(); // referee may still approve
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

// target_effect pre-filter — a model-invented key must surface a registry
// picker BEFORE confirming (bad key = post-confirm dead end otherwise).
describe('AiRefereeSection — target_effect key pre-filter', () => {
    const BAD = { type: 'target_effect', effect: 'poisoned', targetName: 'Rakan', explanation: 'venomous bite', confidence: 0.7 };

    it('unknown effect key surfaces a picker; Confirm is disabled until a valid key is chosen, then the repaired key applies', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch({ referee: { ok: true, ruling: BAD } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I bite the guard with my venomous fangs');

        await waitFor(() => expect(screen.getByText(/AI proposes: target_effect/)).toBeInTheDocument());
        expect(screen.getByRole('alert').textContent).toContain('not in the effect registry');
        const picker = screen.getByLabelText('Choose a valid effect key');
        // the dead-end lane is gated: nothing applies while the key is un-repaired
        expect(confirmButton()).toBeDisabled();
        fireEvent.click(confirmButton());
        expect(setRuntimeValue).not.toHaveBeenCalled();

        fireEvent.change(picker, { target: { value: 'speed_half' } }); // real registry key
        expect(confirmButton()).toBeEnabled();
        fireEvent.click(confirmButton());
        await waitFor(() => expect(screen.getByText(/Applied: speed_half applied to Rakan/)).toBeInTheDocument());
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
            [expect.objectContaining({ target: 'Rakan', effect: 'speed_half', source: 'AI referee' })], CN);
        // the human repair is recorded in the audit, same doctrine as the HP override
        expect(auditEntries().at(-1).ruling).toMatchObject({ type: 'target_effect', effect: 'speed_half', overridden: true });
    });

    it('a valid registry key renders no picker and confirms cleanly (lane unchanged)', async () => {
        synced.aiConfig = CONFIGURED;
        stubFetch({ referee: { ok: true, ruling: { ...BAD, effect: 'speed_half' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);
        askAbout('I hobble the guard');

        await waitFor(() => expect(screen.getByText(/AI proposes: target_effect/)).toBeInTheDocument());
        expect(screen.queryByLabelText('Choose a valid effect key')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(confirmButton()).toBeEnabled();
        fireEvent.click(confirmButton());
        await waitFor(() => expect(screen.getByText(/Applied: speed_half applied to Rakan/)).toBeInTheDocument());
        expect(auditEntries().at(-1).ruling.overridden).toBeUndefined(); // accepted as proposed
    });
});

// §10.4 — referee override on a proposal before it touches the sheet.
describe('AiRefereeSection — proposal override (§10.4)', () => {
    it('hp_change untouched applies the AI’s amount unflagged; an edited override applies the human’s amount and records it', async () => {
        getRuntimeValue.mockImplementation((who, key) => (who === 'Rakan' && key === 'currentHitPoints' ? 20 : null));
        synced.aiConfig = CONFIGURED;
        stubFetch({ referee: { ok: true, ruling: { type: 'hp_change', targetName: 'Rakan', expression: '2d6', amount: -7, explanation: 'claws rake Rakan' } } });
        render(<AiRefereeSection campaignName={CN} characters={characters} />);

        // cycle 1 — accepted as proposed: original amount, no override flag
        askAbout('the claw hits');
        const override = () => screen.getByLabelText('Override HP amount');
        await waitFor(() => expect(override()).toHaveValue(-7)); // prefilled with the AI's proposal
        fireEvent.click(confirmButton());
        await waitFor(() => expect(screen.getByText(/Applied: Rakan: 20 → 13 HP/)).toBeInTheDocument());
        expect(auditEntries().at(-1).ruling).toMatchObject({ type: 'hp_change', amount: -7 });
        expect(auditEntries().at(-1).ruling.overridden).toBeUndefined();

        // cycle 2 — referee edits: the edited amount is what lands, and the audit records it
        askAbout('the claw hits again');
        await waitFor(() => expect(override()).toHaveValue(-7));
        fireEvent.change(override(), { target: { value: '-3' } });
        fireEvent.click(confirmButton());
        await waitFor(() => expect(screen.getByText(/Applied: Rakan: 20 → 17 HP/)).toBeInTheDocument());
        expect(setRuntimeValue).toHaveBeenCalledWith('Rakan', 'currentHitPoints', 17, CN);
        expect(auditEntries().at(-1).ruling).toMatchObject({ type: 'hp_change', amount: -3, overridden: true });
    });
});
