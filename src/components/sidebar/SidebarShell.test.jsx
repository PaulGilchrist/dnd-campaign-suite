// @maintained-by-ai
// SidebarShell gate: renders the sidebar normally, renders nothing while the
// Initiative tracker broadcasts TV mode (the shell then reclaims the 180px
// gutter via the .app-body:not(:has(.sidebar)) CSS rule).
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import SidebarShell from './SidebarShell.jsx';
import { setTvModeActive } from '../../services/ui/tvModeStore.js';

// Real Sidebar pulls the whole campaign graph — the gate contract only needs
// to know whether Sidebar renders AT ALL.
vi.mock('./Sidebar.jsx', () => ({
    default: () => <div data-testid="sidebar" />,
}));

describe('SidebarShell', () => {
    afterEach(() => {
        setTvModeActive(false);
    });

    it('renders the sidebar while TV mode is off', () => {
        render(<SidebarShell />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('hides the sidebar while the tracker broadcasts TV mode', () => {
        const { rerender } = render(<SidebarShell />);
        // useSyncExternalStore re-renders the shell when the store notifies.
        act(() => { setTvModeActive(true); });
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();

        act(() => { setTvModeActive(false); });
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        rerender(<SidebarShell />);
    });
});
