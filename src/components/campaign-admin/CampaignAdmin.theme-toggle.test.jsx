// @maintained-by-ai
/**
 * Interaction contract for CampaignAdmin's theme toggle and Back button.
 *
 * CampaignAdmin is a controlled component for both: it delegates clicks to
 * the `toggleTheme` / `onBack` props and owns neither piece of state. Two
 * tests pin that whole contract via observable behavior:
 * - the single toggle presents the correct accessible name + icon per theme,
 *   delegates exactly once per click, keeps callbacks independent, and only
 *   changes presentation when the parent flips the `theme` prop;
 * - Back delegates once, spawns no local modal, and never side-fires the
 *   theme toggle (the toggle's non-interference with Back is asserted there).
 *
 * Deliberately NOT covered here (already covered elsewhere):
 * - static rendering of the header/Back/Appearance-section chrome
 *   → CampaignAdmin.rendering.test.jsx
 * - app-level toggle cycles, data-theme attribute, localStorage persistence
 *   → src/App.state-transitions.test.jsx (via MockCampaignAdmin, whose own
 *   wiring is pinned in src/test/mockComponents.test.jsx)
 * - rename / delete / data-management / backup-restore flows → sibling files
 *
 * fetch and EventSource are inert globally (src/test/setup.js), so no test
 * here can reach a live server; every campaign name used is a test-campaign
 * variant.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const renderAdmin = (overrides = {}) => {
    const props = createDefaultProps(overrides);
    const utils = render(<CampaignAdmin {...props} />);
    return { props, ...utils };
};

describe('CampaignAdmin - Theme Toggle', () => {
    it('presents the correct toggle per theme, delegates once, and stays controlled by the theme prop', () => {
        const { props, rerender } = renderAdmin({ theme: 'dark' });

        // Dark mode: getByRole fails on zero OR multiple matches — exactly
        // one toggle, whose icon affordance matches its label.
        const btn = screen.getByRole('button', { name: 'Switch to Light Mode' });
        expect(btn.querySelector('i.fa-sun')).toBeInTheDocument();

        // One click delegates exactly once and Back stays untouched
        // (callbacks are independent).
        fireEvent.click(btn);
        expect(props.toggleTheme).toHaveBeenCalledTimes(1);
        expect(props.onBack).not.toHaveBeenCalled();

        // The component owns no theme state: until the parent re-renders
        // with a new theme, the UI still offers Light...
        expect(screen.getByRole('button', { name: 'Switch to Light Mode' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Switch to Dark Mode' })).not.toBeInTheDocument();

        // ...and when the parent flips the prop, the toggle follows with the
        // mirrored label and icon — without re-triggering the callback.
        rerender(<CampaignAdmin {...props} theme="light" />);
        const lightBtn = screen.getByRole('button', { name: 'Switch to Dark Mode' });
        expect(lightBtn.querySelector('i.fa-moon')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Switch to Light Mode' })).not.toBeInTheDocument();
        expect(props.toggleTheme).toHaveBeenCalledTimes(1);
    });
});

describe('CampaignAdmin - Back Button', () => {
    it('delegates to onBack exactly once without side-firing the theme toggle or opening a modal', () => {
        const { props, container } = renderAdmin();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(props.onBack).toHaveBeenCalledTimes(1);
        // Navigation is delegated to the parent — Back must not have theme
        // side effects or spawn local UI.
        expect(props.toggleTheme).not.toHaveBeenCalled();
        expect(container.querySelectorAll('.ct-modal-overlay')).toHaveLength(0);
    });
});
