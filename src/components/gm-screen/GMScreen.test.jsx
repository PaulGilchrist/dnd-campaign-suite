// @maintained-by-ai
// GMScreen container: composes the three sections over the shared store
// (zero writes — a fetch spy proves no POST/PUT/DELETE ever leaves the
// view), filters the roster to characters with computedStats, and renders
// the quick reference from the dataLoader lane's /data JSONs.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import GMScreen from './GMScreen.jsx';
import { clearDataCache } from '../../services/ui/dataLoader.js';
import { makePartyMember, seedCharStore, clearGMScreenStores, CAMPAIGN } from './gm-test-utils.jsx';

const CONDITIONS_FIXTURE = [
    { index: 'blinded', name: 'Blinded', description: 'You can\'t see.<br/><ul><li><b>Attacks Affected:</b> test leg</li></ul>' },
    { index: 'exhaustion', name: 'Exhaustion', description: '5e wording' },
    { index: 'exhaustion', name: 'Exhaustion', description: '2024 wording' },
];
const ACTIONS_FIXTURE = ['Attack', 'Dash', 'Dodge'];

function stubReferenceFetch() {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url) === '/data/conditions.json') {
            return { ok: true, json: async () => CONDITIONS_FIXTURE };
        }
        if (String(url) === '/data/actions.json') {
            return { ok: true, json: async () => ACTIONS_FIXTURE };
        }
        throw new Error(`GM Screen must not touch network lane: ${url}`);
    });
    return spy;
}

afterEach(() => {
    clearGMScreenStores(['Aragorn']);
    clearDataCache();
    vi.restoreAllMocks();
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
        // writes, and no request other than the two GETs was made.
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('quick reference names the duplicate Exhaustion rows apart by ruleset', async () => {
        stubReferenceFetch();
        render(<GMScreen characters={[makePartyMember()]} campaignName={CAMPAIGN} />);
        await waitFor(() => expect(screen.getByText('Exhaustion (5e)')).toBeInTheDocument());
        expect(screen.getByText('Exhaustion (2024)')).toBeInTheDocument();
        expect(screen.getByText('Base Actions (3)')).toBeInTheDocument();
    });
});
