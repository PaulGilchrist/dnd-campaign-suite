// @improved-by-ai
/**
 * L5-001 — EnforcementSection behavior: master switch label/state, sub-flag
 * gating (disabled until enforcement is ON), merged writes through the
 * synced-store boundary, and rendering of saved (possibly partial or null)
 * server state via ENFORCEMENT_DEFAULTS.
 *
 * No sibling test file covers these interactions: CampaignAdmin.rendering
 * only asserts this console is mounted; SessionSection and AiRefereeSection
 * test their own components.
 *
 * useSyncedState is stubbed with a stateful stand-in (real useState so the
 * UI re-renders on write, plus a recorded write log) — the server/SSE
 * round-trip itself is out of scope for this component lane. All campaign
 * names are test-campaign variants.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ENFORCEMENT_DEFAULTS } from '../../services/combat/canTakeAction.js';

// Seedable in-memory synced store: `seed.enforcement` injects server-side
// state before render; `writes` records every setter payload in order;
// `scope` records the prop/campaign/default the store was bound to.
const store = vi.hoisted(() => ({ seed: undefined, writes: [], scope: null }));

vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
    const ReactActual = await vi.importActual('react');
    return {
        useSyncedState: (_key, prop, defaultValue, campaignName) => {
            store.scope = { prop, campaignName, defaultValue };
            const seeded = store.seed && Object.prototype.hasOwnProperty.call(store.seed, prop);
            const [value, setValue] = ReactActual.useState(seeded ? store.seed[prop] : defaultValue);
            return [value, (v) => { store.writes.push(v); setValue(v); }];
        },
    };
});

import EnforcementSection from './EnforcementSection.jsx';

const CAMPAIGN = 'test-campaign';

// Sub-flag labels as shown to the GM (serverDice is intentionally not surfaced here).
const SUB_FLAGS = [
    'Turn lock',
    'Action economy',
    'Movement budget',
    'Teleport token-move',
    'Auto-encounters',
    'Auto-rewards on clear',
    'Zones & areas',
    'Line of sight',
    'Opportunity attacks',
];

const masterSwitch = () => screen.getByRole('checkbox', { name: /Enforcement/ });
// Label text is "«label» «hint»" (the hint <em> sits inside the label), so match the leading label text.
const subFlag = (label) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });
const lastWrite = () => store.writes[store.writes.length - 1];

beforeEach(() => {
    store.seed = undefined;
    store.writes.length = 0;
    store.scope = null;
});

describe('EnforcementSection (L5-001)', () => {
    it('reads enforcement from the campaign-scoped synced store with safe defaults', () => {
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        // Server-first: state is bound to the campaign's `enforcement` key,
        // with the engine's ENFORCEMENT_DEFAULTS (all OFF) as the fallback.
        expect(store.scope).toEqual({ prop: 'enforcement', campaignName: CAMPAIGN, defaultValue: ENFORCEMENT_DEFAULTS });
        expect(masterSwitch()).not.toBeChecked();
        expect(screen.getByText('Enforcement OFF')).toBeInTheDocument();
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).not.toBeChecked());
    });

    it('does not render controls for the removed assignable referee role', () => {
        // Authority is hostname-derived (localhost IS the GM) — any lingering
        // referee key/client-id plumbing here is a regression.
        render(<EnforcementSection campaignName={CAMPAIGN} />);
        expect(screen.queryByText(/Referee/i)).not.toBeInTheDocument();
    });

    it('toggles the master switch, relabelling ON/OFF and writing mode through the synced setter', () => {
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        fireEvent.click(masterSwitch());
        expect(masterSwitch()).toBeChecked();
        expect(screen.getByText('Enforcement ON')).toBeInTheDocument();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on' });

        fireEvent.click(masterSwitch());
        expect(masterSwitch()).not.toBeChecked();
        expect(screen.getByText('Enforcement OFF')).toBeInTheDocument();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'off' });
    });

    it('gates every sub-flag behind the master switch: disabled while OFF, interactive once ON', () => {
        const { container } = render(<EnforcementSection campaignName={CAMPAIGN} />);

        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeDisabled());
        // The gate is the fieldset the browser disables natively (jsdom
        // fireEvent bypasses inherited fieldset disabling, so assert the
        // container's disabled state directly rather than simulating a click).
        expect(container.querySelector('.enforcement-flags')).toBeDisabled();

        fireEvent.click(masterSwitch());
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeEnabled());
        expect(container.querySelector('.enforcement-flags')).not.toBeDisabled();
    });

    it('merges sub-flag writes so each save carries the full current enforcement state', () => {
        render(<EnforcementSection campaignName={CAMPAIGN} />);
        fireEvent.click(masterSwitch());

        fireEvent.click(subFlag('Turn lock'));
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true });

        // A second flag rides on top of the first — the write is merged from
        // current state, not reset to defaults.
        fireEvent.click(subFlag('Line of sight'));
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true, lineOfSight: true });

        // Unchecking one flag leaves the others set.
        fireEvent.click(subFlag('Turn lock'));
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: false, lineOfSight: true });
        expect(subFlag('Turn lock')).not.toBeChecked();
        expect(subFlag('Line of sight')).toBeChecked();
    });

    it('renders saved enforcement state from the server, defaulting missing flags to OFF', () => {
        // Partial (pre-migration) store shape: only mode + one flag survive.
        store.seed = { enforcement: { mode: 'on', turnLock: true } };
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        expect(masterSwitch()).toBeChecked();
        expect(subFlag('Turn lock')).toBeChecked();
        expect(subFlag('Action economy')).not.toBeChecked();
        expect(subFlag('Movement budget')).not.toBeChecked();

        // Toggling a flag still persists the full merged shape, recovering the
        // missing keys as defaults.
        fireEvent.click(subFlag('Action economy'));
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true, actionEconomy: true });
    });

    it('renders enforcement OFF without crashing when the server has no enforcement state yet', () => {
        store.seed = { enforcement: null };
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        expect(screen.getByText('Enforcement OFF')).toBeInTheDocument();
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeDisabled());
    });
});
