// @maintained-by-ai
// Campaign-authoring residual item 2 — the AI Dress row affordance: instruction
// → validated op PREVIEW (nothing saved), GM Apply → the pre-validated merged
// document goes through the normal map save lane and logs the applied dressing.
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';

const dressMapProposal = vi.fn();
const saveMapData = vi.fn();
const addEntry = vi.fn();

vi.mock('../../services/ai/aiClient.js', () => ({ dressMapProposal: (...a) => dressMapProposal(...a) }));
vi.mock('../../services/maps/mapsService.js', () => ({ saveMapData: (...a) => saveMapData(...a) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: (...a) => addEntry(...a) }));

import AiDressButton from './AiDressButton.jsx';

const MAP = { name: 'Battle Arena', fileName: 'battle-arena.json', slug: 'battle-arena' };
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
        // draft flag rode through on the merged document.
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ai_dress', action: 'applied', map: 'battle-arena', ops: 1,
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
            }));
            // Apply → close() → the ops mirror wipes (canvas preview vanishes).
            await waitFor(() => expect(onProposalChange).toHaveBeenLastCalledWith(null));
        });
    });
});
