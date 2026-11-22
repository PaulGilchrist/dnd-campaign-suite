// @maintained-by-ai
// Backlog 2026-11-22 — quest_draft ledger-check INCOMPLETE face: a REJECTED
// ledger lane is UNREADABLE, not empty, so the card must never wear a verdict
// (advisory or all-clear) grounded against a partial ledger. Instead it shows a
// muted pill naming the failed lane(s), the advisory is suppressed, and the
// action row stays live. Happy paths are pinned by name-scrutiny + ledger-pending.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs at the transport seams only — card rendering and the
// pending/advisory/incomplete logic run for real (same seam set as siblings).
vi.mock('../../services/ai/aiClient.js', () => ({ askWorldKeeper: vi.fn() }));
vi.mock('../../services/ai/applyWorldProposal.js', () => ({ applyWorldProposal: vi.fn() }));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../services/campaign/settlementsService.js', () => ({ loadSettlements: vi.fn() }));
vi.mock('../../services/campaign/factionsService.js', () => ({ loadFactions: vi.fn() }));
vi.mock('../../services/campaign/questsService.js', () => ({ loadQuests: vi.fn() }));

import { askWorldKeeper } from '../../services/ai/aiClient.js';
import { applyWorldProposal } from '../../services/ai/applyWorldProposal.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { loadSettlements } from '../../services/campaign/settlementsService.js';
import { loadFactions } from '../../services/campaign/factionsService.js';
import { loadQuests } from '../../services/campaign/questsService.js';
import AiWorldConsole from './AiWorldConsole.jsx';

const CN = 'test-campaign';

const generateBtn = () => screen.getByRole('button', { name: /Generate|Writing…/ });
const pending = () => screen.queryByText(/Checking ledger names…/);
const advisory = () => screen.queryByText(/names not in the ledger/);
const incomplete = () => screen.queryByText(/ledger check incomplete/i);

const groundedQuest = {
    kind: 'quest_draft',
    name: 'The Cellar Debt',
    description: 'Repay Marta Copperkettle before the fair in Bravor.',
    rewards: 'A warm meal',
};
const fabricatedQuest = {
    kind: 'quest_draft',
    name: 'The Drowned Ledger',
    description: 'Bring the seal to Nobody McFakeface beneath Nowhere-on-Sea.',
    rewards: '200 gp',
};

// Healthy payloads: the component maps each GET through ledgerNameList.
const HEALTHY = {
    npcs: { npcs: [{ name: 'Marta Copperkettle' }] },
    settlements: { settlements: [{ name: 'Bravor' }] },
    factions: { factions: [{ name: 'The Iron Consortium' }] },
    quests: [{ name: 'The Lost Artifact' }], // loadQuests unwraps to a bare array
};
const LEDGER_LOADERS = [[loadNPCs, 'npcs'], [loadSettlements, 'settlements'], [loadFactions, 'factions'], [loadQuests, 'quests']];

// Resolve every lane healthy except the named one(s), which reject — exactly
// the live face of one list GET 500ing while the other three land.
function rejectLanes(...laneKeys) {
    LEDGER_LOADERS.forEach(([loader, key]) => {
        loader.mockImplementation(() =>
            laneKeys.includes(key)
                ? Promise.reject(new Error(`${key} unavailable`))
                : Promise.resolve(HEALTHY[key])
        );
    });
}

const askFor = async (proposal) => {
    askWorldKeeper.mockResolvedValue({ ok: true, proposal });
    render(<AiWorldConsole campaignName={CN} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: proposal.kind } });
    fireEvent.click(generateBtn());
    await waitFor(() => expect(screen.getByText(proposal.kind.replace('_', ' '))).toBeInTheDocument());
};

beforeEach(() => {
    vi.clearAllMocks();
    applyWorldProposal.mockResolvedValue({ applied: true, detail: 'quest added.' });
    LEDGER_LOADERS.forEach(([loader, key]) => loader.mockResolvedValue(HEALTHY[key]));
});

