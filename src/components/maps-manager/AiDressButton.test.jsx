// @maintained-by-ai
// Campaign-authoring residual item 2 — the AI Dress row affordance: instruction
// → validated op PREVIEW (nothing saved), GM Apply → the pre-validated merged
// document goes through the normal map save lane and logs the applied dressing.
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';

const dressMapProposal = vi.fn();
const saveMapData = vi.fn();
const addEntry = vi.fn();

// aiConfig runtime-store lane (backlog 2026-11-05 CX no-config pre-disable):
// stubbed the same way AiDirectorPanel.test.jsx stubs the synced state — the
// tests set `synced.aiConfig` to steer the gate.
const synced = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: (_key, prop) => (prop in synced ? synced[prop] : null),
}));

vi.mock('../../services/ai/aiClient.js', () => ({ dressMapProposal: (...a) => dressMapProposal(...a) }));
vi.mock('../../services/maps/mapsService.js', () => ({ saveMapData: (...a) => saveMapData(...a) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: (...a) => addEntry(...a) }));

import AiDressButton from './AiDressButton.jsx';

const MAP = { name: 'Battle Arena', fileName: 'battle-arena.json', slug: 'battle-arena' };
const CONFIGURED = { endpoint: 'http://localhost:11434/v1', model: 'stub-llm', mode: 'suggest' };
const PROPOSAL = {
    ok: true,
    map: 'battle-arena',
    ops: [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 12, gridY: 8 }],
    preview: ['add chest at 12,8', 'remove torch-0-2-4', 'move Goblin → 9,6'],
    updated: { name: 'battle-arena', draft: true, placedItems: [] },
};

beforeEach(() => {
    dressMapProposal.mockReset(); saveMapData.mockReset(); addEntry.mockReset();
    saveMapData.mockResolvedValue({ message: 'Map saved successfully' });
    addEntry.mockResolvedValue({});
    synced.aiConfig = CONFIGURED; // ask/Apply lanes below assume a live config
});
afterEach(cleanup);

async function askForProposal() {
    fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
    fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'trap the throne room' } });
    dressMapProposal.mockResolvedValue(PROPOSAL);
    fireEvent.click(screen.getByRole('button', { name: /dress map/i }));
    await waitFor(() => expect(screen.getByText('remove torch-0-2-4')).toBeInTheDocument());
}

