// @maintained-by-ai
// Quick-reference section contract: renders condition mechanical effects from
// /data/conditions.json (sanitized) and the base actions from
// /data/actions.json with the shared tooltip vocabulary; the dataLoader lane
// must fetch each file exactly once per app session (cache, not re-fetch);
// the section is pure presentation over static rules data.
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GMScreenQuickRef from './GMScreenQuickRef.jsx';
import { clearDataCache } from '../../services/ui/dataLoader.js';

const CONDITIONS_FIXTURE = [
    { index: 'blinded', name: 'Blinded', description: 'You can\'t see.<br/><ul><li><b>Attacks Affected:</b> Attack rolls against you have Advantage.</li><script>globalThis.__gmHijacked = 1</script></ul>' },
    { index: 'charmed', name: 'Charmed', description: 'Social leg.' },
];
const ACTIONS_FIXTURE = ['Attack', 'Dodge'];

function stubReferenceFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url) === '/data/conditions.json') return { ok: true, json: async () => CONDITIONS_FIXTURE };
        if (String(url) === '/data/actions.json') return { ok: true, json: async () => ACTIONS_FIXTURE };
        throw new Error(`unexpected fetch: ${url}`);
    });
}

let fetchSpy;
beforeEach(() => {
    clearDataCache();
    fetchSpy = stubReferenceFetch();
});
afterEach(() => {
    clearDataCache();
    vi.restoreAllMocks();
    delete globalThis.__gmHijacked;
});

describe('GMScreenQuickRef', () => {
    it('shows a busy placeholder until the cached data lane resolves', async () => {
        render(<GMScreenQuickRef />);
        expect(screen.getByText('Loading rules reference…')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('Blinded')).toBeInTheDocument());
    });

    it('renders condition mechanical effects with sanitized HTML (script leg dropped)', async () => {
        const { container } = render(<GMScreenQuickRef />);
        await waitFor(() => expect(screen.getByText('Charmed')).toBeInTheDocument());
        const blindedBody = container.querySelector('.gm-ref-item-body');
        expect(blindedBody).toContainHTML('<b>Attacks Affected:</b>');
        expect(container.querySelector('script')).not.toBeInTheDocument();
        expect(globalThis.__gmHijacked).toBeUndefined();
    });

    it('renders every base action with its shared tooltip description, Dodge naming both rulesets', async () => {
        render(<GMScreenQuickRef />);
        await waitFor(() => expect(screen.getByText('Dodge')).toBeInTheDocument());
        const dodgeLine = screen.getByText('Dodge').closest('li');
        expect(dodgeLine.textContent).toContain('advantage on Dexterity saving throws');
        expect(dodgeLine.textContent).toContain('2024:');
        expect(screen.getByText('Attack')).toBeInTheDocument();
    });

    it('fetches each reference file exactly once across repeated mounts (dataLoader cache lane)', async () => {
        const first = render(<GMScreenQuickRef />);
        await waitFor(() => expect(screen.getByText('Blinded')).toBeInTheDocument());
        first.unmount();
        render(<GMScreenQuickRef />);
        await waitFor(() => expect(screen.getByText('Blinded')).toBeInTheDocument());
        const urls = fetchSpy.mock.calls.map(call => String(call[0]));
        expect(urls.filter(u => u === '/data/conditions.json')).toHaveLength(1);
        expect(urls.filter(u => u === '/data/actions.json')).toHaveLength(1);
    });
});
