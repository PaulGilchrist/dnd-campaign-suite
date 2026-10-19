// @maintained-by-ai
// §9.3 — AI director panel: hidden unless live+localhost+living-NPC turn; exact
// director request bytes; suggest confirm gate; autopilot auto-stamps safe intents
// at the turn seam (deduped per creature+round, no timers); advisory/needs_human
// never stamp. Apply-lane bytes are owned by applyDirectorIntent.test.js.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const synced = {};
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
    useSyncedState: (key, prop, defaultValue) => {
        if (!(prop in synced)) synced[prop] = defaultValue;
        return [synced[prop], (v) => { synced[prop] = v; }];
    },
}));
// consumed transitively by the REAL applyDirectorIntent audit (kept unmocked)
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));

import AiDirectorPanel from './AiDirectorPanel.jsx';

const CN = 'test-campaign';
const NPC = { name: 'Goblin 1', type: 'npc', currentHp: 7 };
const DEAD_NPC = { name: 'Goblin 1', type: 'npc', currentHp: 0 };
const PLAYER = { name: 'Rakan', type: 'player', currentHp: 20 };
const OTHER_NPC = { name: 'Orc 2', type: 'npc', currentHp: 12 };
const CONFIGURED = { endpoint: 'http://localhost:11434', model: 'stub-llm', mode: 'suggest' };
const AUTO = { ...CONFIGURED, mode: 'autopilot' };
const ATTACK = { ok: true, mode: 'suggest', intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan', explanation: 'melee', confidence: 0.9 } };

function stubFetch(response) {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => response }));
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

const askButton = (name) => screen.getByText(new RegExp(`AI director: decide ${name}'s turn`));

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
    vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe('AiDirectorPanel', () => {
    it('hidden unless localhost + live config + living NPC turn (zero DOM, zero traffic)', () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);

        // unset config, off-localhost, player turn, dead NPC — each renders nothing
        const hidden = [
            ['unset config', undefined, true, NPC],
            ['not localhost', CONFIGURED, false, NPC],
            ['player active', CONFIGURED, true, PLAYER],
            ['dead NPC', CONFIGURED, true, DEAD_NPC],
        ];
        for (const [label, cfg, local, creature] of hidden) {
            if (cfg) synced.aiConfig = cfg;
            const { container, unmount } = render(
                <AiDirectorPanel campaignName={CN} activeCreature={creature} isLocalhost={local} onStampTarget={vi.fn()} />);
            expect(container.innerHTML, label).toBe('');
            unmount();
        }
        expect(fetchFn).not.toHaveBeenCalled();

        // positive control: the gate opens on a live NPC turn, and suggest mode never auto-asks
        synced.aiConfig = CONFIGURED;
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={vi.fn()} />);
        expect(askButton('Goblin 1')).toBeInTheDocument();
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('suggest: exact request bytes, card shows proposal bytes, nothing stamps until Confirm stamps once', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchFn = stubFetch(ATTACK);
        const stamp = vi.fn();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} />);

        fireEvent.click(askButton('Goblin 1'));
        expect(fetchFn).toHaveBeenCalledWith('/api/campaigns/test-campaign/ai/director', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ creatureName: 'Goblin 1' }),
        }));
        await waitFor(() => expect(screen.getByText(/Scimitar → Rakan/)).toBeInTheDocument());
        expect(screen.getByText('attack')).toBeInTheDocument();
        expect(screen.getByText('melee')).toBeInTheDocument();
        expect(stamp).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => expect(stamp).toHaveBeenCalledWith('Goblin 1', 'Rakan'));
        expect(stamp).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Confirmed: Scimitar → Rakan: target set. Run it on Goblin 1's card — the engine rolls, not the AI.")).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
        expect(askButton('Goblin 1')).toBeInTheDocument();
    });

    it('suggest: dismiss discards without stamping; manual re-ask re-fires; AI failure is honest, never faked', async () => {
        synced.aiConfig = CONFIGURED;
        const fetchFn = stubFetch(ATTACK);
        const stamp = vi.fn();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} />);

        fireEvent.click(askButton('Goblin 1'));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(screen.queryByText(/Scimitar → Rakan/)).toBeNull());
        expect(stamp).not.toHaveBeenCalled();

        // manual asks are never deduped — the referee clicking twice means it twice
        fireEvent.click(askButton('Goblin 1'));
        expect(fetchFn).toHaveBeenCalledTimes(2);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ ok: false, error: 'model timeout' }) })));
        fireEvent.click(askButton('Goblin 1'));
        await waitFor(() => expect(screen.getByText('model timeout')).toBeInTheDocument());
        expect(stamp).not.toHaveBeenCalled();
    });

    it('autopilot: asks once at the NPC turn seam and auto-stamps; remount dedupes; new round re-asks', async () => {
        synced.aiConfig = AUTO;
        const fetchFn = stubFetch(ATTACK);
        const stamp = vi.fn();
        const view = render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={7} />);
        await waitFor(() => expect(stamp).toHaveBeenCalledWith('Goblin 1', 'Rakan'));
        expect(fetchFn).toHaveBeenCalledTimes(1);

        // SSE re-mount mid-turn (same creature + round): dedup guard short-circuits
        // synchronously in the effect, so no timer grace is needed to prove absence
        view.unmount();
        const remounted = render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={7} />);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(stamp).toHaveBeenCalledTimes(1);

        // next round's same-creature turn re-asks naturally
        remounted.rerender(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={8} />);
        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(stamp).toHaveBeenCalledTimes(2));
    });

    it('autopilot stays in its lane: move is advisory-only, needs_human waits for the referee — neither stamps', async () => {
        synced.aiConfig = AUTO;
        const fetchFn = stubFetch({ ok: true, mode: 'autopilot', intent: { intent: 'move', creatureName: 'Orc 2', feet: 30, direction: 'toward Rakan' } });
        const stamp = vi.fn();
        const view = render(<AiDirectorPanel campaignName={CN} activeCreature={OTHER_NPC} isLocalhost onStampTarget={stamp} round={9} />);
        await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('Orc 2 intends to move 30 ft. (toward Rakan) — drag the token on the map (movement budget enforces the cap).')).toBeInTheDocument());
        expect(screen.getByText('Orc 2 intends to move 30 ft. (toward Rakan) — drag the token on the map (movement budget enforces the cap).')).toHaveClass('advisory');
        expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
        expect(stamp).not.toHaveBeenCalled();

        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: false, code: 'AI_NEEDS_HUMAN', intent: { intent: 'needs_human', creatureName: 'Orc 2', text: 'AI director: no living targets' } }) })));
        view.rerender(<AiDirectorPanel campaignName={CN} activeCreature={OTHER_NPC} isLocalhost onStampTarget={stamp} round={10} />);
        await waitFor(() => expect(screen.getByText('AI director: no living targets')).toBeInTheDocument());
        // the card waits indefinitely for a person — no auto-apply, no stamp
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
        expect(stamp).not.toHaveBeenCalled();
    });
});
