// @maintained-by-ai 2026-11-21
// MMM 2026-11-21 — quest_draft ledger-check PENDING face: while the ledger
// fetch is in flight (ledgerNames === null) the card says "Checking ledger
// names…" instead of posing as scrutiny-clean; the affordance is quest-card-
// only, never blocks the action row, and retires exactly when the fetch
// resolves (settled faces — silence or the amber advisory — are pinned by
// AiWorldConsole.name-scrutiny.test.jsx).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs at the transport seams only — card rendering and the
// pending/advisory logic run for real (same seam set as name-scrutiny).
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

// A promise the test resolves by hand — stalls the ledger lane mid-flight.
function deferred() {
    let resolve
    const promise = new Promise(r => { resolve = r })
    return { promise, resolve }
}

// Freeze all four ledger loaders on one gate so the card dwells with
// ledgerNames === null exactly as it does live between mount and arrival.
function stallLedgers(payloads) {
    const gate = deferred()
    const loaders = [[loadNPCs, 'npcs'], [loadSettlements, 'settlements'], [loadFactions, 'factions'], [loadQuests, 'quests']]
    loaders.forEach(([loader], i) => loader.mockReturnValue(gate.promise.then(() => payloads[i])))
    return gate
}

const RESOLVED_LEDGERS = [
    { npcs: [{ name: 'Marta Copperkettle' }] },
    { settlements: [{ name: 'Bravor' }] },
    { factions: [{ name: 'The Iron Consortium' }] },
    [{ name: 'The Lost Artifact' }], // loadQuests unwraps to a bare array
]

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
    loadNPCs.mockResolvedValue({ npcs: [{ name: 'Marta Copperkettle' }] });
    loadSettlements.mockResolvedValue({ settlements: [{ name: 'Bravor' }] });
    loadFactions.mockResolvedValue({ factions: [{ name: 'The Iron Consortium' }] });
    loadQuests.mockResolvedValue([{ name: 'The Lost Artifact' }]);
});

describe('AiWorldConsole — quest_draft ledger-check pending face', () => {
    it('quest card with the ledger fetch in flight renders the pending affordance', async () => {
        stallLedgers(RESOLVED_LEDGERS);
        await askFor(groundedQuest);
        expect(pending()).not.toBeNull();
    });

    it('pending does not block the action row: Add quest and Dismiss stay clickable mid-flight', async () => {
        stallLedgers(RESOLVED_LEDGERS);
        await askFor(fabricatedQuest);
        expect(pending()).not.toBeNull();

        const add = screen.getByRole('button', { name: 'Add quest to ledger' });
        const dismiss = screen.getByRole('button', { name: 'Dismiss' });
        expect(add).toBeEnabled();
        expect(dismiss).toBeEnabled();
        fireEvent.click(add);
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith({ campaignName: CN, proposal: fabricatedQuest }));
    });

    it('dismiss works while pending — card (and pending text) vanish with zero writes', async () => {
        stallLedgers(RESOLVED_LEDGERS);
        await askFor(groundedQuest);
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        await waitFor(() => expect(pending()).toBeNull());
        expect(screen.queryByText(groundedQuest.name.slice(0, 8))).toBeNull();
        expect(applyWorldProposal).not.toHaveBeenCalled();
    });

    it('fetch resolves → pending retires and the settled faces render as before (grounded: silent)', async () => {
        const gate = stallLedgers(RESOLVED_LEDGERS);
        await askFor(groundedQuest);
        expect(pending()).not.toBeNull();
        gate.resolve(undefined);
        await waitFor(() => expect(pending()).toBeNull());
        expect(advisory()).toBeNull(); // grounded card stays advisory-free after resolution
    });

    it('fetch resolves → pending retires and the advisory takes over for unknown names', async () => {
        const gate = stallLedgers(RESOLVED_LEDGERS);
        await askFor(fabricatedQuest);
        expect(pending()).not.toBeNull();
        expect(advisory()).toBeNull(); // never both faces at once
        gate.resolve(undefined);
        await waitFor(() => expect(pending()).toBeNull());
        await waitFor(() => expect(advisory()).not.toBeNull());
        expect(advisory().textContent).toContain('Nobody McFakeface');
    });

    it('sibling kinds never show the pending face (recap card, frozen ledgers)', async () => {
        stallLedgers(RESOLVED_LEDGERS);
        await askFor({ kind: 'recap', text: 'Ash and ember.' });
        expect(pending()).toBeNull();
        expect(loadNPCs).not.toHaveBeenCalled();
    });

    it('a fresh quest ask re-arms the pending face instead of wearing the previous card’s verdict', async () => {
        // First card fully settles…
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: groundedQuest });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quest_draft' } });
        fireEvent.click(generateBtn());
        await waitFor(() => expect(loadQuests).toHaveBeenCalledWith(CN));
        await waitFor(() => expect(pending()).toBeNull());

        // …then a second ask stalls mid-flight: pending must return.
        const gate = stallLedgers(RESOLVED_LEDGERS)
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: fabricatedQuest });
        fireEvent.click(generateBtn());
        await waitFor(() => expect(screen.getByText('The Drowned Ledger — Bring the seal to Nobody McFakeface beneath Nowhere-on-Sea. (rewards: 200 gp)')).toBeInTheDocument());
        expect(pending()).not.toBeNull();
        gate.resolve(undefined);
    });
});
