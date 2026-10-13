// §9.3 — AI director panel: hidden unless live+localhost+NPC turn; suggest
// confirm gate; autopilot auto-stamps at the turn seam (no timers).
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
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));

import AiDirectorPanel from './AiDirectorPanel.jsx';

const CN = 'test-campaign';
const NPC = { name: 'Goblin 1', type: 'npc', currentHp: 7 };
const CONFIGURED = { endpoint: 'http://localhost:11434', model: 'stub-llm', mode: 'suggest' };
const ATTACK = { ok: true, mode: 'suggest', intent: { intent: 'attack', creatureName: 'Goblin 1', actionName: 'Scimitar', targetName: 'Rakan', explanation: 'melee', confidence: 0.9 } };

function stubDirector(response = ATTACK) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => response })));
}

beforeEach(() => {
    for (const k of Object.keys(synced)) delete synced[k];
    vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe('AiDirectorPanel', () => {
    it('AI off/unset ⇒ renders nothing (zero DOM, zero traffic)', () => {
        const fetchFn = vi.fn();
        vi.stubGlobal('fetch', fetchFn);
        const { container } = render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={vi.fn()} />);
        expect(container.innerHTML).toBe('');
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('not localhost ⇒ hidden even when configured (server doubles the gate)', () => {
        synced.aiConfig = CONFIGURED;
        const { container } = render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost={false} onStampTarget={vi.fn()} />);
        expect(container.innerHTML).toBe('');
    });

    it('player active ⇒ hidden (players direct themselves)', () => {
        synced.aiConfig = CONFIGURED;
        const { container } = render(<AiDirectorPanel campaignName={CN} activeCreature={{ name: 'Rakan', type: 'player', currentHp: 20 }} isLocalhost onStampTarget={vi.fn()} />);
        expect(container.innerHTML).toBe('');
    });

    it('suggest mode: card appears and NOTHING stamps until Confirm', async () => {
        synced.aiConfig = CONFIGURED;
        stubDirector();
        const stamp = vi.fn();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} />);
        fireEvent.click(screen.getByText(/AI director: decide Goblin 1's turn/));
        await waitFor(() => expect(screen.getByText(/Scimitar → Rakan/)).toBeInTheDocument());
        expect(stamp).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Confirm'));
        await waitFor(() => expect(stamp).toHaveBeenCalledWith('Goblin 1', 'Rakan'));
        expect(screen.getByText(/engine rolls, not the AI/)).toBeInTheDocument();
    });

    it('dismiss discards without stamping', async () => {
        synced.aiConfig = CONFIGURED;
        stubDirector();
        const stamp = vi.fn();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} />);
        fireEvent.click(screen.getByText(/AI director: decide/));
        await waitFor(() => expect(screen.getByText('Dismiss')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Dismiss'));
        await waitFor(() => expect(screen.queryByText(/Scimitar → Rakan/)).toBeNull());
        expect(stamp).not.toHaveBeenCalled();
    });

    it('autopilot auto-asks at the NPC turn seam and auto-stamps the target', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubDirector();
        const stamp = vi.fn();
        const { unmount } = render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={7} />);
        await waitFor(() => expect(stamp).toHaveBeenCalledWith('Goblin 1', 'Rakan'));
        // remount within the same creature+round: deduped (no second model call)
        const fetchCalls = fetch.mock.calls.length;
        unmount();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={7} />);
        await new Promise(res => setTimeout(res, 50));
        expect(fetch.mock.calls.length).toBe(fetchCalls);
    });

    it('autopilot move intent stays advisory (drag lane owns it)', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubDirector({ ok: true, mode: 'autopilot', intent: { intent: 'move', creatureName: 'Goblin 1', feet: 30, direction: 'toward Rakan' } });
        const stamp = vi.fn();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={8} />);
        await waitFor(() => expect(screen.getByText(/30 ft\./)).toBeInTheDocument());
        expect(stamp).not.toHaveBeenCalled();
        expect(screen.getByText(/drag the token/)).toBeInTheDocument();
    });

    it('needs_human surfaces for the referee, never auto-applies', async () => {
        synced.aiConfig = { ...CONFIGURED, mode: 'autopilot' };
        stubDirector({ ok: false, code: 'AI_NEEDS_HUMAN', intent: { intent: 'needs_human', creatureName: 'Goblin 1', text: 'AI director: no living targets' } });
        const stamp = vi.fn();
        render(<AiDirectorPanel campaignName={CN} activeCreature={NPC} isLocalhost onStampTarget={stamp} round={9} />);
        await waitFor(() => expect(screen.getByText(/AI director: no living targets/)).toBeInTheDocument());
        expect(stamp).not.toHaveBeenCalled();
    });
});