describe('AiDressButton', () => {
    it('previews the validated op list WITHOUT writing, and only Apply saves through the normal lane', async () => {
        render(<AiDressButton campaignName="test-campaign" map={MAP} />);
        expect(screen.queryByPlaceholderText(/how should this map change/i)).toBeNull();

        await askForProposal();
        expect(dressMapProposal).toHaveBeenCalledWith({
            campaignName: 'test-campaign', mapName: 'battle-arena', instruction: 'trap the throne room',
        });
        // Preview rendered… and NOTHING has been persisted yet.
        expect(screen.getByText('add chest at 12,8')).toBeInTheDocument();
        expect(screen.getByText('move Goblin → 9,6')).toBeInTheDocument();
        expect(saveMapData).not.toHaveBeenCalled();

        saveMapData.mockClear();
        fireEvent.click(screen.getByRole('button', { name: /apply to map/i }));
        await waitFor(() => expect(saveMapData).toHaveBeenCalledWith('test-campaign', 'battle-arena', PROPOSAL.updated));
        // Applied dressing lands in the campaign log (automation-logging rule),
        // draft flag rode through on the merged document. The row carries a
        // human `description` (WY backlog: rows had none — the log list fell
        // back to the derived type label), singular op count reads "1 op".
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ai_dress', action: 'applied', map: 'battle-arena', ops: 1,
            description: 'AI dressed "battle-arena" with 1 op (applied)',
        }));
        expect(saveMapData.mock.calls[0][2].draft).toBe(true);
        // Applied → collapsed again, ready for the next pass.
        expect(screen.getByRole('button', { name: /dress "battle arena" with ai/i })).toBeTruthy();
    });

    it('dress errors surface inline and never reach the save lane', async () => {
        render(<AiDressButton campaignName="test-campaign" map={MAP} />);
        fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
        fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'do it' } });
        dressMapProposal.mockResolvedValue({ ok: false, errors: ['ops[0] lands at (30,3) — outside the map', 'id "ghost" is not in this map'] });
        fireEvent.click(screen.getByRole('button', { name: /dress map/i }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('outside the map');
        expect(alert.textContent).toContain('ghost');
        expect(saveMapData).not.toHaveBeenCalled();
    });

    it('a failing map save keeps the preview visible and skips the applied-log', async () => {
        render(<AiDressButton campaignName="test-campaign" map={MAP} />);
        await askForProposal();
        saveMapData.mockRejectedValue(new Error('Map save rejected: players array'));
        fireEvent.click(screen.getByRole('button', { name: /apply to map/i }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toMatch(/players array/);
        expect(addEntry).not.toHaveBeenCalled();
        expect(screen.getByText('add chest at 12,8')).toBeInTheDocument(); // retry stays possible
    });

    // Backlog ai-instruction-inputs-undersized: the row became a modal.
    it('opens a dialog with a ≥4-row instruction textarea, dismissable via Escape', async () => {
        render(<AiDressButton campaignName="test-campaign" map={MAP} />);
        fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
        const dialog = screen.getByRole('dialog', { name: /ai dress/i });
        const box = screen.getByPlaceholderText(/how should this map change/i);
        expect(dialog.contains(box)).toBe(true);
        expect(box.tagName).toBe('TEXTAREA');
        expect(box.rows).toBeGreaterThanOrEqual(4);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByPlaceholderText(/how should this map change/i)).toBeNull();
    });

    it('cancel clears the prompt and every proposal state', async () => {
        render(<AiDressButton campaignName="test-campaign" map={MAP} />);
        await askForProposal();
        fireEvent.click(screen.getByRole('button', { name: /close ai dress/i }));
        expect(screen.queryByPlaceholderText(/how should this map change/i)).toBeNull();
        expect(screen.queryByText('add chest at 12,8')).toBeNull();
        expect(saveMapData).not.toHaveBeenCalled();
    });

    // Backlog ai-dress-belongs-in-map-view: the SAME component mounted in the
    // open map view's toolbar. Behaviour (ask/Apply/log) is identical to the
    // list shortcut — what the map mount adds is the right-docked shell (the
    // grid stays readable) and the ops mirror out through onProposalChange
    // for the canvas overlay preview (null on close/Apply/unmount).
    describe('map-view mount', () => {
        it('docks the shell to the side (grid stays visible) and hints at the canvas markers', async () => {
            const { container } = render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={vi.fn()} />
            );
            fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
            expect(container.querySelector('.ai-instruction-overlay-dock')).not.toBeNull();
            fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'add a chest' } });
            dressMapProposal.mockResolvedValue(PROPOSAL);
            fireEvent.click(screen.getByRole('button', { name: /dress map/i }));
            await waitFor(() => expect(screen.getByText('add chest at 12,8')).toBeInTheDocument());
            expect(screen.getByText(/markers show on the map/i)).toBeInTheDocument();
        });

        it('mirrors the proposed ops out for the canvas overlay', async () => {
            const onProposalChange = vi.fn();
            render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={onProposalChange} />
            );
            await askForProposal();
            expect(onProposalChange).toHaveBeenLastCalledWith(PROPOSAL.ops);
        });

        it('the list shortcut keeps the plain centered modal (no dock, no canvas hint)', async () => {
            const { container } = render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            await askForProposal();
            expect(container.querySelector('.ai-instruction-overlay')).not.toHaveClass('ai-instruction-overlay-dock');
            expect(screen.queryByText(/markers show on the map/i)).toBeNull();
        });

        it('close after a propose pushes null and POSTs nothing (disk byte-clean)', async () => {
            const onProposalChange = vi.fn();
            render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={onProposalChange} />
            );
            await askForProposal();
            onProposalChange.mockClear();
            fireEvent.click(screen.getByRole('button', { name: /close ai dress/i }));
            expect(onProposalChange).toHaveBeenCalledWith(null);
            expect(saveMapData).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('unmounting mid-preview (e.g. the 2D↔3D toolbar switch) wipes the mirror too', async () => {
            const onProposalChange = vi.fn();
            const { unmount } = render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={onProposalChange} />
            );
            await askForProposal();
            onProposalChange.mockClear();
            unmount();
            expect(onProposalChange).toHaveBeenCalledWith(null);
        });

        it('Apply passthrough is UNCHANGED: same save lane, same applied log, mirror cleared', async () => {
            const onProposalChange = vi.fn();
            render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={onProposalChange} />
            );
            await askForProposal();
            onProposalChange.mockClear();
            fireEvent.click(screen.getByRole('button', { name: /apply to map/i }));
            await waitFor(() => expect(saveMapData).toHaveBeenCalledWith('test-campaign', 'battle-arena', PROPOSAL.updated));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ai_dress', action: 'applied', map: 'battle-arena', ops: 1,
                description: 'AI dressed "battle-arena" with 1 op (applied)',
            }));
            // Apply → close() → the ops mirror wipes (canvas preview vanishes).
            await waitFor(() => expect(onProposalChange).toHaveBeenLastCalledWith(null));
        });

        // Backlog (2026-11-01 AW): "toolbar dress button reachable during preview" —
        // live-proved benign: the component REPLACES its toolbar button with the
        // modal (button + modal are mutually exclusive render arms), so while any
        // dress dialog is open there is no second trigger to click — mid-preview
        // re-clicks are structurally impossible (trusted clicks hit the fixed
        // overlay, synthetic clicks find no element). This pins that invariant so
        // a future split of the two arms into simultaneous mounts trips here.
        it('the toolbar trigger unmounts while the dialog is open (no mid-preview re-click target)', async () => {
            const trigger = () => screen.queryByRole('button', { name: /dress "battle arena" with ai/i });
            render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={vi.fn()} />
            );
            expect(trigger()).toBeTruthy(); // closed → the button is the only surface
            fireEvent.click(trigger());
            expect(trigger()).toBeNull();   // ask stage → button gone, dialog up
            fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'add a chest' } });
            dressMapProposal.mockResolvedValue(PROPOSAL);
            fireEvent.click(screen.getByRole('button', { name: /dress map/i }));
            await waitFor(() => expect(screen.getByText('add chest at 12,8')).toBeInTheDocument());
            // preview stage → still exactly one dialog, still no trigger to stack
            expect(trigger()).toBeNull();
            expect(screen.getAllByRole('dialog')).toHaveLength(1);
        });
    });

    // Backlog (2026-11-12 WY) ai-dress-hides-vocabulary: the modal states its
    // ITEM-only capability vocabulary up front, and an honestly furniture-only
    // answer to a structure-implied ask is called out with a sentinel instead
    // of silently dropping the walls. The dress cycle itself is unchanged.
    describe('capability vocabulary (hint + structure sentinel)', () => {
        const CAPABILITY_HINT = /dress supports item-level operations only/i;
        const SENTINEL = /the model proposed no structural changes \(dress supports items only\)/i;

        async function askWith(text) {
            fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
            fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: text } });
            dressMapProposal.mockResolvedValue(PROPOSAL);
            fireEvent.click(screen.getByRole('button', { name: /dress map/i }));
            await waitFor(() => expect(screen.getByText('add chest at 12,8')).toBeInTheDocument());
        }

        it('the hint renders inside .ai-instruction-overlay every time the modal opens', () => {
            const { container } = render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
            const hint = screen.getByText(CAPABILITY_HINT);
            expect(container.querySelector('.ai-instruction-overlay').contains(hint)).toBe(true);
            expect(hint.textContent).toMatch(/tables, chairs, chests/i);
            expect(hint.textContent).toMatch(/walls, doors or other structural changes/i);
        });

        it('the map-view mount shows the same hint (shared component, both entry points)', () => {
            const { container } = render(
                <AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={vi.fn()} />
            );
            fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
            const hint = screen.getByText(CAPABILITY_HINT);
            expect(container.querySelector('.ai-instruction-overlay').contains(hint)).toBe(true);
        });

        it('a structure-implied ask answered with furniture-only ops gets the honest sentinel near the preview', async () => {
            render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            await askWith('enclose the room with walls');
            const notice = screen.getByRole('status');
            expect(notice.textContent).toMatch(SENTINEL);
            // The preview is still offered (the model honestly obeyed the subset).
            expect(screen.getByText('add chest at 12,8')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /apply to map/i })).toBeInTheDocument();
        });

        it('a purely item-only instruction never shows the sentinel (no false positives)', async () => {
            render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            await askWith('add a table at 10,10 and two chairs');
            expect(screen.queryByText(SENTINEL)).toBeNull();
        });

        it('Apply after a sentinelled preview still saves through the normal lane (cycle unchanged)', async () => {
            render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            await askWith('enclose the room with walls');
            fireEvent.click(screen.getByRole('button', { name: /apply to map/i }));
            await waitFor(() => expect(saveMapData).toHaveBeenCalledWith('test-campaign', 'battle-arena', PROPOSAL.updated));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ai_dress', action: 'applied', map: 'battle-arena', ops: 1,
                description: 'AI dressed "battle-arena" with 1 op (applied)',
            }));
        });

        // WY backlog (2026-11-12): the applied row names the map + op count in a
        // plural register ("4 ops") exactly mirroring the server's preview row.
        it('a multi-op Apply logs the plural description', async () => {
            render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            const manyOps = {
                ...PROPOSAL,
                ops: Array.from({ length: 4 }, (_, i) => ({ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 5 + i, gridY: 5 })),
            };
            fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
            fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'dress it up' } });
            dressMapProposal.mockResolvedValue(manyOps);
            fireEvent.click(screen.getByRole('button', { name: /dress map/i }));
            await waitFor(() => expect(screen.getByText('add chest at 12,8')).toBeInTheDocument());
            fireEvent.click(screen.getByRole('button', { name: /apply to map/i }));
            await waitFor(() => expect(saveMapData).toHaveBeenCalled());
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ai_dress', action: 'applied', ops: 4,
                description: 'AI dressed "battle-arena" with 4 ops (applied)',
            }));
        });
    });

    // Backlog (2026-11-05 CX) no-config-path-POSTs-before-telling: with AI
    // unset/off the ask form told you only AFTER a POST drew the server's
    // by-design 403. Now the gate mirrors AiRefereeSection (`mode && mode !==
    // 'off'`): notice up-front, submit disabled from the first paint, and the
    // Cmd/Ctrl+Enter lane guarded too — the whole open→type→close flow is
    // zero traffic.
    describe('no-config pre-disable', () => {
        for (const [label, cfg] of [['unset (null)', null], ['mode off', { ...CONFIGURED, mode: 'off' }]]) {
            it(`${label}: notice + disabled submit before typing, typing and ⌘Enter stay inert`, () => {
                synced.aiConfig = cfg;
                render(<AiDressButton campaignName="test-campaign" map={MAP} mount="map" onProposalChange={vi.fn()} />);
                fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));

                expect(screen.getByRole('status').textContent).toMatch(/AI is not enabled for this campaign/i);
                const submit = screen.getByRole('button', { name: /dress map/i });
                expect(submit).toBeDisabled(); // BEFORE anything is typed

                fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'line the gallery with banners' } });
                expect(submit).toBeDisabled(); // typing changes nothing
                fireEvent.keyDown(screen.getByPlaceholderText(/how should this map change/i), { key: 'Enter', metaKey: true });
                fireEvent.click(submit); // jsdom dispatches on disabled? belt-and-braces inertness check
                expect(dressMapProposal).not.toHaveBeenCalled();

                fireEvent.click(screen.getByRole('button', { name: /close ai dress/i }));
                expect(dressMapProposal).not.toHaveBeenCalled(); // open→type→close: zero POSTs
            });
        }

        it('the gate is live: config arriving while the dialog is open enables submit (SSE echo face)', () => {
            synced.aiConfig = null;
            render(<AiDressButton campaignName="test-campaign" map={MAP} />);
            fireEvent.click(screen.getByRole('button', { name: /dress "battle arena" with ai/i }));
            expect(screen.getByRole('button', { name: /dress map/i })).toBeDisabled();

            // Simulate the store update an SSE aiConfig echo produces: new
            // hook value on the next render.
            synced.aiConfig = CONFIGURED;
            fireEvent.change(screen.getByPlaceholderText(/how should this map change/i), { target: { value: 'add a chest' } });
            expect(screen.queryByRole('status')).toBeNull(); // notice gone…
            expect(screen.getByRole('button', { name: /dress map/i })).toBeEnabled(); // …button live-enables
        });
    });
});
