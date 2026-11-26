import { useEffect, useState } from 'react';

/**
 * Horizontal-rail clipped detector (Item 7, audit F19): true while the
 * element referenced by `ref` scrolls horizontally (content wider than the
 * box by >8px). Re-measures on every `revision` change (roster churn) and on
 * container resizes via ResizeObserver — never on a timer. The consumer
 * renders the edge-fade cue only while this is true, so a rail that fully
 * fits never wears a phantom scrollbar or fade.
 */
export default function useRailClipped(ref, revision) {
    const [clipped, setClipped] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) {
            setClipped(false);
            return undefined;
        }
        const update = () => setClipped(el.scrollWidth - el.clientWidth > 8);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, revision]);
    return clipped;
}
