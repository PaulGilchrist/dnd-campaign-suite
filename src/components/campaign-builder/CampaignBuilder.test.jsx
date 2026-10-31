// @maintained-by-ai
// Campaign-authoring plan Phase 3 — Campaign Builder review hub: grouped
// draft rendering, story-tie chips, approve/reject wiring through the
// shared draftActions service, and the clean empty state.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/campaign/draftActions.js', async () => {
    const actual = await vi.importActual('../../services/campaign/draftActions.js');
    return {
        ...actual,
        loadDrafts: vi.fn(),
        approveDraft: vi.fn(async () => {}),
        rejectDraft: vi.fn(async () => {}),
    };
});

// The embedded designer section probes AI status on mount — off here, so the
// panel tests stay about the review flow.
vi.mock('../../services/ai/aiClient.js', () => ({
    getAiStatus: vi.fn(async () => ({ configured: false })),
    loadDesignerConversation: vi.fn(async () => ({ messages: [] })),
    saveDesignerPendingPlan: vi.fn(async () => ({ ok: true })),
    designerChat: vi.fn(), designerPlan: vi.fn(), designerGenerate: vi.fn(),
}));

import { loadDrafts, approveDraft, rejectDraft } from '../../services/campaign/draftActions.js';
import CampaignBuilder from './CampaignBuilder.jsx';

const GROUPS = {
    factions: [{ id: 'f1', name: 'Cult of the Frostmaw', influence: 4, draft: true }],
    settlements: [{ name: 'Mudport', size: 'village', notableNPCs: ['Oldhem the Ferryman'], draft: true }],
    npcs: [{ name: 'Oldhem the Ferryman', description: '', personality: 'Gruff', draft: true }],
    quests: [{ id: 'q1', name: 'Silence the Bell', status: 'active', description: 'Ring nothing.', draft: true }],
    encounters: [{ name: 'Ferry Ambush', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }], draft: true }],
    sessions: [{ name: 'Session 4', links: { npcs: ['Oldhem the Ferryman'] }, draft: true }],
    maps: [],
};

beforeEach(() => {
    loadDrafts.mockReset();
    approveDraft.mockClear();
    rejectDraft.mockClear();
    loadDrafts.mockResolvedValue(JSON.parse(JSON.stringify(GROUPS)));
});

describe('CampaignBuilder', () => {
    it('renders one section per non-empty kind and skips empty kinds', async () => {
        render(<CampaignBuilder campaignName="test-campaign" />);
        expect(await screen.findByText('Factions')).toBeTruthy();
        expect(screen.getByText('Sessions')).toBeTruthy();
        expect(screen.queryByText('Maps')).toBeNull();
        expect(screen.getByText('Cult of the Frostmaw')).toBeTruthy();
    });

    it('surfaces story ties so the GM reviews how content connects', async () => {
        render(<CampaignBuilder campaignName="test-campaign" />);
        await screen.findByText('Ferry Ambush');
        expect(screen.getByText('Goblin ×2')).toBeTruthy();   // encounter → bestiary
        expect(screen.getAllByText('Oldhem the Ferryman').length).toBeGreaterThan(1); // settlement + session chips
        expect(screen.getByText('npc: Oldhem the Ferryman')).toBeTruthy();
    });

    it('approve and reject route through draftActions with kind+row, then refresh', async () => {
        render(<CampaignBuilder campaignName="test-campaign" />);
        await screen.findByText('Silence the Bell');
        const npcName = screen.getAllByText('Oldhem the Ferryman')
            .find(el => el.classList.contains('campaign-builder-row-name'));
        const row = npcName.closest('.campaign-builder-row');

        fireEvent.click(row.querySelector('button.ct-btn-primary'));
        await waitFor(() => expect(approveDraft).toHaveBeenCalledWith(
            'test-campaign', 'npcs', expect.objectContaining({ name: 'Oldhem the Ferryman' })
        ));

        fireEvent.click(row.querySelector('button.ct-btn-danger'));
        await waitFor(() => expect(rejectDraft).toHaveBeenCalledWith(
            'test-campaign', 'npcs', expect.objectContaining({ name: 'Oldhem the Ferryman' })
        ));
        expect(loadDrafts.mock.calls.length).toBeGreaterThanOrEqual(3); // mount + both refreshes
    });

    it('empty state tells the GM where drafts come from', async () => {
        loadDrafts.mockResolvedValue({ factions: [], settlements: [], npcs: [], quests: [], encounters: [], sessions: [], maps: [] });
        render(<CampaignBuilder campaignName="test-campaign" />);
        expect(await screen.findByText(/Nothing is drafted right now/)).toBeTruthy();
        expect(screen.queryByText('Approve all (0)')).toBeNull();
    });

    it('load failure shows the error banner instead of a dead panel', async () => {
        loadDrafts.mockRejectedValue(new Error('campaign offline'));
        render(<CampaignBuilder campaignName="test-campaign" />);
        expect((await screen.findByRole('alert')).textContent).toContain('campaign offline');
    });
});
