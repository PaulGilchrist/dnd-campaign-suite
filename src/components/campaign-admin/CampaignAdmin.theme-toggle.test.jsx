// @improved-by-ai
/**
 * Interaction contract for CampaignAdmin's theme toggle and Back button.
 *
 * CampaignAdmin is a controlled component for both: it delegates clicks to
 * the `toggleTheme` / `onBack` props and owns neither piece of state. So
 * these tests pin the prop-callback contract (exact accessible names, one
 * call per click, callbacks kept independent, no self-mutation of the
 * presented theme) instead of re-testing rendered chrome.
 *
 * Deliberately NOT covered here (already covered elsewhere):
 * - static rendering of the header/Back/toggle labels → CampaignAdmin.rendering.test.jsx
 * - full toggle cycles, data-theme attribute, localStorage persistence, and
 *   restore-on-mount → src/App.state-transitions.test.jsx (app level, mock admin)
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

// One entry per theme: the exact accessible name and icon affordance the
// single theme-toggle button must present in that mode.
const TOGGLE_CASES = [
    { theme: 'dark', label: 'Switch to Light Mode', icon: 'fa-sun' },
    { theme: 'light', label: 'Switch to Dark Mode', icon: 'fa-moon' },
];

describe('CampaignAdmin - Theme Toggle', () => {
    it.each(TOGGLE_CASES)(
        'in $theme mode offers exactly one $label toggle with its $icon icon',
        ({ theme, label, icon }) => {
            const { getByRole } = renderAdmin({ theme });
            // getByRole fails on zero OR multiple matches — exactly one toggle.
            const btn = getByRole('button', { name: label });
            // Visual affordance must match the label (guards an icon swap).
            expect(btn.querySelector(`i.${icon}`)).toBeInTheDocument();
        }
    );

    it.each(TOGGLE_CASES)(
        'delegates to toggleTheme exactly once per click in $theme mode',
        ({ theme, label }) => {
            const { props } = renderAdmin({ theme });
            fireEvent.click(screen.getByRole('button', { name: label }));
            expect(props.toggleTheme).toHaveBeenCalledTimes(1);
        }
    );

    it('stays controlled — presentation changes only when the parent updates the theme prop', () => {
        const { props, rerender } = renderAdmin({ theme: 'dark' });
        fireEvent.click(screen.getByRole('button', { name: 'Switch to Light Mode' }));

        // The component owns no theme state: until the parent re-renders with
        // a new theme, the UI must still offer Light and the callback must
        // have fired exactly once (no re-trigger on re-render).
        expect(screen.getByRole('button', { name: 'Switch to Light Mode' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Switch to Dark Mode' })).not.toBeInTheDocument();
        expect(props.toggleTheme).toHaveBeenCalledTimes(1);

        // When the parent flips the prop, the toggle follows.
        rerender(<CampaignAdmin {...props} theme="light" />);
        expect(screen.getByRole('button', { name: 'Switch to Dark Mode' })).toBeInTheDocument();
        expect(props.toggleTheme).toHaveBeenCalledTimes(1);
    });
});

describe('CampaignAdmin - Back Button', () => {
    it('calls onBack exactly once per click without opening a modal', () => {
        const { props, container } = renderAdmin();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(props.onBack).toHaveBeenCalledTimes(1);
        // Navigation is delegated to the parent — Back must not spawn local UI.
        expect(container.querySelectorAll('.ct-modal-overlay')).toHaveLength(0);
    });

    it('keeps Back and theme-toggle callbacks independent', () => {
        const { props } = renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(props.onBack).toHaveBeenCalledTimes(1);
        expect(props.toggleTheme).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Switch to Light Mode' }));
        expect(props.toggleTheme).toHaveBeenCalledTimes(1);
        expect(props.onBack).toHaveBeenCalledTimes(1);
    });
});
