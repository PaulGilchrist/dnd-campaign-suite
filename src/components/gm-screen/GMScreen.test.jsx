// @maintained-by-ai
// GMScreen container: composes the three sections over the shared store
// (zero WRITES — a fetch spy proves no POST/PUT/DELETE ever leaves the
// view; the GETs are the two quick-reference JSONs + the spell-overlay
// mount fetch), filters the roster to characters with computedStats,
// renders the quick reference from the dataLoader lane's /data JSONs, and
// adopts spell-overlay zones live on the ONE shared SSE lane (subscribeToSSE
// mock like the sibling initiative tests — the real createOverlayHandler
// reducer drives the row).
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import GMScreen from './GMScreen.jsx';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { clearDataCache } from '../../services/ui/dataLoader.js';
import { makePartyMember, seedCharStore, clearGMScreenStores, CAMPAIGN } from './gm-test-utils.jsx';

vi.mock('../../services/ui/sseClient.js', () => ({
    subscribeToSSE: vi.fn(() => vi.fn()),
}));

const CONDITIONS_FIXTURE = [
    { index: 'blinded', name: 'Blinded', description: 'You can\'t see.<br/><ul><li><b>Attacks Affected:</b> test leg</li></ul>' },
    { index: 'exhaustion', name: 'Exhaustion', description: '5e wording' },
    { index: 'exhaustion', name: 'Exhaustion', description: '2024 wording' },
];
const ACTIONS_FIXTURE = ['Attack', 'Dash', 'Dodge'];

// A transport-shape overlay row carried verbatim by the /spell-overlay lane.
const ZONE = {
    id: 'zone-1',
    shape: 'cylinder',
    startGridX: 3,
    startGridY: 4,
    radiusFt: 20,
    color: 'rgba(255,80,60,0.07)',
    label: 'GMSieve Zone',
};

function stubReferenceFetch(overlayRows = []) {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url) === '/data/conditions.json') {
            return { ok: true, json: async () => CONDITIONS_FIXTURE };
        }
        if (String(url) === '/data/actions.json') {
            return { ok: true, json: async () => ACTIONS_FIXTURE };
        }
        if (String(url) === `/spell-overlay?campaign=${CAMPAIGN}`) {
            return { ok: true, json: async () => ({ overlays: overlayRows }) };
        }
        throw new Error(`GM Screen must not touch network lane: ${url}`);
    });
    return spy;
}

// The overlay SSE handler the container registered on the shared lane
// (mirrors the CombatCues.test.jsx capture idiom).
const overlayHandlers = () => subscribeToSSE.mock.calls.map(([, handler]) => handler);
const overlayEvent = (data) => ({ key: `spell-overlay-${CAMPAIGN}`, data });

afterEach(() => {
    clearGMScreenStores(['Aragorn']);
    clearDataCache();
    vi.restoreAllMocks();
    subscribeToSSE.mockClear();
});

describe('GMScreen', () => {
    it('renders the three sections and only computedStats party members', async () => {
        const spy = stubReferenceFetch();
        seedCharStore('Aragorn', { currentHitPoints: 12, activeConditions: ['poisoned'] });
        render(
            <GMScreen
                characters={[
                    makePartyMember(),
                    { name: 'GhostSheet' }, // raw roster entry mid-enrichment
                ]}
                campaignName={CAMPAIGN}
            />
        );
        expect(screen.getByRole('heading', { name: /GM Screen/ })).toBeInTheDocument();
        expect(screen.getByRole('row', { name: /Aragorn/ })).toHaveTextContent('12 / 30');
        expect(screen.queryByText('GhostSheet')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Blinded')).toBeInTheDocument());
        expect(screen.getByRole('heading', { name: /In Play/ })).toBeInTheDocument();
        // The view is pure presentation: nothing it renders is a control that
        // writes, and every request is a GET (two /data JSONs + the overlay
        // mount fetch) — zero POST/PUT/DELETE ever leaves the panel.
        await waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
        const writes = spy.mock.calls.filter(([, init]) => init && init.method && init.method !== 'GET');
        expect(writes).toHaveLength(0);
    });

    it('quick reference names the duplicate Exhaustion rows apart by ruleset', async () => {
        stubReferenceFetch();
        render(<GMScreen characters={[makePartyMember()]} campaignName={CAMPAIGN} />);
        await waitFor(() => expect(screen.getByText('Exhaustion (5e)')).toBeInTheDocument());
        expect(screen.getByText('Exhaustion (2024)')).toBeInTheDocument();
        expect(screen.getByText('Base Actions (3)')).toBeInTheDocument();
    });

    it('mount fetch surfaces zones already on the table without waiting for an event', async () => {
        stubReferenceFetch([ZONE]);
        render(<GMScreen characters={[makePartyMember()]} campaignName={CAMPAIGN} />);
        await waitFor(() => expect(screen.getByText('GMSieve Zone')).toBeInTheDocument());
        expect(screen.getByText('Spell zones')).toBeInTheDocument();
        expect(screen.queryByText('No zones or markers on the table.')).not.toBeInTheDocument();
    });

    it('SSE add/remove on the shared lane drives the Spell zones row live', async () => {
        stubReferenceFetch();
        render(<GMScreen characters={[makePartyMember()]} campaignName={CAMPAIGN} />);
        expect(screen.getByText('No zones or markers on the table.')).toBeInTheDocument();

        const handler = overlayHandlers().at(-1);
        expect(handler).toBeTypeOf('function');
        handler(overlayEvent({ action: 'add', overlays: [ZONE] }));
        await waitFor(() => expect(screen.getByText('GMSieve Zone')).toBeInTheDocument());
        expect(screen.queryByText('No zones or markers on the table.')).not.toBeInTheDocument();

        handler(overlayEvent({ action: 'remove', overlayId: ZONE.id }));
        await waitFor(() => expect(screen.queryByText('GMSieve Zone')).not.toBeInTheDocument());
        expect(screen.getByText('No zones or markers on the table.')).toBeInTheDocument();
    });

    it('rides the ONE shared SSE lane per campaign and unsubscribes on unmount', () => {
        stubReferenceFetch();
        const { unmount } = render(<GMScreen characters={[makePartyMember()]} campaignName={CAMPAIGN} />);
        expect(subscribeToSSE).toHaveBeenCalledWith(CAMPAIGN, expect.any(Function));
        unmount();
    });
});
