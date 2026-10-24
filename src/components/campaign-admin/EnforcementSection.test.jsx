// @maintained-by-ai
/**
 * L5-001 — EnforcementSection behavior: master switch label/state, sub-flag
 * gating (disabled until enforcement is ON), merged writes through the
 * synced-store boundary, and rendering of saved server state (missing, null,
 * or partial pre-migration shapes) via ENFORCEMENT_DEFAULTS.
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
// `scope` records the prop/campaign the store was bound to.
const store = vi.hoisted(() => ({ seed: undefined, writes: [], scope: null }));

vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
    const ReactActual = await vi.importActual('react');
    return {
        useSyncedState: (_key, prop, defaultValue, campaignName) => {
            store.scope = { prop, campaignName };
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
// The sub-flags live in a single fieldset (role=group) — the gating container.
const flagsGroup = () => screen.getByRole('group');
const lastWrite = () => store.writes[store.writes.length - 1];

beforeEach(() => {
    store.seed = undefined;
    store.writes.length = 0;
    store.scope = null;
});

describe('EnforcementSection (L5-001)', () => {
    it.each([
        ['no enforcement key at all', undefined],
        ['a null enforcement value', { enforcement: null }],
    ])('binds the campaign `enforcement` key and renders everything OFF when the server has %s', (_desc, seed) => {
        store.seed = seed;
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        // Server-first: state is bound to the campaign's `enforcement` key.
        expect(store.scope).toEqual({ prop: 'enforcement', campaignName: CAMPAIGN });
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

    it('master-off zeroes every sub-flag in the written value (incl. unsurfaced serverDice) and master-on does not re-arm them', () => {
        // Arm the master with live sub-flags, one of which (serverDice) has
        // no UI row — the zeroing is blob-wide, not just what renders.
        store.seed = {
            enforcement: {
                ...ENFORCEMENT_DEFAULTS,
                mode: 'on',
                turnLock: true,
                autoRewards: true,
                serverDice: true,
            },
        };
        render(<EnforcementSection campaignName={CAMPAIGN} />);
        expect(masterSwitch()).toBeChecked();
        expect(subFlag('Turn lock')).toBeChecked();

        // ON→OFF: the persisted shape is mode:'off' with ALL sub-flags false.
        fireEvent.click(masterSwitch());
        expect(flagsGroup()).toBeDisabled();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'off' });
        Object.entries(lastWrite()).forEach(([key, value]) => {
            if (key !== 'mode') expect(value, `${key} must be zeroed on master-off`).toBe(false);
        });

        // OFF→ON round trip: nothing re-arms without an individual click.
        fireEvent.click(masterSwitch());
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on' });
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).not.toBeChecked());

        // Individual sub-flag toggling is unchanged: one flag flips per click.
        fireEvent.click(subFlag('Turn lock'));
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true });
    });

    it('gates every sub-flag behind the master switch: disabled while OFF, interactive once ON', () => {
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        // The gate is the fieldset the browser disables natively (jsdom
        // fireEvent bypasses inherited fieldset disabling, so assert the
        // container's disabled state directly rather than simulating a click).
        expect(flagsGroup()).toBeDisabled();
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeDisabled());

        fireEvent.click(masterSwitch());
        expect(flagsGroup()).not.toBeDisabled();
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeEnabled());
    });

    it('renders saved server state and every sub-flag toggle writes the full merged shape', () => {
        // Partial (pre-migration) server shape: only mode + one flag survive.
        store.seed = { enforcement: { mode: 'on', turnLock: true } };
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        expect(masterSwitch()).toBeChecked();
        expect(subFlag('Turn lock')).toBeChecked();
        expect(subFlag('Action economy')).not.toBeChecked();

        // Checking a new flag rides on top of the stored state and recovers
        // the missing keys as defaults — the write is merged, never reset.
        fireEvent.click(subFlag('Action economy'));
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true, actionEconomy: true });

        // Unchecking one flag leaves the others set.
        fireEvent.click(subFlag('Turn lock'));
        expect(subFlag('Turn lock')).not.toBeChecked();
        expect(subFlag('Action economy')).toBeChecked();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: false, actionEconomy: true });
    });
});
