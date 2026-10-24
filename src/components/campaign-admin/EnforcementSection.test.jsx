// @maintained-by-ai: 2026-10-24
/**
 * L5-001 — EnforcementSection behavior: master switch label/state, sub-flag
 * gating (disabled until enforcement is ON), merged writes through the
 * synced-store boundary, and rendering of saved server state (missing, null,
 * or partial pre-migration shapes) via ENFORCEMENT_DEFAULTS.
 *
 * Write-lane debounce (backlog 2026-10-24, mirror of the currency-chip fix
 * 97165afc2): every checkbox click updates the optimistic UI instantly but the
 * synced-store write is trailing-debounced (ENFORCEMENT_PERSIST_DEBOUNCE_MS =
 * 600ms) — a burst of toggles coalesces into ONE write carrying the final blob,
 * a lone click lands exactly once after the quiet window, and a stranded draft is
 * flushed on unmount (writes deferred, never dropped).
 *
 * useSyncedState is stubbed with a stateful stand-in (real useState so the
 * UI re-renders on write, plus a recorded write log) — the server/SSE
 * round-trip itself is out of scope for this component lane. All campaign
 * names are test-campaign variants.
 */
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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
const DEBOUNCE_MS = 600; // mirrors ENFORCEMENT_PERSIST_DEBOUNCE_MS in the component

// Sub-flag labels as shown to the GM (all 10 ENFORCEMENT_DEFAULTS sub-flags
// are surfaced here, serverDice included since 2026-10-24).
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
    'Server dice',
];

const masterSwitch = () => screen.getByRole('checkbox', { name: /Enforcement/ });
// Label text is "«label» «hint»" (the hint <em> sits inside the label), so match the leading label text.
const subFlag = (label) => screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });
// The sub-flags live in a single fieldset (role=group) — the gating container.
const flagsGroup = () => screen.getByRole('group');
const lastWrite = () => store.writes[store.writes.length - 1];

