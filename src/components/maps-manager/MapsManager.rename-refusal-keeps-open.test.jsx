// @maintained-by-ai 2026-11-26
// MapsManager.rename-refusal-keeps-open.test.jsx — backlog 2026-11-26: a
// duplicate-name or non-kebab rename commit used to CLOSE the inline editor,
// so the banner ("A map with that name already exists" /
// "Map name must contain letters or numbers") only appeared AFTER the row had
// reverted and the typed value was gone. The app's own refused-edit idiom is
// the hex POI rename lane (handleRenamePoi returns false, editor stays open
// with the pending text) — the maps-manager gate branches now mirror it:
// refused commits keep the editor armed, preserve value + focus, show the
// inline banner, and write nothing. Enter and Confirm refuse identically;
// blank/same-name silent closes and the Cancel/Escape/blur revert lanes are
// untouched. Harness mirrors MapsManager.rename-sibling-lock.test.jsx.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MapsManager from './MapsManager.jsx';

const LOCK_TITLE = 'Rename editor open on another row — confirm or cancel that rename first';
const DUP_COPY = 'A map with that name already exists';
const KEBAB_COPY = 'Map name must contain letters or numbers';

vi.mock('../../services/maps/mapsService.js', async (importActual) => ({
    ...await importActual(),
    loadMaps: vi.fn(),
    createMap: vi.fn(),
    deleteMap: vi.fn(),
    renameMap: vi.fn(),
    activateMap: vi.fn(),
    deactivateMap: vi.fn(),
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

const twoMaps = () => [
    makeMap({ fileName: 'battle-arena.json', name: 'Battle Arena' }),
    makeMap({ fileName: 'test-map.json', name: 'Test Map' }),
];

const armedInput = () => screen.getByPlaceholderText('Rename to…');

const rowOf = (name) => screen.getByText(name).closest('li');
const armedRow = () => armedInput().closest('li');

/** Every action button in a row except the ones whose accessible name is in
 *  `except` (used to skip the armed row's Confirm/Cancel pair). */
const actionButtonsOf = (name, except = []) =>
    Array.from(rowOf(name).querySelectorAll('.maps-manager-item-actions button'))
        .filter(b => !except.includes(b.getAttribute('aria-label')));

describe('MapsManager — refused rename commits keep the editor open with the pending value', () => {
    let props;

    beforeEach(() => {
        vi.resetAllMocks();
        mapsService.loadMaps.mockResolvedValue({ maps: twoMaps() });
        mapsService.renameMap.mockResolvedValue({});
        props = { campaignName: 'test-campaign', onOpenMap: vi.fn() };
    });

    const mount = async () => {
        render(<MapsManager {...props} />);
        await waitFor(() => expect(screen.getByText('Battle Arena')).toBeInTheDocument());
    };

    const armRename = async (name = 'Battle Arena') => {
        await mount();
        fireEvent.click(screen.getByRole('button', { name: `Rename "${name}"` }));
        const input = armedInput();
        input.focus(); // jsdom does not honor autoFocus; pin focus explicitly
        return input;
    };

    it('duplicate commit via Enter is REFUSED: editor open, value and focus intact, banner shown, zero writes (criteria 1 + 3)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => expect(screen.getByText(DUP_COPY)).toBeInTheDocument());
        // The SAME input is still mounted, holding the rejected text, focused.
        expect(armedInput()).toBe(input);
        expect(input).toHaveValue('Test Map');
        expect(document.activeElement).toBe(input);
        // Refused, not committed: the row still displays its OLD name (the
        // armed editor's accessible name and the sibling controls all name
        // 'Battle Arena'), and no rename request ever hit the service.
        expect(input).toHaveAccessibleName('New name for "Battle Arena"');
        expect(screen.getByText('Test Map')).toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('duplicate commit via the Confirm button refuses identically, and its mousedown keeps focus off the blur lane (criterion 1)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Test Map' } });
        const confirm = screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' });

        // onMouseDown preventDefault is what keeps the blur-revert from
        // tearing the editor down under the click (live probe law).
        expect(fireEvent.mouseDown(confirm)).toBe(false);
        fireEvent.click(confirm);

        await waitFor(() => expect(screen.getByText(DUP_COPY)).toBeInTheDocument());
        expect(armedInput()).toHaveValue('Test Map');
        expect(document.activeElement).toBe(input);
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('non-kebab commit is REFUSED the same way through Enter and Confirm (criterion 2)', async () => {
        const input = await armRename();

        // Enter lane.
        fireEvent.change(input, { target: { value: '!!!' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText(KEBAB_COPY)).toBeInTheDocument());
        expect(armedInput()).toHaveValue('!!!');
        expect(mapsService.renameMap).not.toHaveBeenCalled();

        // Confirm lane refuses on a different junk value too.
        fireEvent.change(input, { target: { value: '???' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' }));
        await waitFor(() => expect(screen.getByText(KEBAB_COPY)).toBeInTheDocument());
        expect(armedInput()).toHaveValue('???');
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('sibling lock census holds while a refused edit stays armed (criterion 6)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText(DUP_COPY)).toBeInTheDocument());

        // The armed row keeps its highlight and live Confirm/Cancel; every
        // sibling stays dimmed with disabled, cause-titled buttons.
        expect(armedRow().className).toContain('renaming');
        expect(armedRow().className).not.toContain('rename-locked');
        expect(rowOf('Test Map').className).toContain('rename-locked');
        const buttons = actionButtonsOf('Test Map');
        expect(buttons.length).toBeGreaterThanOrEqual(6);
        for (const b of buttons) {
            expect(b.disabled).toBe(true);
            expect(b.getAttribute('title')).toBe(LOCK_TITLE);
        }
        expect(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Cancel rename for "Battle Arena"' })).toBeEnabled();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });

    it('fix-in-place: after a refusal, a valid unique name commits via Confirm with exactly one write and a closed editor (criterion 4)', async () => {
        const input = await armRename();
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText(DUP_COPY)).toBeInTheDocument());

        fireEvent.change(input, { target: { value: 'Renamed Arena' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm rename for "Battle Arena"' }));

        await waitFor(() =>
            expect(mapsService.renameMap).toHaveBeenCalledWith('test-campaign', 'battle-arena.json', 'Renamed Arena'));
        expect(mapsService.renameMap).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rename "Battle Arena"' })).toBeInTheDocument();
    });

    it('close lanes unchanged from a refusal: blank and same-name commits still silently close, zero writes (criterion 5)', async () => {
        const input = await armRename();

        // Dup refusal arms the banner...
        fireEvent.change(input, { target: { value: 'Test Map' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText(DUP_COPY)).toBeInTheDocument());

        // ...a blank commit is still the silent cancel: closes, drops the
        // banner, writes nothing.
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument();
        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();

        // Same-name commit: silent close again.
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Battle Arena"' }));
        const fresh = armedInput();
        fireEvent.keyDown(fresh, { key: 'Enter' });
        await waitFor(() => expect(screen.queryByPlaceholderText('Rename to…')).not.toBeInTheDocument());
        expect(screen.queryByText(DUP_COPY)).not.toBeInTheDocument();
        expect(mapsService.renameMap).not.toHaveBeenCalled();
    });
});
