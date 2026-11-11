import { useRef, useState } from 'react';

/**
 * useMapHistory — the board-navigation stack (POI / encounter map entry)
 * plus a REACTIVE mirror of its top entry (backlog 2026-11-11 JV).
 *
 * The stack itself stays a ref so push/pop semantics are synchronous and
 * identical to the original mapHistoryRef behaviour. The mirror exists
 * because a bare ref mutation never re-renders: both board toolbars title
 * their back button with the stack top ("Back to <previous map name>") so
 * the label honestly names the map handleBackFromMap will pop while the
 * stack is armed, and reverts byte-identically to "Back to maps" when it
 * empties — every mutation site rides push/pop/clear, which sync the
 * mirror atomically with the stack.
 *
 * Entries carry { mapName, mapDisplayName }; consumers drive navigation by
 * entry.mapName only (the display name labels the button, nothing else).
 */
function useMapHistory() {
  const historyRef = useRef([]);
  const [top, setTop] = useState(null);

  const syncTop = () => setTop(historyRef.current.at(-1) ?? null);

  return {
    /** Current stack top ({ mapName, mapDisplayName } | null) — label source. */
    top,
    /** True while a back press would pop an entry instead of falling through. */
    armed: () => historyRef.current.length > 0,
    push: (entry) => {
      historyRef.current.push(entry);
      syncTop();
    },
    /** Pops and returns the entry (undefined on an empty stack). */
    pop: () => {
      const entry = historyRef.current.pop();
      syncTop();
      return entry;
    },
    clear: () => {
      historyRef.current = [];
      syncTop();
    },
  };
}

export default useMapHistory;
