// @maintained-by-ai
// Roadmap Item 10 (sensory cues): the floaters' AUDIO TWIN for attack
// outcomes, save outcomes, and deaths. The HP-diff floater lane
// (useTvPresentation → HpFeedback) is a pure before/after HP delta — it
// honestly carries no crit/fumble/miss flag, so outcome cues ride the ONLY
// seam that already ships those bytes to every client: the shared SSE log
// lane (the same `type:'roll'` entries TvRollPanel and the Log view decode).
// This consumer subscribes to the shared singleton
// (subscribeToSSE — never a new EventSource) and cues ONLY live appends:
// there is no initial log GET, so a mount or campaign re-select can never
// blast a backlog of old rolls. Every client fires its own cue, so an
// SSE-driven remote attack sounds on EVERY view of a mounted campaign tab.
//
// MOUNT LAW (owner ruling 2026-11-20): mounted ONCE at App level (beside the
// root Subscriber/MapContextSync campaign consumers), NOT inside Initiative —
// a tab parked on Characters/Map/Log must hear saves, deaths and its own
// attack chain too. Exactly one pooled lane per campaign session: the mount
// only ever exists on the campaign-selected shell, so the campaign-select
// screen is cue-silent and the Initiative view never doubles the lane.
//
// Damage and heal cues do NOT fire here — HpFeedback owns the HP-movement
// twin (heal), and damage deliberately stays silent on this lane because the
// attack cue already sounded (no moment is ever double-voiced). Save/death
// entries ARE decoded here — see cueForLogEntry for why those moments have
// no other voice.

import { useEffect, useState } from 'react';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { cueForLogEntry, playCue, alreadyCued } from '../../services/ui/audioCues.js';
import NatFlourish from './NatFlourish/NatFlourish.jsx';

// PER-ROW IDEMPOTENCE (improve 2026-11-21, CCC backlog): a duplicate delivery
// of the same log row — an SSE resend after a brief drop, or a remount
// replaying the newest append — never re-voices a moment. Every row that
// decodes to a cue is claimed by its server-stamped GUID `id` via alreadyCued
// (a module-level bounded-FIFO seen-set beside the decoder it guards, so the
// memory survives this component's remounts; bound/eviction law lives in
// audioCues.js). Rows with no cue never touch the set.
export default function CombatCues({ campaignName }) {
    // Full-screen Nat20/Fumble flourish (Phase 6): the visual layer fires on
    // EVERY client (the whole table reacts); the audio twin inside playCue is
    // sound-screen-gated (soundOwner.js), so exactly one device voices it.
    // Keyed by the row GUID — a fresh crit replaces the live flourish, and
    // the component self-removes on animationend (no timers).
    const [flourish, setFlourish] = useState(null);
    useEffect(() => {
        if (!campaignName) return undefined;
        return subscribeToSSE(campaignName, (event) => {
            // log-clear events carry data:null — nothing to cue on.
            if (!event || !event.key || !event.key.startsWith('log-')) return;
            const cue = cueForLogEntry(event.data);
            if (!cue) return;
            if (alreadyCued(event.data.id)) return;
            playCue(cue);
            if (cue === 'crit' || cue === 'fumble') {
                setFlourish({ kind: cue, id: event.data.id });
            }
        });
    }, [campaignName]);

    if (!flourish) return null;
    return (
        <NatFlourish
            key={flourish.id}
            kind={flourish.kind}
            onDone={() => setFlourish(null)}
        />
    );
}
