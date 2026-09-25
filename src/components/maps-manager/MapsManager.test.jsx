// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

// Test access to the SSE handler wired into the (mocked) Subscriber component
const subscriberMock = vi.hoisted(() => ({
    props: { handleEvent: null },
}));

// Mock the mapsService
vi.mock('../../services/maps/mapsService.js', () => ({
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

// Mock child components
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
        subscriberMock.props.handleEvent = handleEvent;
        return null;
    },
}));

vi.mock('./GenerateDungeonModal.jsx', () => ({
    default: () => <div data-testid="generate-dungeon-modal" />,
}));

vi.mock('./GenerateTerrainModal.jsx', () => ({
    default: () => <div data-testid="generate-terrain-modal" />,
}));

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
        subscriberMock.props.handleEvent = null;
        mapsService.loadMaps.mockResolvedValue({ maps: [] });
        mapsService.loadMapData.mockResolvedValue({ description: '' });
        props = {
            campaignName: 'test-campaign',
            onOpenMap: vi.fn(),
            onBack: vi.fn(),
        };
    });

    // -----------------------------------------------------------------------
    // Header & Back Button
    // -----------------------------------------------------------------------
    describe('Header & Back Button', () => {
        it('renders the "Maps" heading', () => {
            render(<MapsManager {...props} />);
            expect(screen.getByRole('heading', { name: 'Maps' })).toBeInTheDocument();
        });

        it('calls onBack when the back button is clicked', () => {
            render(<MapsManager {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /back/i }));
            expect(props.onBack).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // Loading & Empty States
    // -----------------------------------------------------------------------
    describe('Loading & Empty States', () => {
        it('shows a loading indicator while maps are being fetched', () => {
            mapsService.loadMaps.mockImplementation(() => new Promise(() => {}));
            render(<MapsManager {...props} />);
            expect(screen.getByText('Loading maps...')).toBeInTheDocument();
        });

        it('shows the empty state when no maps exist', async () => {
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('No maps yet. Create one to get started.')).toBeInTheDocument();
            });
        });

        it('shows an error message when loading maps fails', async () => {
            mapsService.loadMaps.mockRejectedValue(new Error('Network error'));
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument();
            });
        });

        it('shows a generic error message when loading maps fails without a message', async () => {
            mapsService.loadMaps.mockRejectedValue(new Error());
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Failed to load maps')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Create Map Flow
    // -----------------------------------------------------------------------
    describe('Create Map Flow', () => {
        it('creates an indoor map when a name is typed and Create Map is clicked', async () => {
            render(<MapsManager {...props} />);
            fireEvent.change(screen.getByPlaceholderText('New map name...'), { target: { value: 'Dungeon Level 1' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(mapsService.createMap).toHaveBeenCalledWith(
                    'test-campaign',
                    'Dungeon Level 1',
                    { type: 'indoor' }
                );
            });
        });

        it('creates an outdoor map when the outdoor type is selected', async () => {
            render(<MapsManager {...props} />);
            fireEvent.click(screen.getByRole('radio', { name: /outdoor/i }));
            fireEvent.change(screen.getByPlaceholderText('New map name...'), { target: { value: 'Forest Map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(mapsService.createMap).toHaveBeenCalledWith(
                    'test-campaign',
                    'Forest Map',
                    { type: 'outdoor' }
                );
            });
        });

        it('creates a map when Enter is pressed in the create input', async () => {
            render(<MapsManager {...props} />);
            const input = screen.getByPlaceholderText('New map name...');
            fireEvent.change(input, { target: { value: 'My Map' } });
            fireEvent.keyDown(input, { key: 'Enter' });

            await waitFor(() => {
                expect(mapsService.createMap).toHaveBeenCalledWith(
                    'test-campaign',
                    'My Map',
                    { type: 'indoor' }
                );
            });
        });

        it('disables the create button when the name is empty or whitespace-only', () => {
            render(<MapsManager {...props} />);
            const createButton = screen.getByRole('button', { name: 'Create Map' });
            expect(createButton).toBeDisabled();

            fireEvent.change(screen.getByPlaceholderText('New map name...'), { target: { value: '   ' } });
            expect(createButton).toBeDisabled();
        });

        it('shows an error when Enter is pressed with an empty name', () => {
            render(<MapsManager {...props} />);
            fireEvent.keyDown(screen.getByPlaceholderText('New map name...'), { key: 'Enter' });
            expect(screen.getByText('Map name cannot be empty')).toBeInTheDocument();
        });

        it('rejects a duplicate name case-insensitively', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Existing Map' })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Existing Map')).toBeInTheDocument();
            });

            fireEvent.change(screen.getByPlaceholderText('New map name...'), { target: { value: 'existing map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(screen.getByText('A map with that name already exists')).toBeInTheDocument();
            });
            expect(mapsService.createMap).not.toHaveBeenCalled();
        });

        it.each([
            ['Server error', 'Server error'],
            [undefined, 'Failed to create map'],
        ])('shows the error message when map creation fails: %s → %s', async (errorMessage, expectedText) => {
            mapsService.createMap.mockRejectedValue(new Error(errorMessage));
            render(<MapsManager {...props} />);
            fireEvent.change(screen.getByPlaceholderText('New map name...'), { target: { value: 'Bad Map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(screen.getByText(expectedText)).toBeInTheDocument();
            });
        });

        it('clears a previous error when a subsequent create succeeds', async () => {
            mapsService.createMap
                .mockRejectedValueOnce(new Error('Server error'))
                .mockResolvedValueOnce({});
            render(<MapsManager {...props} />);
            const input = screen.getByPlaceholderText('New map name...');
            const createButton = screen.getByRole('button', { name: 'Create Map' });

            fireEvent.change(input, { target: { value: 'Bad Map' } });
            fireEvent.click(createButton);
            await waitFor(() => {
                expect(screen.getByText('Server error')).toBeInTheDocument();
            });

            fireEvent.change(input, { target: { value: 'Good Map' } });
            fireEvent.click(createButton);
            await waitFor(() => {
                expect(screen.queryByText('Server error')).not.toBeInTheDocument();
            });
            expect(mapsService.createMap).toHaveBeenCalledTimes(2);
        });

        it('clears the input and refreshes the list after a successful create', async () => {
            mapsService.loadMaps
                .mockResolvedValueOnce({ maps: [] })
                .mockResolvedValueOnce({ maps: [makeMap({ name: 'Created Map' })] });
            render(<MapsManager {...props} />);
            const input = screen.getByPlaceholderText('New map name...');
            fireEvent.change(input, { target: { value: 'Created Map' } });
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

            await waitFor(() => {
                expect(screen.getByText('Created Map')).toBeInTheDocument();
            });
            expect(input).toHaveValue('');
        });

        it.each([
            ['indoor', 'Generate a dungeon map with rooms, hallways, and doorways'],
            ['outdoor', 'Generate a terrain map with biomes'],
        ])('shows the %s generator button for the selected map type', (mapType, title) => {
            render(<MapsManager {...props} />);
            if (mapType === 'outdoor') {
                fireEvent.click(screen.getByRole('radio', { name: /outdoor/i }));
            }
            expect(screen.getByTitle(title)).toBeInTheDocument();
        });

        it('does not create a map when the create button is disabled', async () => {
            render(<MapsManager {...props} />);
            // Button starts disabled; clicking it should do nothing
            fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));
            expect(mapsService.createMap).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Maps List Rendering
    // -----------------------------------------------------------------------
    describe('Maps List Rendering', () => {
        it('renders maps sorted alphabetically by name', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [
                    makeMap({ fileName: 'map3.json', name: 'Zoo' }),
                    makeMap({ fileName: 'map1.json', name: 'Alpha Cave', isActive: true }),
                    makeMap({ fileName: 'map2.json', name: 'Beta Forest' }),
                ],
            });
            render(<MapsManager {...props} />);

            await waitFor(() => {
                const items = screen.getAllByRole('listitem');
                expect(items).toHaveLength(3);
                expect(items[0]).toHaveTextContent('Alpha Cave');
                expect(items[1]).toHaveTextContent('Beta Forest');
                expect(items[2]).toHaveTextContent('Zoo');
            });
        });

        it.each([
            ['indoor', 'Indoor'],
            ['outdoor', 'Outdoor'],
        ])('renders the %s type badge', async (type, badgeText) => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ type })],
            });
            render(<MapsManager {...props} />);

            await waitFor(() => {
                expect(screen.getByText(badgeText)).toBeInTheDocument();
            });
        });

        it('renders an Active badge for the active map', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Dungeon Level 1', isActive: true })],
            });
            render(<MapsManager {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Active')).toBeInTheDocument();
            });
        });

        it('hides the Activate button for the active map', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Active Map', isActive: true })],
            });
            render(<MapsManager {...props} />);

            await waitFor(() => {
                expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Open Button
    // -----------------------------------------------------------------------
    describe('Open Button', () => {
        it('calls onOpenMap with the correct fileName when Open is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Open' }));
            expect(props.onOpenMap).toHaveBeenCalledWith('dungeon-level-1.json');
        });

        it('calls onOpenMap for every map in the list', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [
                    makeMap({ name: 'Map A', fileName: 'map-a.json' }),
                    makeMap({ name: 'Map B', fileName: 'map-b.json' }),
                ],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Map A')).toBeInTheDocument();
                expect(screen.getByText('Map B')).toBeInTheDocument();
            });

            const openButtons = screen.getAllByRole('button', { name: 'Open' });
            expect(openButtons).toHaveLength(2);

            fireEvent.click(openButtons[0]);
            expect(props.onOpenMap).toHaveBeenCalledWith('map-a.json');

            fireEvent.click(openButtons[1]);
            expect(props.onOpenMap).toHaveBeenCalledWith('map-b.json');
        });
    });

    // -----------------------------------------------------------------------
    // Activate Button
    // -----------------------------------------------------------------------
    describe('Activate Button', () => {
        it('calls activateMap with the campaign and fileName when Activate is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Forest', fileName: 'forest.json', isActive: false })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Forest')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

            await waitFor(() => {
                expect(mapsService.activateMap).toHaveBeenCalledWith('test-campaign', 'forest.json');
            });
        });

        it('shows a generic error message when activation fails without a message', async () => {
            mapsService.activateMap.mockRejectedValue(new Error());
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Forest', fileName: 'forest.json', isActive: false })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Forest')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

            await waitFor(() => {
                expect(screen.getByText('Failed to activate map')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Rename Flow
    // -----------------------------------------------------------------------
    describe('Rename Flow', () => {
        it('shows a rename input when Rename is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            expect(screen.getByDisplayValue('Dungeon Level 1')).toBeInTheDocument();
        });

        it('renames a map when a new name is typed and Enter is pressed', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            const renameInput = screen.getByDisplayValue('Dungeon Level 1');
            fireEvent.change(renameInput, { target: { value: 'Renamed Map' } });
            fireEvent.keyDown(renameInput, { key: 'Enter' });

            await waitFor(() => {
                expect(mapsService.renameMap).toHaveBeenCalledWith(
                    'test-campaign',
                    'dungeon-level-1.json',
                    'Renamed Map'
                );
            });
        });

        it('saves the rename when the input loses focus', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            const renameInput = screen.getByDisplayValue('Dungeon Level 1');
            fireEvent.change(renameInput, { target: { value: 'Renamed Map' } });
            fireEvent.blur(renameInput);

            await waitFor(() => {
                expect(mapsService.renameMap).toHaveBeenCalledWith(
                    'test-campaign',
                    'dungeon-level-1.json',
                    'Renamed Map'
                );
            });
        });

        it('cancels the rename when Escape is pressed', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            const renameInput = screen.getByDisplayValue('Dungeon Level 1');
            fireEvent.keyDown(renameInput, { key: 'Escape' });

            expect(screen.queryByDisplayValue('Dungeon Level 1')).not.toBeInTheDocument();
            expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
        });

        it.each([
            ['Enter', 'keyDown', ''],
            ['Enter', 'keyDown', 'Dungeon Level 1'],
            ['Enter', 'keyDown', '   '],
            ['blur', 'blur', ''],
            ['blur', 'blur', 'Dungeon Level 1'],
            ['blur', 'blur', '   '],
        ])('cancels rename when name is %s via %s', async (triggerType, fireEventFn, newValue) => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            const renameInput = screen.getByDisplayValue('Dungeon Level 1');
            if (newValue !== 'Dungeon Level 1' || fireEventFn === 'blur') {
                fireEvent.change(renameInput, { target: { value: newValue } });
            }
            if (triggerType === 'Enter') {
                fireEvent.keyDown(renameInput, { key: 'Enter' });
            } else {
                fireEvent.blur(renameInput);
            }

            await waitFor(() => {
                expect(mapsService.renameMap).not.toHaveBeenCalled();
            });
        });

        it('rejects a rename to a duplicate name (case-insensitive, kebab-normalized)', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [
                    makeMap({ name: 'Dungeon Level 1' }),
                    makeMap({ name: 'Forest', fileName: 'forest.json' }),
                ],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            const renameButtons = screen.getAllByRole('button', { name: 'Rename' });
            fireEvent.click(renameButtons[0]);

            const renameInput = screen.getByDisplayValue('Dungeon Level 1');
            fireEvent.change(renameInput, { target: { value: 'Forest' } });
            fireEvent.keyDown(renameInput, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getByText('A map with that name already exists')).toBeInTheDocument();
            });
            expect(mapsService.renameMap).not.toHaveBeenCalled();
        });

        it('shows a generic error message when rename fails without a message', async () => {
            mapsService.renameMap.mockRejectedValue(new Error());
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
            const renameInput = screen.getByDisplayValue('Dungeon Level 1');
            fireEvent.change(renameInput, { target: { value: 'New Name' } });
            fireEvent.keyDown(renameInput, { key: 'Enter' });

            await waitFor(() => {
                expect(screen.getByText('Failed to rename map')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Delete Flow
    // -----------------------------------------------------------------------
    describe('Delete Flow', () => {
        it('shows a confirmation modal when Delete is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

            expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();
            expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
        });

        it('calls deleteMap when deletion is confirmed', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
            fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));

            await waitFor(() => {
                expect(mapsService.deleteMap).toHaveBeenCalledWith('test-campaign', 'dungeon-level-1.json');
            });
        });

        it('closes the modal when Cancel is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
            expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('heading', { name: 'Delete Map' })).not.toBeInTheDocument();
        });

        it('keeps the modal open when the overlay is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
            expect(screen.getByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();

            // Click on the overlay (outside the modal content)
            fireEvent.click(screen.getByRole('heading', { name: 'Delete Map' }).closest('.maps-manager-modal-overlay'));
            expect(screen.queryByRole('heading', { name: 'Delete Map' })).toBeInTheDocument();
        });

        it('shows a generic error message when deletion fails without a message', async () => {
            mapsService.deleteMap.mockRejectedValue(new Error());
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
            fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));

            await waitFor(() => {
                expect(screen.getByText('Failed to delete map')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // Edit Description Flow
    // -----------------------------------------------------------------------
    describe('Edit Description Flow', () => {
        it('opens the edit modal when the edit description button is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));

            await waitFor(() => {
                expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
            });
        });

        it('calls updateMapDescription when Save is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Dungeon Level 1', fileName: 'dungeon-level-1.json' })],
            });
            mapsService.loadMapData.mockResolvedValue({ description: 'A dark dungeon.' });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));
            await waitFor(() => {
                expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
            });

            fireEvent.change(screen.getByPlaceholderText(/Describe this map/), { target: { value: 'Updated description.' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mapsService.updateMapDescription).toHaveBeenCalledWith(
                    'test-campaign',
                    'dungeon-level-1.json',
                    'Updated description.'
                );
            });
        });

        it('closes the modal when Cancel is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            mapsService.loadMapData.mockResolvedValue({ description: '' });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));
            await waitFor(() => {
                expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByText(/Edit Description/)).not.toBeInTheDocument();
        });

        it('keeps the modal open when the overlay is clicked', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            mapsService.loadMapData.mockResolvedValue({ description: '' });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));
            await waitFor(() => {
                expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
            });

            // Click on the overlay (outside the modal content)
            const overlay = screen.getByRole('heading', { name: /Edit Description/ }).closest('.maps-manager-modal-overlay');
            fireEvent.click(overlay);
            expect(screen.queryByText(/Edit Description/)).toBeInTheDocument();
        });

        it('shows an error message when loading map data fails', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            mapsService.loadMapData.mockRejectedValue(new Error('Load failed'));
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));

            await waitFor(() => {
                expect(screen.getByText('Load failed')).toBeInTheDocument();
            });
        });

        it('shows a generic error message when loading map data fails without a message', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            mapsService.loadMapData.mockRejectedValue(new Error());
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));

            await waitFor(() => {
                expect(screen.getByText('Failed to load map data')).toBeInTheDocument();
            });
        });

        it('shows a generic error message when saving the description fails without a message', async () => {
            mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Dungeon Level 1' })] });
            mapsService.loadMapData.mockResolvedValue({ description: 'Original description.' });
            mapsService.updateMapDescription.mockRejectedValue(new Error());
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Dungeon Level 1')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTitle('Edit description'));
            await waitFor(() => {
                expect(screen.getByText(/Edit Description/)).toBeInTheDocument();
            });

            fireEvent.change(screen.getByPlaceholderText(/Describe this map/), { target: { value: 'New description.' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(screen.getByText('Failed to save map description')).toBeInTheDocument();
            });
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

            await act(async () => {
                subscriberMock.props.handleEvent({ key: 'maps-list-test-campaign' });
            });

            await waitFor(() => {
                expect(screen.getByText('SSE Added Map')).toBeInTheDocument();
            });
            expect(screen.queryByText('Initial Map')).not.toBeInTheDocument();
        });

        it('updates the active map directly on a map-activate event without re-fetching', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [
                    makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true }),
                    makeMap({ name: 'Forest', fileName: 'forest.json', isActive: false }),
                ],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Cave')).toBeInTheDocument();
            });
            expect(mapsService.loadMaps).toHaveBeenCalledTimes(1);

            await act(async () => {
                subscriberMock.props.handleEvent({
                    key: 'map-activate-test-campaign',
                    data: { activeMap: 'forest' },
                });
            });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Forest');
            expect(mapsService.loadMaps).toHaveBeenCalledTimes(1);
        });

        it('ignores SSE events for other campaigns', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Cave')).toBeInTheDocument();
            });

            await act(async () => {
                subscriberMock.props.handleEvent({
                    key: 'map-activate-other-campaign',
                    data: { activeMap: 'something-else' },
                });
            });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Cave');
        });

        it.each([
            [null, 'null'],
            [{ key: '' }, 'empty key'],
        ])('ignores SSE events with %s key', async (event, _label) => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true })],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Cave')).toBeInTheDocument();
            });

            await act(async () => {
                subscriberMock.props.handleEvent(event);
            });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Cave');
        });

        it('handles a map-activate event with missing data gracefully', async () => {
            mapsService.loadMaps.mockResolvedValue({
                maps: [
                    makeMap({ name: 'Cave', fileName: 'cave.json', isActive: true }),
                    makeMap({ name: 'Forest', fileName: 'forest.json', isActive: false }),
                ],
            });
            render(<MapsManager {...props} />);
            await waitFor(() => {
                expect(screen.getByText('Cave')).toBeInTheDocument();
            });

            // activeMap is undefined, so no map should match and the active map stays the same
            await act(async () => {
                subscriberMock.props.handleEvent({
                    key: 'map-activate-test-campaign',
                });
            });

            expect(screen.getAllByText('Active')).toHaveLength(1);
            expect(screen.getByText('Active').closest('li')).toHaveTextContent('Cave');
        });
    });
});
