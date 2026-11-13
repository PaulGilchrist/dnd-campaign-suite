// @maintained-by-ai
// Backlog 2026-11-01 (AV) — quest_draft accept-scrutiny CHIP on the world
// card: unknown ledger names get a non-blocking advisory naming them,
// ledger-grounded cards stay chip-free, and the "Add quest to ledger" apply
// path is byte-identical (the advisory never blocks or mutates the write).
// The scrubbing heuristics themselves are pinned by proposalNameAudit.test.js.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Boundary stubs at the transport seams only — card rendering and the
// advisory computation (findUnknownLedgerNames) run for real.
vi.mock('../../services/ai/aiClient.js', () => ({ askWorldKeeper: vi.fn() }));
vi.mock('../../services/ai/applyWorldProposal.js', () => ({ applyWorldProposal: vi.fn() }));
vi.mock('../../services/npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../services/campaign/settlementsService.js', () => ({ loadSettlements: vi.fn() }));
vi.mock('../../services/campaign/factionsService.js', () => ({ loadFactions: vi.fn() }));

import { askWorldKeeper } from '../../services/ai/aiClient.js';
import { applyWorldProposal } from '../../services/ai/applyWorldProposal.js';
import { loadNPCs } from '../../services/npcs/npcsService.js';
import { loadSettlements } from '../../services/campaign/settlementsService.js';
import { loadFactions } from '../../services/campaign/factionsService.js';
import AiWorldConsole from './AiWorldConsole.jsx';

const CN = 'test-campaign';

const generateBtn = () => screen.getByRole('button', { name: /Generate|Writing…/ });
const advisory = () => screen.queryByText(/names not in the ledger/);

const fabricatedQuest = {
    kind: 'quest_draft',
    name: 'The Drowned Ledger',
    description: 'Bring the seal to Nobody McFakeface beneath Nowhere-on-Sea.',
    rewards: '200 gp',
};
const groundedQuest = {
    kind: 'quest_draft',
    name: 'The Cellar Debt',
    description: 'Repay Marta Copperkettle before the fair in Bravor.',
    rewards: 'A warm meal',
};

beforeEach(() => {
    vi.clearAllMocks();
    applyWorldProposal.mockResolvedValue({ applied: true, detail: 'quest added.' });
    loadNPCs.mockResolvedValue({ npcs: [{ name: 'Marta Copperkettle' }] });
    loadSettlements.mockResolvedValue({ settlements: [{ name: 'Bravor' }] });
    loadFactions.mockResolvedValue({ factions: [{ name: 'The Iron Consortium' }] });
});

const askQuest = async (proposal) => {
    askWorldKeeper.mockResolvedValue({ ok: true, proposal });
    render(<AiWorldConsole campaignName={CN} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quest_draft' } });
    fireEvent.click(generateBtn());
    await waitFor(() => expect(screen.getByText('quest draft')).toBeInTheDocument());
};

describe('AiWorldConsole — quest_draft accept-scrutiny chip', () => {
    it('fabricated names → non-blocking advisory chip names each unknown, ledger names stay out', async () => {
        await askQuest(fabricatedQuest);
        await waitFor(() => expect(advisory()).not.toBeNull());
        expect(advisory().textContent).toContain('Nobody McFakeface');
        expect(advisory().textContent).toContain('Nowhere-on-Sea');
        expect(advisory().textContent).not.toContain('Marta'); // only unknowns are named
        // non-blocking: the apply affordance is still there, enabled
        expect(screen.getByRole('button', { name: 'Add quest to ledger' })).toBeEnabled();
    });

    it('every name ledger-known → no advisory chip renders', async () => {
        await askQuest(groundedQuest);
        await waitFor(() => expect(loadNPCs).toHaveBeenCalledWith(CN));
        expect(advisory()).toBeNull();
    });

    // YB 2026-11-13 — possessive-noise fix, component wiring face: faction
    // ledger names count, and POSSESSIVE forms of ledger names stay out of
    // the advisory while an invented name still surfaces.
    it('possessive of a ledger faction stays out of the advisory; an invented name is named', async () => {
        await askQuest({
            kind: 'quest_draft',
            name: 'Parley at the Quay',
            description: "The Iron Consortium's agent Marta Copperkettle meets Zarvok on the quay.",
            rewards: '',
        });
        await waitFor(() => expect(loadFactions).toHaveBeenCalledWith(CN));
        await waitFor(() => expect(advisory()).not.toBeNull());
        expect(advisory().textContent).toContain('Zarvok');
        expect(advisory().textContent).not.toContain('Iron Consortium');
        expect(advisory().textContent).not.toContain('Marta');
    });

    it('empty ledgers → graceful silence (nothing to check against, no crash)', async () => {
        loadNPCs.mockResolvedValue({ npcs: [] });
        loadSettlements.mockResolvedValue({ settlements: [] });
        loadFactions.mockResolvedValue({ factions: [] });
        await askQuest(fabricatedQuest);
        await waitFor(() => expect(loadNPCs).toHaveBeenCalled());
        expect(advisory()).toBeNull();
    });

    it('ledger fetch death → the card still renders un-adorned and stays applyable', async () => {
        loadNPCs.mockRejectedValue(new Error('offline'));
        loadSettlements.mockRejectedValue(new Error('offline'));
        loadFactions.mockRejectedValue(new Error('offline'));
        await askQuest(fabricatedQuest);
        await waitFor(() => expect(loadNPCs).toHaveBeenCalled());
        expect(advisory()).toBeNull();
        expect(screen.getByRole('button', { name: 'Add quest to ledger' })).toBeEnabled();
    });

    it('sibling kinds never query the ledgers — a recap card stays chip- and fetch-free', async () => {
        askWorldKeeper.mockResolvedValue({ ok: true, proposal: { kind: 'recap', text: 'Ash and ember.' } });
        render(<AiWorldConsole campaignName={CN} />);
        fireEvent.click(generateBtn());
        await waitFor(() => expect(screen.getByText('Ash and ember.')).toBeInTheDocument());
        expect(loadNPCs).not.toHaveBeenCalled();
        expect(loadSettlements).not.toHaveBeenCalled();
        expect(loadFactions).not.toHaveBeenCalled();
        expect(advisory()).toBeNull();
    });

    it('apply path is unchanged: the chip notwithstanding, Add quest writes with the same proposal', async () => {
        await askQuest(fabricatedQuest);
        await waitFor(() => expect(advisory()).not.toBeNull());

        fireEvent.click(screen.getByRole('button', { name: 'Add quest to ledger' }));
        await waitFor(() => expect(applyWorldProposal).toHaveBeenCalledWith({ campaignName: CN, proposal: fabricatedQuest }));
        // Success notice, anchored by text — the applied card (with its
        // advisory still riding along, role=status) means getByRole('status')
        // now finds two nodes (backlog AV applied-state copy).
        await waitFor(() => expect(screen.getByText('Applied: quest added.')).toBeInTheDocument());
        expect(advisory()).not.toBeNull(); // the receipt card (and its scrutiny note) stay mounted
    });
});