// Advance past the trailing debounce so any pending draft flushes to the store.
function settle() {
    act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS + 100);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    store.seed = undefined;
    store.writes.length = 0;
    store.scope = null;
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
        // Write lane is debounced, UI lane is not: the label flips on the same
        // tick, the synced write waits out the quiet window and lands exactly once.
        expect(masterSwitch()).toBeChecked();
        expect(screen.getByText('Enforcement ON')).toBeInTheDocument();
        expect(store.writes).toHaveLength(0);
        settle();
        expect(store.writes).toHaveLength(1);
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on' });

        fireEvent.click(masterSwitch());
        expect(masterSwitch()).not.toBeChecked();
        expect(screen.getByText('Enforcement OFF')).toBeInTheDocument();
        expect(store.writes).toHaveLength(1); // no write until the debounce settles
        settle();
        expect(store.writes).toHaveLength(2);
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'off' });
    });

    it('master-off zeroes every sub-flag in the written value and master-on does not re-arm them', () => {
        // Arm the master with live sub-flags — every one of them now renders
        // a row (serverDice included). The zeroing is blob-wide.
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
        expect(subFlag('Server dice')).toBeChecked();

        // ON→OFF: the persisted shape is mode:'off' with ALL sub-flags false,
        // and the surfaced Server dice checkbox visibly unchecks. The checkbox
        // reacts instantly; the merged write flushes after the debounce.
        fireEvent.click(masterSwitch());
        expect(flagsGroup()).toBeDisabled();
        expect(subFlag('Server dice')).not.toBeChecked();
        settle();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'off' });
        Object.entries(lastWrite()).forEach(([key, value]) => {
            if (key !== 'mode') expect(value, `${key} must be zeroed on master-off`).toBe(false);
        });

        // OFF→ON round trip: nothing re-arms without an individual click.
        fireEvent.click(masterSwitch());
        settle();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on' });
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).not.toBeChecked());

        // Individual sub-flag toggling is unchanged: one flag flips per click.
        fireEvent.click(subFlag('Turn lock'));
        settle();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true });
    });

    it('coalesces a master-on → turnLock → master-off burst into ONE merged write (all flags false)', () => {
        // The backlog fingerprint: three quick clicks previously produced three POSTs, two
        // of them throwaway intermediate blobs. Now the whole burst rides a single trailing
        // write carrying the FINAL state (master-off, every sub-flag false) — criterion 1
        // and criterion 4 together.
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        fireEvent.click(masterSwitch()); // master on
        // UI is already live mid-burst: master ON + fieldset enabled, ZERO writes.
        expect(masterSwitch()).toBeChecked();
        expect(flagsGroup()).not.toBeDisabled();
        expect(store.writes).toHaveLength(0);

        fireEvent.click(subFlag('Turn lock')); // arm one sub-flag (still same burst)
        expect(subFlag('Turn lock')).toBeChecked(); // instant optimistic flip, no write yet
        expect(store.writes).toHaveLength(0);

        fireEvent.click(masterSwitch()); // master off again, before the debounce lands

        // Each click resets the trailing timer: nothing has flushed during the burst,
        // yet the UI already reflects the final all-off state immediately.
        expect(masterSwitch()).not.toBeChecked();
        expect(flagsGroup()).toBeDisabled();
        expect(subFlag('Turn lock')).not.toBeChecked();
        expect(store.writes).toHaveLength(0);

        // After the quiet window, exactly ONE write carries the final master-off blob.
        settle();
        expect(store.writes).toHaveLength(1);
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'off' });
        Object.entries(lastWrite()).forEach(([key, value]) => {
            if (key !== 'mode') expect(value, `${key} must be zeroed on master-off`).toBe(false);
        });
    });

    it('flushes a stranded draft on unmount so a debounced write is never dropped', () => {
        render(<EnforcementSection campaignName={CAMPAIGN} />);
        fireEvent.click(masterSwitch()); // arm enforcement, don't let the debounce fire
        expect(store.writes).toHaveLength(0);

        cleanup(); // navigate away mid-burst
        expect(store.writes).toHaveLength(1);
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on' });
    });

    it('surfaces serverDice with a label + hint row and toggling it writes only that flag', () => {
        // §7.4 oracle flag (campaigns-roll.js / applyRuling.js) — surfaced so
        // the GM can arm it without hand-editing runtime state.
        store.seed = { enforcement: { mode: 'on', turnLock: true } };
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        const row = subFlag('Server dice');
        expect(row).not.toBeChecked();
        // The hint <em> sits inside the label, so it rides the accessible name.
        expect(row).toHaveAccessibleName(/SERVER oracle[\s\S]*cannot be forged client-side/);

        // Check: serverDice:true rides on the stored state, others untouched.
        fireEvent.click(row);
        expect(row).toBeChecked(); // instant optimistic flip on the UI lane
        expect(store.writes).toHaveLength(0); // write is debounced
        settle();
        expect(store.writes).toHaveLength(1);
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true, serverDice: true });

        // Uncheck: flips only serverDice back to false.
        fireEvent.click(row);
        expect(row).not.toBeChecked();
        settle();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true, serverDice: false });
    });

    it('gates every sub-flag behind the master switch: disabled while OFF, interactive once ON', () => {
        render(<EnforcementSection campaignName={CAMPAIGN} />);

        // The gate is the fieldset the browser disables natively (jsdom
        // fireEvent bypasses inherited fieldset disabling, so assert the
        // container's disabled state directly rather than simulating a click).
        expect(flagsGroup()).toBeDisabled();
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeDisabled());

        fireEvent.click(masterSwitch());
        // Gating reacts on the SAME tick as the click — the debounce never
        // delays the user-facing enable/disable, only the POST.
        expect(flagsGroup()).not.toBeDisabled();
        SUB_FLAGS.forEach((label) => expect(subFlag(label)).toBeEnabled());
        expect(store.writes).toHaveLength(0);
        settle();
        expect(store.writes).toHaveLength(1);
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
        settle();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: true, actionEconomy: true });

        // Unchecking one flag leaves the others set.
        fireEvent.click(subFlag('Turn lock'));
        expect(subFlag('Turn lock')).not.toBeChecked();
        expect(subFlag('Action economy')).toBeChecked();
        settle();
        expect(lastWrite()).toEqual({ ...ENFORCEMENT_DEFAULTS, mode: 'on', turnLock: false, actionEconomy: true });
    });
});
