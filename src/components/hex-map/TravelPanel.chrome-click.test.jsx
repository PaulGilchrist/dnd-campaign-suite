// @maintained-by-ai
// Panel chrome-click feedback lane (backlog 2026-11-11 JU): the floating
// TravelPanel overlaps the grid's lower-left and silently absorbed
// destination clicks. While HexMap flags the panel as awaiting a destination
// (planning, no armed hex), a dead pointerup on NON-control chrome routes to
// onNoDestinationClick (HexMap wires it to the shared .travel-toast lane —
// pinned by HexMap.chrome-toast.test.jsx). Interactive controls (<button>)
// keep their own action and stay silent; traveling/paused chrome (prop false)
// stays silent; a header drag (panel move) is not a dead click.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelPanel from './TravelPanel.jsx';

// JSDOM PointerEvent polyfill (same lane as HexMap.arrival-toast.test.jsx).
if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) {
            super(type, init);
            this.pointerId = init.pointerId || 0;
            this.pointerType = init.pointerType || 'mouse';
        }
    };
}

// Minimal planning-face props (#771 fresh spies per test): empty path = the
// awaiting-destination face; the flag itself is HexMap's judgment, owned
// upstream and not re-tested here.
const makeProps = (overrides = {}) => ({
    travelPace: 'normal',
    path: [],
    pathIndex: 0,
    accruedCost: 0,
    dailyBudget: 4,
    dayExhausted: false,
    lastMessage: null,
    hexesRemaining: 0,
    isTravelActive: true,
    pendingEvent: null,
    terrain: {},
    eventFrequency: 'none',
    showOwnHexHint: false,
    awaitingDestination: true,
    onNoDestinationClick: vi.fn(),
    onChangePace: vi.fn(),
    onAdvance: vi.fn(),
    onCancel: vi.fn(),
    onForceCamp: vi.fn(),
    onForcedMarch: vi.fn(),
    weather: { icon: 'sun', label: 'Clear', description: 'Clear skies', moveCostMod: 1 },
    onReRollWeather: vi.fn(),
    onSetEventFrequency: vi.fn(),
    horseback: false,
    onToggleHorseback: vi.fn(),
    forcedMarchHours: 0,
    exhaustionMultiplier: 100,
    partyHasMaxExhaustion: false,
    ...overrides,
});

const renderPanel = (overrides = {}) => {
    const props = makeProps(overrides);
    const utils = render(<TravelPanel {...props} />);
    return { props, ...utils };
};

const pointerUpOn = (node, init = {}) => fireEvent.pointerUp(node, init);

describe('TravelPanel chrome-click feedback', () => {
    it('routes a dead pointerup on the title-bar chrome while awaiting a destination', () => {
        const { props } = renderPanel();
        pointerUpOn(screen.getByText('Travel Mode'));
        expect(props.onNoDestinationClick).toHaveBeenCalledTimes(1);
    });

    it('routes pointerups on the panel padding and decorative sections', () => {
        const { props } = renderPanel();
        const panel = document.querySelector('.travel-panel');
        pointerUpOn(panel);
        pointerUpOn(document.querySelector('.travel-panel-stats'));
        pointerUpOn(document.querySelector('.travel-panel-label'));
        expect(props.onNoDestinationClick).toHaveBeenCalledTimes(3);
    });

    it('stays silent for interactive controls — and they still perform their action', () => {
        const { props } = renderPanel({
            path: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
            eventFrequency: 'none',
        });
        const control = (selector) => {
            const node = document.querySelector(selector);
            pointerUpOn(node);
            fireEvent.click(node);
        };
        control('.travel-panel-close');
        control('.travel-pace-btn');
        control('.travel-frequency-btn');
        control('.travel-horseback-btn');
        control('.travel-weather-reroll');
        control('.travel-btn-advance');
        control('.travel-btn-cancel');
        expect(props.onNoDestinationClick).not.toHaveBeenCalled();
        expect(props.onCancel).toHaveBeenCalledTimes(2);
        expect(props.onChangePace).toHaveBeenCalledWith('slow');
        expect(props.onSetEventFrequency).toHaveBeenCalledTimes(1);
        expect(props.onToggleHorseback).toHaveBeenCalledTimes(1);
        expect(props.onReRollWeather).toHaveBeenCalledTimes(1);
        expect(props.onAdvance).toHaveBeenCalledTimes(1);
    });

    it('stays silent when chrome is clicked outside planning (awaitingDestination false)', () => {
        const { props } = renderPanel({
            awaitingDestination: false,
            path: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
            pathIndex: 1,
        });
        pointerUpOn(screen.getByText('Travel Mode'));
        pointerUpOn(document.querySelector('.travel-panel'));
        expect(props.onNoDestinationClick).not.toHaveBeenCalled();
    });

    it('ignores non-left pointer buttons on chrome', () => {
        const { props } = renderPanel();
        pointerUpOn(document.querySelector('.travel-panel'), { button: 2 });
        expect(props.onNoDestinationClick).not.toHaveBeenCalled();
    });

    it('a header drag MOVES the panel and is not a dead click; a later chrome click still answers', () => {
        const { props } = renderPanel();
        const header = document.querySelector('.travel-panel-header');
        const panel = document.querySelector('.travel-panel');
        fireEvent.pointerDown(header, { clientX: 0, clientY: 0 });
        fireEvent.pointerMove(document, { clientX: 60, clientY: -30 });
        pointerUpOn(panel); // release over the panel after the move
        expect(props.onNoDestinationClick).not.toHaveBeenCalled();
        expect(panel.style.left).toBe('60px');
        expect(panel.style.top).toBe('-30px');
        // The move latch clears with the drag — a subsequent deliberate
        // dead click on chrome gets its feedback again.
        pointerUpOn(screen.getByText('Travel Mode'));
        expect(props.onNoDestinationClick).toHaveBeenCalledTimes(1);
    });
});
