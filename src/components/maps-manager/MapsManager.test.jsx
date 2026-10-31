// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

// SSE handler captured from the mocked Subscriber, plus stub factories for
// the generator modals. The stubs expose only the container wiring (seed
// name, close, map-created) — generator internals live in the sibling tests.
const mocks = vi.hoisted(() => ({
    handleEvent: null,
    modalStub: (testId) => ({
        default: ({ initialMapName, onClose, onMapCreated }) => (
            <div data-testid={testId}>
                <span data-testid={`${testId}-seed-name`}>{initialMapName}</span>
                <button data-testid={`${testId}-map-created`} onClick={onMapCreated}>created</button>
                <button data-testid={`${testId}-close`} onClick={onClose}>close</button>
            </div>
        ),
    }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    toKebabCase: (name) => name,
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
    default: ({ value, onChange, placeholder }) => (
        <textarea
            data-testid="preview-toggle-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    ),
}));

vi.mock('../common/Subscriber.jsx', () => ({
    default: ({ handleEvent }) => {
        mocks.handleEvent = handleEvent;
        return null;
    },
}));

vi.mock('./GenerateDungeonModal.jsx', () => mocks.modalStub('generate-dungeon-modal'));
vi.mock('./GenerateTerrainModal.jsx', () => mocks.modalStub('generate-terrain-modal'));

import * as mapsService from '../../services/maps/mapsService.js';

const makeMap = (overrides) => ({
    fileName: 'map1.json',
    name: 'Test Map',
    type: 'indoor',
    isActive: false,
    ...overrides,
});

describe('MapsManager', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        mocks.handleEvent = null;
        mapsService.loadMaps.mockResolvedValue({ maps: [] });
        mapsService.loadMapData.mockResolvedValue({ description: '' });
        props = {
            campaignName: 'test-campaign',
            onOpenMap: vi.fn(),
        };
    });

    const createInput = () => screen.getByPlaceholderText('New map name...');
    const selectMapType = () => fireEvent.click(screen.getByRole('radio', { name: /outdoor/i }));
    const emitSSE = (event) => act(async () => { mocks.handleEvent(event); });

    // Render and wait until the given maps appear in the list
    async function renderWithMaps(...maps) {
        mapsService.loadMaps.mockResolvedValue({ maps });
        const result = render(<MapsManager {...props} />);
        if (maps.length > 0) {
            await waitFor(() => expect(screen.getByText(maps[0].name)).toBeInTheDocument());
        }
        return result;
    }

    function startRename(currentName = 'Dungeon Level 1') {
        fireEvent.click(screen.getByRole('button', { name: `Rename "${currentName}"` }));
        return screen.getByDisplayValue(currentName);
    }

    function openDeleteModal(name = 'Dungeon Level 1') {
        fireEvent.click(screen.getByRole('button', { name: `Delete "${name}"` }));
    }

    async function openEditModal() {
        fireEvent.click(screen.getByTitle('Edit description'));
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Edit Description/ })).toBeInTheDocument();
        });
    }

    // -----------------------------------------------------------------------
    // Header, Loading & Empty States
    // -----------------------------------------------------------------------
    describe('Header, Loading & Empty States', () => {
        it('renders the "Maps" heading with no Back button (sidebar is the exit)', () => {
            render(<MapsManager {...props} />);
            expect(screen.getByRole('heading', { name: 'Maps' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
        });

        it('shows a loading indicator while maps are being fetched', () => {
            mapsService.loadMaps.mockImplementation(() => new Promise(() => {}));
            render(<MapsManager {...props} />);
            expect(screen.getByText('Loading maps...')).toBeInTheDocument();
        });

        // Regression (2026-10-28 improve run): the QA probe saw a Maps pane
        // painting NEITHER rows NOR loading NOR empty-state on first view
        // entry. Mount-time frames are locked here: the fetch-pending frame
        // always shows the loading affordance, and resolution paints the
        // rows with no second interaction. (The App-level blank sub-state
        // that could strand the pane with `mapsView.type === 'none'` is
        // pinned in App.map-navigation.test.jsx.)
        it('never paints a blank list area between mount and fetch resolution', async () => {
            let resolveMaps;
            mapsService.loadMaps.mockImplementation(() => new Promise((resolve) => { resolveMaps = resolve; }));
            const { container } = render(<MapsManager {...props} />);

            // Fetch still pending: loading affordance up, zero rows, and no
            // premature empty-state flash.
            expect(container.querySelector('.maps-manager-loading')).toBeInTheDocument();
            expect(container.querySelectorAll('.maps-manager-item')).toHaveLength(0);
            expect(container.querySelector('.maps-manager-empty')).not.toBeInTheDocument();

            await act(async () => {
                resolveMaps({
                    maps: [
                        makeMap({ fileName: 'battle-arena.json', name: 'Battle Arena' }),
                        makeMap({ fileName: 'test-map.json', name: 'Test Map', isActive: true }),
                    ],
                });
            });

            expect(container.querySelectorAll('.maps-manager-item')).toHaveLength(2);
            expect(container.querySelector('.maps-manager-loading')).not.toBeInTheDocument();
            expect(container.querySelector('.maps-manager-empty')).not.toBeInTheDocument();
        });

        it('shows the empty state when no maps exist', async () => {
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('No maps yet. Create one to get started.')).toBeInTheDocument();
            });
        });

        it.each([
            ['Network error', 'Network error'],
            [undefined, 'Failed to load maps'],
        ])('shows the load error for message %o (fallback %s)', (message, expected) => {
            mapsService.loadMaps.mockRejectedValue(new Error(message));
            render(<MapsManager {...props} />);
            return waitFor(() => {
                expect(screen.getByText(expected)).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Create Map Flow
    // -----------------------------------------------------------------------
    describe('Create Map Flow', () => {
        it.each([
            ['indoor', false],
            ['outdoor', true],
        ])('creates a %s map via the create button', async (type, isOutdoor) => {
            render(<MapsManager {...props} />);
            if (isOutdoor) selectMapType();
            fireEvent.change(createInput(), { target: { value: 'New Map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(mapsService.createMap).toHaveBeenCalledWith('test-campaign', 'New Map', { type });
            });
        });

        it('creates a map when Enter is pressed in the create input', async () => {
            render(<MapsManager {...props} />);
            const input = createInput();
            fireEvent.change(input, { target: { value: 'My Map' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() => {
                expect(mapsService.createMap).toHaveBeenCalledWith('test-campaign', 'My Map', { type: 'indoor' });
            });
        });

        it.each(['', '   '])('disables the create button for name %o and ignores clicks', (value) => {
            render(<MapsManager {...props} />);
            fireEvent.change(createInput(), { target: { value } });
            const createButton = screen.getByRole('button', { name: 'Create Map' });
            expect(createButton).toBeDisabled();
            fireEvent.click(createButton);
            expect(mapsService.createMap).not.toHaveBeenCalled();
        });

        it('shows an error when Enter submits an empty name', () => {
            render(<MapsManager {...props} />);
            fireEvent.keyDown(createInput(), { key: 'Enter' });
            expect(screen.getByText('Map name cannot be empty')).toBeInTheDocument();
        });

        it('rejects a duplicate name case-insensitively without calling createMap', async () => {
            await renderWithMaps(makeMap({ name: 'Existing Map' }));
            fireEvent.change(createInput(), { target: { value: 'existing map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(screen.getByText('A map with that name already exists')).toBeInTheDocument();
            });
            expect(mapsService.createMap).not.toHaveBeenCalled();
        });

        it.each([
            ['Server error', 'Server error'],
            [undefined, 'Failed to create map'],
        ])('shows the create error for message %o (fallback %s)', async (message, expected) => {
            mapsService.createMap.mockRejectedValue(new Error(message));
            render(<MapsManager {...props} />);
            fireEvent.change(createInput(), { target: { value: 'Bad Map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(screen.getByText(expected)).toBeInTheDocument();
            });
        });

        it('clears the error and input and refreshes the list after a successful create', async () => {
            mapsService.createMap
                .mockRejectedValueOnce(new Error('Server error'))
                .mockResolvedValueOnce({});
            mapsService.loadMaps
                .mockResolvedValueOnce({ maps: [] })
                .mockResolvedValueOnce({ maps: [makeMap({ name: 'Created Map' })] });
            render(<MapsManager {...props} />);
            const input = createInput();
            const createButton = screen.getByRole('button', { name: 'Create Map' });

            fireEvent.change(input, { target: { value: 'Bad Map' } });
            fireEvent.click(createButton);
            await waitFor(() => {
                expect(screen.getByText('Server error')).toBeInTheDocument();
            });

            fireEvent.change(input, { target: { value: 'Created Map' } });
            fireEvent.click(createButton);
            await waitFor(() => {
                expect(screen.queryByText('Server error')).not.toBeInTheDocument();
                expect(screen.getByText('Created Map')).toBeInTheDocument();
            });
            expect(input).toHaveValue('');
            expect(mapsService.createMap).toHaveBeenCalledTimes(2);
        });
    });

    // -----------------------------------------------------------------------
    // Generator Modal Wiring (internals owned by sibling test files)
    // -----------------------------------------------------------------------
    describe('Generator Modal Wiring', () => {
        it.each([
            ['indoor', 'Generate Dungeon', 'generate-dungeon-modal', false],
            ['outdoor', 'Generate Terrain', 'generate-terrain-modal', true],
        ])('%s generator opens, seeds, refreshes, and closes', async (type, label, testId, isOutdoor) => {
            render(<MapsManager {...props} />);
            if (isOutdoor) selectMapType();
            fireEvent.change(createInput(), { target: { value: 'Seeded Map' } });

            fireEvent.click(screen.getByRole('button', { name: label }));
            expect(screen.getByTestId(testId)).toBeInTheDocument();
            expect(screen.getByTestId(`${testId}-seed-name`)).toHaveTextContent('Seeded Map');

            fireEvent.click(screen.getByTestId(`${testId}-map-created`));
            await waitFor(() => {
                expect(mapsService.loadMaps).toHaveBeenCalledTimes(2);
            });

            fireEvent.click(screen.getByTestId(`${testId}-close`));
            expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Maps List Rendering
    // -----------------------------------------------------------------------
    describe('Maps List Rendering', () => {
        it('renders maps sorted alphabetically by name', async () => {
            await renderWithMaps(
                makeMap({ fileName: 'map3.json', name: 'Zoo' }),
                makeMap({ fileName: 'map1.json', name: 'Alpha Cave' }),
                makeMap({ fileName: 'map2.json', name: 'Beta Forest' }),
            );

            const items = screen.getAllByRole('listitem');
            expect(items).toHaveLength(3);
            expect(items[0]).toHaveTextContent('Alpha Cave');
            expect(items[1]).toHaveTextContent('Beta Forest');
            expect(items[2]).toHaveTextContent('Zoo');
        });

        it.each([
            ['indoor', 'Indoor'],
            ['outdoor', 'Outdoor'],
        ])('renders the %s type badge', async (type, badgeText) => {
            await renderWithMaps(makeMap({ type }));
            expect(screen.getByText(badgeText, { selector: '.map-type-badge' })).toBeInTheDocument();
        });

        it('shows the Active badge and hides Activate only for the active map', async () => {
            await renderWithMaps(
                makeMap({ name: 'Active Map', isActive: true }),
                makeMap({ fileName: 'map2.json', name: 'Inactive Map' }),
            );

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Active Map');
            const activateButtons = screen.getAllByRole('button', { name: /^Activate/ });
            expect(activateButtons).toHaveLength(1);
            expect(activateButtons[0]).toHaveAttribute('aria-label', 'Activate "Inactive Map"');
            expect(activateButtons[0].closest('li')).toHaveTextContent('Inactive Map');
        });

        it('calls onOpenMap with each suffix-free map name plus display name (SSE key match + notice naming)', async () => {
            await renderWithMaps(
                makeMap({ name: 'Map A', fileName: 'map-a.json' }),
                makeMap({ name: 'Map B', fileName: 'map-b.json' }),
            );

            const openButtons = ['Map A', 'Map B'].map(
                name => screen.getByRole('button', { name: `Open "${name}"` }),
            );
            fireEvent.click(openButtons[0]);
            expect(props.onOpenMap).toHaveBeenCalledWith('map-a', 'Map A');
            fireEvent.click(openButtons[1]);
            expect(props.onOpenMap).toHaveBeenCalledWith('map-b', 'Map B');
        });
    });

    // -----------------------------------------------------------------------
    // Activate
    // -----------------------------------------------------------------------
    describe('Activate Button', () => {
        it('calls activateMap and reloads the list', async () => {
            await renderWithMaps(makeMap({ name: 'Forest', fileName: 'forest.json' }));
            fireEvent.click(screen.getByRole('button', { name: 'Activate "Forest"' }));

            await waitFor(() => {
                expect(mapsService.activateMap).toHaveBeenCalledWith('test-campaign', 'forest.json');
                expect(mapsService.loadMaps).toHaveBeenCalledTimes(2);
            });
        });

        it('shows the activation error message', async () => {
            mapsService.activateMap.mockRejectedValue(new Error('Activation failed'));
            await renderWithMaps(makeMap({ name: 'Forest', fileName: 'forest.json' }));
            fireEvent.click(screen.getByRole('button', { name: 'Activate "Forest"' }));

            await waitFor(() => {
                expect(screen.getByText('Activation failed')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Rename Flow
    // -----------------------------------------------------------------------
    describe('Rename Flow', () => {
        const map = () => makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' });

        it.each(['Enter', 'blur'])('saves the rename via %s and closes the input', async (trigger) => {
            await renderWithMaps(map());
            const input = startRename();
            fireEvent.change(input, { target: { value: 'Renamed Map' } });
            if (trigger === 'Enter') {
                fireEvent.keyDown(input, { key: 'Enter' });
            } else {
                fireEvent.blur(input);
            }

            await waitFor(() => {
                expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'dungeon-level-1.json', 'Renamed Map');
            });
            expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
        });

        it('cancels the rename when Escape is pressed', async () => {
            await renderWithMaps(map());
            fireEvent.keyDown(startRename(), { key: 'Escape' });

            expect(screen.queryByDisplayValue('Dungeon Level 1')).not.toBeInTheDocument();
            expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            expect(mapsService.renameMap).not.toHaveBeenCalled();
        });

        it.each([
            ['Enter', ''],
            ['Enter', 'Dungeon Level 1'],
        ])('cancels the rename when %s submits %o', async (trigger, value) => {
            await renderWithMaps(map());
            const input = startRename();
            if (value !== 'Dungeon Level 1') {
                fireEvent.change(input, { target: { value } });
            }
            if (trigger === 'Enter') {
                fireEvent.keyDown(input, { key: 'Enter' });
            } else {
                fireEvent.blur(input);
            }

            expect(mapsService.renameMap).not.toHaveBeenCalled();
            expect(screen.queryByDisplayValue('Dungeon Level 1')).not.toBeInTheDocument();
        });

        it('rejects a rename to a duplicate name (case-insensitive, kebab-normalized)', async () => {
            await renderWithMaps(map(), makeMap({ name: 'Forest', fileName: 'forest.json' }));
            const input = startRename();            fireEvent.change(input, { target: { value: 'forest' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getByText('A map with that name already exists')).toBeInTheDocument();
            });
            expect(mapsService.renameMap).not.toHaveBeenCalled();
        });

        it('shows the default rename error when the service fails', async () => {
            mapsService.renameMap.mockRejectedValue(new Error());
            await renderWithMaps(map());
            const input = startRename();
            fireEvent.change(input, { target: { value: 'New Name' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getByText('Failed to rename map')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Delete Flow
    // -----------------------------------------------------------------------
    describe('Delete Flow', () => {
        it('opens the confirmation modal and closes it on Cancel', async () => {
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            openDeleteModal();
            expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();
            expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('heading', { name: 'Delete Map' })).not.toBeInTheDocument();
        });

        it('keeps the modal open when the overlay is clicked', async () => {
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            openDeleteModal();

            fireEvent.click(screen.getByRole('heading', { name: 'Delete Map' }).closest('.maps-manager-modal-overlay'));
            expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();
        });

        it('calls deleteMap and closes the modal when confirmed', async () => {
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' }));
            openDeleteModal();
            fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));

            await waitFor(() => {
                expect(mapsService.deleteMap).toHaveBeenCalledWith('test-campaign', 'dungeon-level-1.json');
                expect(screen.queryByRole('heading', { name: 'Delete Map' })).not.toBeInTheDocument();
            });
        });

        it('shows the default delete error and closes the modal', async () => {
            mapsService.deleteMap.mockRejectedValue(new Error());
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            openDeleteModal();
            fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));

            await waitFor(() => {
                expect(screen.getByText('Failed to delete map')).toBeInTheDocument();
                expect(screen.queryByRole('heading', { name: 'Delete Map' })).not.toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Edit Description Flow
    // -----------------------------------------------------------------------
    describe('Edit Description Flow', () => {
        it('loads the map data and shows the description prefilled', async () => {
            mapsService.loadMapData.mockResolvedValue({ description: 'A dark dungeon.' });
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            await openEditModal();

            expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'map1.json');
            expect(screen.getByDisplayValue('A dark dungeon.')).toBeInTheDocument();
        });

        it('saves the description and closes the modal', async () => {
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            await openEditModal();

            fireEvent.change(screen.getByPlaceholderText(/Describe this map/), { target: { value: 'Updated description.' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mapsService.updateMapDescription).toHaveBeenCalledWith('test-campaign', 'map1.json', 'Updated description.');
                expect(screen.queryByRole('heading', { name: /Edit Description/ })).not.toBeInTheDocument();
            });
        });

        it('closes the modal on Cancel without saving', async () => {
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            await openEditModal();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('heading', { name: /Edit Description/ })).not.toBeInTheDocument();
            expect(mapsService.updateMapDescription).not.toHaveBeenCalled();
        });

        it('keeps the modal open when the overlay is clicked', async () => {
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            await openEditModal();

            fireEvent.click(screen.getByRole('heading', { name: /Edit Description/ }).closest('.maps-manager-modal-overlay'));
            expect(screen.getByRole('heading', { name: /Edit Description/ })).toBeInTheDocument();
        });

        it('shows the error message when loading map data fails', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Load failed'));
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            fireEvent.click(screen.getByTitle('Edit description'));

            await waitFor(() => {
                expect(screen.getByText('Load failed')).toBeInTheDocument();
            });
        });

        it('shows the default save error and keeps the modal open', async () => {
            mapsService.updateMapDescription.mockRejectedValue(new Error());
            await renderWithMaps(makeMap({ name: 'Dungeon Level 1' }));
            await openEditModal();

            fireEvent.change(screen.getByPlaceholderText(/Describe this map/), { target: { value: 'New description.' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(screen.getByText('Failed to save map description')).toBeInTheDocument();
            });
            expect(screen.getByRole('heading', { name: /Edit Description/ })).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Action aria-labels (a0211afcb party-item precedent: harnesses and
    // screen-readers reach row actions by accessible name, no li-scoping)
    // -----------------------------------------------------------------------
    describe('Action aria-labels', () => {
        it('names every row action after its map while visible rendering is unchanged', async () => {
            const { container } = await renderWithMaps(
                makeMap({ name: 'Battle Arena', fileName: 'battle-arena.json' }),
                makeMap({ fileName: 'cave.json', name: 'Cave', isActive: true }),
            );
            // Acceptance query: zero unlabelled buttons inside the list.
            expect(container.querySelectorAll('.maps-manager-list button:not([aria-label])')).toHaveLength(0);
            // Manager-level buttons reachable by accessible name too.
            expect(screen.getByRole('button', { name: 'Create Map' })).toHaveAttribute('aria-label', 'Create Map');

            const row = screen.getByText('Battle Arena').closest('li');
            const open = within(row).getByRole('button', { name: 'Open "Battle Arena"' });
            within(row).getByRole('button', { name: 'Activate "Battle Arena"' });
            within(row).getByRole('button', { name: 'Rename "Battle Arena"' });
            const desc = within(row).getByRole('button', { name: 'Edit description for "Battle Arena"' });
            const del = within(row).getByRole('button', { name: 'Delete "Battle Arena"' });
            // Sibling consistency (2026-10-25 tooltip-discoverability walk): the pen
            // button carries the same visible word label as Open/Rename/Delete — a
            // hover-only title is not enough for players. title + aria-label remain
            // for the native tooltip and screen readers.
            expect(open.textContent).toBe('Open');
            expect(del.textContent).toBe('Delete');
            expect(desc.textContent.trim()).toBe('Description');
            expect(desc.querySelector('i.fa-solid.fa-pen')).not.toBeNull();
            expect(desc).toHaveAttribute('title', 'Edit description');
            expect(desc).toHaveAttribute('aria-label', 'Edit description for "Battle Arena"');
            // Active row keeps Rename/Delete but never renders Activate.
            const activeRow = screen.getByText('Cave').closest('li');
            within(activeRow).getByRole('button', { name: 'Rename "Cave"' });
            within(activeRow).getByRole('button', { name: 'Delete "Cave"' });
            expect(within(activeRow).queryByRole('button', { name: /^Activate/ })).not.toBeInTheDocument();
        });

        it('role+name clicks still dispatch the same handlers', async () => {
            await renderWithMaps(makeMap({ name: 'Battle Arena', fileName: 'battle-arena.json' }));
            fireEvent.click(screen.getByRole('button', { name: 'Open "Battle Arena"' }));
            expect(props.onOpenMap).toHaveBeenCalledWith('battle-arena', 'Battle Arena');
            fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
            expect(screen.getByDisplayValue('Battle Arena')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // SSE Events
    // -----------------------------------------------------------------------
    describe('SSE Events', () => {
        it('reloads the map list when a maps-list event arrives for this campaign', async () => {
            mapsService.loadMaps
                .mockResolvedValueOnce({ maps: [makeMap({ name: 'Initial Map' })] })
                .mockResolvedValueOnce({ maps: [makeMap({ name: 'SSE Added Map' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Initial Map')).toBeInTheDocument();
            });

            await emitSSE({ key: 'maps-list-test-campaign' });

            await waitFor(() => {
                expect(screen.getByText('SSE Added Map')).toBeInTheDocument();
            });
            expect(screen.queryByText('Initial Map')).not.toBeInTheDocument();
        });

        it('updates the active map directly on a map-activate event without re-fetching', async () => {
            await renderWithMaps(
                makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true }),
                makeMap({ name: 'Forest', fileName: 'forest.json' }),
            );
            expect(mapsService.loadMaps).toHaveBeenCalledTimes(1);

            await emitSSE({ key: 'map-activate-test-campaign', data: { activeMap: 'forest' } });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Forest');
            expect(mapsService.loadMaps).toHaveBeenCalledTimes(1);
        });

        it('ignores events for other campaigns and events with a missing or empty key', async () => {
            await renderWithMaps(makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true }));

            await emitSSE({ key: 'map-activate-other-campaign', data: { activeMap: 'something-else' } });
            await emitSSE(null);
            await emitSSE({ key: '' });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Cave');
        });

        it('handles a map-activate event with missing data gracefully', async () => {
            await renderWithMaps(
                makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true }),
                makeMap({ name: 'Forest', fileName: 'forest.json' }),
            );

            await emitSSE({ key: 'map-activate-test-campaign' });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Cave');
        });
    });
});
