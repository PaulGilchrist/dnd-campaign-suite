// @maintained-by-ai
// One-shot trigger logic for the shared-adoption arrival notice (backlog
// JT 2026-11-11): the hook reads the ECHO lane only (synced travel-mode +
// travel-lastMessage values) and fires the caller's display callback exactly
// once per visible trip at arrival — silent on remote cancel, silent on a
// post-arrival mount (stale lastMessage bytes survive by design), order-
// independent across the two echoed rows, and suppressed for the presser's
// own commit (their toast already fired synchronously). Pure display lane:
// the hook writes nothing itself.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useArrivalEchoNotice from './useArrivalEchoNotice.js';
import { TRIP_ARRIVAL_MESSAGE } from '../../../services/maps/travelSession.js';

const setup = (initial) => {
    const onArrival = vi.fn();
    const localArrivalRef = { current: false };
    const utils = renderHook(
        (p) => useArrivalEchoNotice({ onArrival, localArrivalRef, ...p }),
        { initialProps: initial },
    );
    return {
        ...utils,
        onArrival,
        localArrivalRef,
        rerenderState: (changes) => utils.rerender({ ...initial, ...changes }),
    };
};

const VISIBLE = { isTripVisible: true, lastMessage: null };
const ARRIVED = { isTripVisible: false, lastMessage: TRIP_ARRIVAL_MESSAGE };
const CANCELLED = { isTripVisible: false, lastMessage: null };

describe('useArrivalEchoNotice', () => {
    it('fires exactly once on the visible→inactive flip with the arrival sentence', () => {
        const { rerenderState, onArrival } = setup(VISIBLE);
        expect(onArrival).not.toHaveBeenCalled(); // nothing while the trip is live

        rerenderState(ARRIVED);
        expect(onArrival).toHaveBeenCalledTimes(1);

        // Extra churn with the same arrived bytes never re-fires the notice.
        rerenderState({ ...ARRIVED, lastMessage: TRIP_ARRIVAL_MESSAGE });
        expect(onArrival).toHaveBeenCalledTimes(1);
    });

    it('is silent on initial mount when the mode is already inactive (stale arrival bytes)', () => {
        // A post-arrival mount sees the SURVIVING travel-lastMessage byte but
        // never saw the trip — the notice must not re-surface (per-client
        // one-shot, nothing persisted).
        const { rerenderState, onArrival } = setup(ARRIVED);
        expect(onArrival).not.toHaveBeenCalled();
        rerenderState({ ...ARRIVED });
        expect(onArrival).not.toHaveBeenCalled();
    });

    it('stays silent on a remote CANCEL (mode flips inactive without the arrival sentence)', () => {
        const { rerenderState, onArrival } = setup(VISIBLE);
        rerenderState(CANCELLED); // cancelTravel nulls lastMessage
        expect(onArrival).not.toHaveBeenCalled();
    });

    it('is echo-order independent: mode flip first, arrival sentence landing later still fires', () => {
        // The two SSE rows (travel-mode, travel-lastMessage) arrive in either
        // order — the arming flag persists until a notice consumes it.
        const { rerenderState, onArrival } = setup(VISIBLE);
        rerenderState(CANCELLED); // mode echo landed first (stale null message)
        expect(onArrival).not.toHaveBeenCalled();
        rerenderState(ARRIVED);  // message echo lands second
        expect(onArrival).toHaveBeenCalledTimes(1);
    });

    it('suppresses the presser commit (localArrivalRef consumed, toast lane untouched)', () => {
        const { rerenderState, onArrival, localArrivalRef } = setup(VISIBLE);
        localArrivalRef.current = true; // handleAdvance already showed the toast
        rerenderState(ARRIVED);
        expect(onArrival).not.toHaveBeenCalled();
        expect(localArrivalRef.current).toBe(false); // flag consumed, not stranded
    });

    it('re-arms for the next trip: a second visible→inactive arrival fires again', () => {
        const { rerenderState, onArrival } = setup(VISIBLE);
        rerenderState(ARRIVED);
        expect(onArrival).toHaveBeenCalledTimes(1);

        rerenderState({ isTripVisible: 'planning', lastMessage: null }); // new trip starts
        rerenderState(ARRIVED);                                          // and arrives
        expect(onArrival).toHaveBeenCalledTimes(2);
    });
});
