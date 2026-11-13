// @maintained-by-ai: 2026-11-12
// Row-level Regenerate-from-stamped-opts lane (VG backlog 2026-11-12): rows whose doc
// carries generationOpts get an ENABLED `Regenerate "<label>"` button whose title is the
// read-only "Generated with: …" stamp tooltip; legacy docs (no stamp) get an honest
// DISABLED face ("No generation options recorded for this map") — clicking it opens
// nothing and writes nothing. Confirm rides the shared DeleteConfirmModal role="dialog"
// tier with the starter lane's "Yes, Regenerate" label; Cancel closes with zero writes.
// The generator-dispatch / PUT-preservation / audit-row legs live beside the service in
// ../services/maps/regenerateMap.test.js.

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    deactivateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
    saveMapData: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

// Keep the real describeGenerationOpts (tooltip copy is pinned here); stub the write lane.
vi.mock('../../services/maps/regenerateMap.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, regenerateMapDocument: vi.fn() };
});

vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));
vi.mock('./GenerateDungeonModal.jsx', () => ({ default: () => null }));
vi.mock('./GenerateTerrainModal.jsx', () => ({ default: () => null }));
vi.mock('./AiDressButton.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';
import { regenerateMapDocument } from '../../services/maps/regenerateMap.js';

const ADJACENT_OPTS = {
    mode: 'adjacent',
    roomSize: 'standard',
    gridSize: 20,
    density: 0.5,
    seed: 42,
    roomCount: 8,
    corridorLength: 'compact',
    layoutStyle: 'balanced',
    minRoom: 4,
    maxRoom: 9,
};
const ADJACENT_TOOLTIP =
    'Generated with: Mode: Room Adjacent · Seed: 42 · Grid size: 20 · '
    + 'Density: 50% · Room size: Standard · Rooms: 8 · Room bounds: 4-9 · '
    + 'Corridors: Compact · Layout: Balanced';

const GENERATED_MAP = { fileName: 'gen-cave.json', name: 'Gen Cave', type: 'indoor', isActive: false };
const LEGACY_MAP = { fileName: 'battle-arena.json', name: 'Battle Arena', type: 'indoor', isActive: false };

const props = {
    campaignName: 'test-campaign',
    onOpenMap: vi.fn(),
    onMapDeleted: vi.fn(),
};

const regenButton = (name) => screen.getByRole('button', { name: `Regenerate "${name}"` });

beforeEach(() => {
    vi.resetAllMocks();
    mapsService.loadMaps.mockResolvedValue({ maps: [GENERATED_MAP, LEGACY_MAP] });
    mapsService.loadMapData.mockImplementation(async (_campaign, fileName) =>
        fileName === 'gen-cave.json'
            ? { description: '', generationOpts: ADJACENT_OPTS }
            : { description: '' });
    regenerateMapDocument.mockResolvedValue({});
});

async function renderManager() {
    render(<MapsManager {...props} />);
    await waitFor(() => expect(screen.getByText('Gen Cave')).toBeInTheDocument());
}

describe('MapsManager row Regenerate faces', () => {
    it('stamped row: enabled Regenerate with the read-only "Generated with: …" tooltip', async () => {
        await renderManager();
        const button = regenButton('Gen Cave');
        await waitFor(() => expect(button).toHaveAttribute('title', ADJACENT_TOOLTIP));
        expect(button).toBeEnabled();
    });

    it('legacy row: disabled Regenerate with the honest "no options recorded" tooltip', async () => {
        await renderManager();
        const button = regenButton('Battle Arena');
        await waitFor(() => expect(button).toHaveAttribute('title', 'No generation options recorded for this map'));
        expect(button).toBeDisabled();
    });

    it('probe in flight: the button is disabled with the checking face (never a promised affordance)', async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        mapsService.loadMapData.mockReturnValue(gate);
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Gen Cave')).toBeInTheDocument());

        expect(regenButton('Gen Cave')).toBeDisabled();
        expect(regenButton('Gen Cave')).toHaveAttribute('title', 'Checking generation options…');

        release({ description: '', generationOpts: ADJACENT_OPTS });
        await waitFor(() => expect(regenButton('Gen Cave')).toHaveAttribute('title', ADJACENT_TOOLTIP));
    });

    it('clicking the disabled legacy face opens NO dialog and causes ZERO writes', async () => {
        await renderManager();
        const button = regenButton('Battle Arena');
        await waitFor(() => expect(button).toBeDisabled());

        fireEvent.click(button);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(regenerateMapDocument).not.toHaveBeenCalled();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        expect(mapsService.createMap).not.toHaveBeenCalled();
    });

    it('the lazy probes are pure reads — no whole-doc save is ever issued for a face', async () => {
        await renderManager();
        await waitFor(() => expect(regenButton('Gen Cave')).toBeEnabled());
        expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'battle-arena.json');
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });
});

describe('MapsManager Regenerate confirm dialog', () => {
    async function openRegenerateDialog() {
        await renderManager();
        await waitFor(() => expect(regenButton('Gen Cave')).toBeEnabled());
        fireEvent.click(regenButton('Gen Cave'));
        return screen.getByRole('dialog', { name: 'Regenerate Map' });
    }

    it('confirming runs the regenerate service with the STAMPED opts verbatim', async () => {
        const dialog = await openRegenerateDialog();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveTextContent(ADJACENT_TOOLTIP);

        fireEvent.click(screen.getByRole('button', { name: 'Yes, Regenerate' }));
        await waitFor(() => {
            expect(regenerateMapDocument).toHaveBeenCalledWith('test-campaign', 'gen-cave.json', ADJACENT_OPTS);
        });
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Regenerate Map' })).not.toBeInTheDocument());
        // awaited list refresh after the successful lane (delete-lane precedent)
        expect(mapsService.loadMaps).toHaveBeenCalledTimes(2);
    });

    it('Cancel closes the dialog with ZERO writes', async () => {
        const dialog = await openRegenerateDialog();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog', { name: 'Regenerate Map' })).not.toBeInTheDocument();
        expect(regenerateMapDocument).not.toHaveBeenCalled();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('a failed regenerate surfaces the inline banner and never re-opens', async () => {
        regenerateMapDocument.mockRejectedValue(new Error('Failed to save map data'));
        await openRegenerateDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Yes, Regenerate' }));

        await waitFor(() => expect(screen.getByText('Failed to save map data')).toBeInTheDocument());
        expect(screen.queryByRole('dialog', { name: 'Regenerate Map' })).not.toBeInTheDocument();
    });
});
