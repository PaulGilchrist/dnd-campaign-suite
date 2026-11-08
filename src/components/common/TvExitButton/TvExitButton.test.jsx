// @maintained-by-ai
// TvExitButton (QA backlog 2026-11-08 TV escape hatch): mounts ONLY while the
// per-client TV pref (localStorage `initiative-tv`) is ON, re-arms reactively
// when the pref flips from ANY side (in-tracker toggle via saveTvPref or this
// button's own exit), and click exits through the shared store seam — pref
// persists OFF. Pure store component: no network, no game state.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import TvExitButton from './TvExitButton.jsx';
import { getTvPref, saveTvPref } from '../../../services/ui/tvModeStore.js';

describe('TvExitButton', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        saveTvPref(false);
        localStorage.clear();
    });

    it('renders nothing while the TV pref is OFF (default and explicit 0)', () => {
        const { unmount } = render(<TvExitButton />);
        expect(screen.queryByRole('button', { name: /exit tv/i })).not.toBeInTheDocument();
        unmount();

        localStorage.setItem('initiative-tv', '0');
        render(<TvExitButton />);
        expect(screen.queryByRole('button', { name: /exit tv/i })).not.toBeInTheDocument();
    });

    it('mounts on the persisted pref with an accessible name (cold-load escape)', () => {
        localStorage.setItem('initiative-tv', '1');
        render(<TvExitButton />);
        const button = screen.getByRole('button', { name: 'Exit TV mode' });
        expect(button).toHaveAttribute('title', 'Exit TV presentation mode');
    });

    it('click exits immediately: pref persists OFF and the button unmounts', () => {
        localStorage.setItem('initiative-tv', '1');
        render(<TvExitButton />);

        fireEvent.click(screen.getByRole('button', { name: 'Exit TV mode' }));

        expect(localStorage.getItem('initiative-tv')).toBe('0');
        expect(getTvPref()).toBe(false);
        expect(screen.queryByRole('button', { name: /exit tv/i })).not.toBeInTheDocument();
    });

    it('stays cross-component in sync: re-arms when the pref flips ON elsewhere', () => {
        render(<TvExitButton />);
        expect(screen.queryByRole('button', { name: /exit tv/i })).not.toBeInTheDocument();

        // The in-tracker toggle's ON lane persists through saveTvPref.
        act(() => { saveTvPref(true); });
        expect(screen.getByRole('button', { name: 'Exit TV mode' })).toBeInTheDocument();

        // And the OFF lane retires it again without this component clicking.
        act(() => { saveTvPref(false); });
        expect(screen.queryByRole('button', { name: /exit tv/i })).not.toBeInTheDocument();
    });
});
