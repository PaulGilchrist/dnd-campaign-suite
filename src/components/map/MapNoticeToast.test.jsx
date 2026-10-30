// @maintained-by-ai
// MapNoticeToast presentational pins (backlog map-fresh-fallback-silent): the
// indoor rejected-load notice renders in the shared .map-toast slot as a
// polite live region naming the dead map; a null message renders nothing
// (success/create lanes stay invisible). Loader-lane selection is owned by
// hooks/useMapLoader.rejected-load.test.js.
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MapNoticeToast from './MapNoticeToast.jsx';
import { buildMapLoadRejectedNotice } from '../../services/maps/mapLoadNotice.js';

describe('MapNoticeToast', () => {
    it('renders nothing when there is no message', () => {
        const { container } = render(<MapNoticeToast message={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a polite live-region status naming the dead map + fresh copy', () => {
        const { container } = render(<MapNoticeToast message={buildMapLoadRejectedNotice('qa-room-dead')} />);
        const toast = container.querySelector('.map-toast');
        expect(toast).toBeTruthy();
        expect(toast).toHaveAttribute('role', 'status');
        expect(toast).toHaveTextContent('Could not load "qa-room-dead" — opened a fresh copy');
        expect(container.querySelector('.fa-triangle-exclamation')).toBeTruthy();
    });
});
