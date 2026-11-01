// @maintained-by-ai
// Shared delete-request staging (backlog 2026-11-01 BA): the `pendingDelete`
// descriptor seam that usePlacedItems introduced in 37112c75b
// ({ action?, label, confirm } staged → DeleteConfirmModal-tier dialog →
// cancel-inert / confirm-once), extracted so the remaining destructive lanes
// (indoor POIs ride Map.jsx's usePlacedItems instance, hex POIs via
// usePoiManagement, spell overlays via useSpellOverlay) arm the SAME dialog
// tier instead of a native window.confirm. Semantics byte-identical to the
// original inline version:
//   • requestDelete stores the descriptor in state AND a ref mirror — the ref
//     guarantees confirm/cancel act on the EXACTLY-armed descriptor even when
//     invoked in the same tick as the arm (before React commits the re-render).
//   • cancel is fully inert: the descriptor's `confirm` closure — the ONLY
//     writer — never runs, so no state write reaches any autosave/POST lane.
//   • confirm runs the closure exactly once, then clears the arm.
import { useRef, useState } from 'react';

export default function useDeleteRequest() {
    const [pendingDelete, setPendingDelete] = useState(null);
    const pendingRef = useRef(null);

    const requestDelete = (descriptor) => {
        pendingRef.current = descriptor;
        setPendingDelete(descriptor);
    };

    const cancelDelete = () => {
        pendingRef.current = null;
        setPendingDelete(null);
    };

    const confirmDelete = () => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        setPendingDelete(null);
        if (pending) pending.confirm();
    };

    return { pendingDelete, requestDelete, cancelDelete, confirmDelete };
}
