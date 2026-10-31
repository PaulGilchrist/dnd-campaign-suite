// @maintained-by-ai
// MapsManager.empty-kebab-gate.test.jsx — regression for
// bug-map-name-empty-kebab-undeletable-dotfile (client half).
// Create/rename inputs must inline-reject names that kebab to an empty file
// handle BEFORE hitting the server, and a kebab-collision duplicate (server
// 400 resolved as {alreadyExists:true, error}) must surface the server
// message instead of silently vanishing. Harness mirrors MapsManager.test.jsx.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

vi.mock('../../services/maps/mapsService.js', async (importActual) => ({
    ...await importActual(),
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    loadMapData: vi.fn(),
    updateMapDescription: vi.fn(),
}));

vi.mock('../common/Subscriber.jsx', () => ({ default: () => null }));

import * as mapsService from '../../services/maps/mapsService.js';

const makeMap = (overrides) => ({
    fileName: 'map1.json',
    name: 'Test Map',
    type: 'indoor',
    isActive: false,
    ...overrides,
});

describe('MapsManager — empty-kebab create/rename gate', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        // toKebabCase stays REAL (spread of importActual) — the gate predicate
        // is exactly what shipped for storage keys.
        mapsService.loadMaps.mockResolvedValue({ maps: [] });
        mapsService.createMap.mockResolvedValue({});
        props = { campaignName: 'test-campaign', onOpenMap: vi.fn() };
    });

    const createInput = () => screen.getByPlaceholderText('New map name...');

    it.each(['!!!', '???', '🎲'])('shows the inline gate error for name %s and never calls createMap', async (name) => {
        render(<MapsManager {...props} />);
        fireEvent.change(createInput(), { target: { value: name } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

        await waitFor(() => {
            expect(screen.getByText('Map name must contain letters or numbers')).toBeInTheDocument();
        });
        expect(mapsService.createMap).not.toHaveBeenCalled();
    });

    it('surfaces the server duplicate message when a kebab-collision create resolves alreadyExists', async () => {
        // 'Café' already lives at caf.json; creating 'Caf' passes the
        // display-name dup-check and the empty-kebab gate but collides on the
        // server — the swallowed 400 must surface, not evaporate.
        mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Café', fileName: 'caf.json' })] });
        mapsService.createMap.mockResolvedValue({
            name: 'Caf',
            fileName: 'caf.json',
            alreadyExists: true,
            error: 'A map with this name already exists',
        });
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Café')).toBeInTheDocument());

        fireEvent.change(createInput(), { target: { value: 'Caf' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

        await waitFor(() => {
            expect(screen.getByText('A map with this name already exists')).toBeInTheDocument();
        });
        // The typed name is NOT silently evaporated — input keeps it for editing.
        expect(createInput()).toHaveValue('Caf');
    });

    it('gates a rename to an empty-kebab name without calling renameMap', async () => {
        mapsService.loadMaps.mockResolvedValue({ maps: [makeMap({ name: 'Test Map', fileName: 'test-map.json' })] });
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Test Map')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Rename "Test Map"' }));
        const input = screen.getByDisplayValue('Test Map');
        fireEvent.change(input, { target: { value: '!!!' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => {
            expect(screen.getByText('Map name must contain letters or numbers')).toBeInTheDocument();
        });
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('still creates a normal name and clears the input (happy-path pin)', async () => {
        render(<MapsManager {...props} />);
        fireEvent.change(createInput(), { target: { value: 'QA Fix' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Map' }));

        await waitFor(() => {
            expect(mapsService.createMap).toHaveBeenCalledWith('test-campaign', 'QA Fix', { type: 'indoor' });
        });
        expect(createInput()).toHaveValue('');
        expect(screen.queryByText('Map name must contain letters or numbers')).not.toBeInTheDocument();
    });
});
