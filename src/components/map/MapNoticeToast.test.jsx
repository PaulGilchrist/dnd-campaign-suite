// @maintained-by-ai
// MapNoticeToast presentational pins (backlog map-fresh-fallback-silent): the
// indoor rejected-load notice renders in the shared .map-toast slot as a
// polite live region naming the dead map; a null message renders nothing
// (success/create lanes stay invisible). Loader-lane selection is owned by
// hooks/useMapLoader.rejected-load.test.js.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapNoticeToast from './MapNoticeToast.jsx';
import { buildMapLoadRejectedNotice } from '../../services/maps/mapLoadNotice.js';

const OA_ADVISORY = 'DraconicDragon reacts — Winged Kobold left their reach. Reaction spent; Resolve the Opportunity Attack on DraconicDragon\'s sheet.';

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

    it('non-sticky notice renders no dismiss control (timer lane stays byte-identical)', () => {
        const { container } = render(
            <MapNoticeToast message={buildMapLoadRejectedNotice('qa-room-dead')} sticky={false} onDismiss={() => {}} />
        );
        expect(container.querySelector('.map-toast-sticky')).toBeNull();
        expect(container.querySelector('.map-toast-dismiss')).toBeNull();
    });

    // Backlog 2026-11-03 CN: OA enforcement advisories are sticky-until-dismiss
    // — the toast must carry a VISIBLE dismiss control for them.
    it('sticky enforcement notice keeps .map-toast + role=status and adds a visible dismiss ×', () => {
        const { container } = render(<MapNoticeToast message={OA_ADVISORY} sticky onDismiss={() => {}} />);
        const toast = container.querySelector('.map-toast');
        expect(toast).toBeTruthy();
        expect(toast).toHaveClass('map-toast-sticky');
        expect(toast).toHaveAttribute('role', 'status');
        expect(toast).toHaveTextContent(OA_ADVISORY);
        expect(container.querySelector('.fa-triangle-exclamation')).toBeTruthy();
        const dismiss = container.querySelector('button.map-toast-dismiss');
        expect(dismiss).toBeTruthy();
        expect(dismiss.querySelector('.fa-xmark')).toBeTruthy();
    });

    it('clicking the sticky dismiss control invokes onDismiss', () => {
        const onDismiss = vi.fn();
        const { container } = render(<MapNoticeToast message={OA_ADVISORY} sticky onDismiss={onDismiss} />);
        fireEvent.click(container.querySelector('button.map-toast-dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