describe('AiWorldConsole — quest_draft ledger-check incomplete face', () => {
    it('one rejected lane → incomplete pill names it, no advisory, no all-clear', async () => {
        rejectLanes('npcs');
        await askFor(fabricatedQuest); // unknown names WOULD advise on a full ledger
        await waitFor(() => expect(incomplete()).not.toBeNull());
        expect(incomplete().textContent).toContain('NPC roster');
        expect(advisory()).toBeNull(); // verdict suppressed — the ledger was partial
        expect(pending()).toBeNull();  // pending retired into the incomplete face
    });

    it('a grounded quest with a rejected lane still shows incomplete — silence is never an all-clear here', async () => {
        rejectLanes('factions');
        await askFor(groundedQuest); // on full ledgers this card settles silent
        await waitFor(() => expect(incomplete()).not.toBeNull());
        expect(incomplete().textContent).toContain('factions');
        expect(advisory()).toBeNull();
    });

    it('total failure (all four lanes reject) → same incomplete face naming every lane, never an all-clear', async () => {
        rejectLanes('npcs', 'settlements', 'factions', 'quests');
        await askFor(fabricatedQuest);
        await waitFor(() => expect(incomplete()).not.toBeNull());
        // Pins lane-name mapping coverage: all four lanes carry a label that
        // reaches the pill copy.
        const copy = incomplete().textContent;
        ['NPC roster', 'settlements', 'factions', 'quests'].forEach(label => expect(copy).toContain(label));
        expect(advisory()).toBeNull();
    });

    it('all four lanes resolve → no incomplete pill, normal advisory fires unchanged for unknown names', async () => {
        await askFor(fabricatedQuest);
        await waitFor(() => expect(advisory()).not.toBeNull()); // full-success path intact
        expect(incomplete()).toBeNull();
        expect(pending()).toBeNull();
    });

    it('the incomplete pill reuses the pending pill chrome (.ai-world-pending)', async () => {
        rejectLanes('quests');
        await askFor(groundedQuest);
        await waitFor(() => expect(incomplete()).not.toBeNull());
        expect(incomplete().className).toContain('ai-world-pending');
        expect(incomplete().getAttribute('role')).toBe('status');
    });

    it('incomplete does not gate the apply lane: Add quest and Dismiss stay live', async () => {
        rejectLanes('npcs');
        await askFor(fabricatedQuest);
        await waitFor(() => expect(incomplete()).not.toBeNull());
        const add = screen.getByRole('button', { name: 'Add quest to ledger' });
        const dismiss = screen.getByRole('button', { name: 'Dismiss' });
        expect(add).toBeEnabled();
        expect(dismiss).toBeEnabled();
        fireEvent.click(add);
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith({ campaignName: CN, proposal: fabricatedQuest }));
    });

    it('non-quest kinds stay silent when a lane would reject — loaders never even run', async () => {
        rejectLanes('npcs');
        await askFor({ kind: 'recap', text: 'Ash and ember.' });
        expect(incomplete()).toBeNull();
        expect(pending()).toBeNull();
        expect(loadNPCs).not.toHaveBeenCalled();
    });

    it('reset law: a fresh quest card after a failed one re-arms pending, not the stale incomplete face', async () => {
        // First card settles into the incomplete face…
        rejectLanes('npcs');
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: groundedQuest });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quest_draft' } });
        fireEvent.click(generateBtn());
        await waitFor(() => expect(incomplete()).not.toBeNull());

        // …then a second ask stalls mid-flight: pending returns and the
        // previous card's incomplete face does not linger.
        let resolveGate
        const gate = new Promise(r => { resolveGate = r })
        LEDGER_LOADERS.forEach(([loader, key]) => loader.mockReturnValue(gate.then(() => HEALTHY[key])))
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: fabricatedQuest });
        fireEvent.click(generateBtn());
        await waitFor(() => expect(screen.getByText('quest draft')).toBeInTheDocument());
        expect(pending()).not.toBeNull();
        expect(incomplete()).toBeNull();
        resolveGate(undefined);
    });
});
