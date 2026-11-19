// @maintained-by-ai
// Roadmap Item 10 (sensory cues): the floaters' AUDIO TWIN for attack
// outcomes. The HP-diff floater lane (useTvPresentation → HpFeedback) is a
// pure before/after HP delta — it honestly carries no crit/fumble/miss flag,
// so outcome cues ride the ONLY seam that already ships those bytes to every
// client: the shared SSE log lane (the same `type:'roll'` entries TvRollPanel
// and the Log view decode). This consumer subscribes to the shared singleton
// (subscribeToSSE — never a new EventSource) and cues ONLY live appends:
// there is no initial log GET, so a mount or campaign re-select can never
// blast a backlog of old rolls. Every client fires its own cue, so an
// SSE-driven remote attack sounds on every screen showing the tracker.
//
// Damage and heal cues do NOT fire here — HpFeedback owns the HP-movement
// twin (heal), and damage deliberately stays silent on this lane because the
// attack cue already sounded (no moment is ever double-voiced).

import { useEffect } from 'react';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { cueForRollEntry, playCue } from '../../services/ui/audioCues.js';

export default function CombatCues({ campaignName }) {
    useEffect(() => {
        if (!campaignName) return undefined;
        return subscribeToSSE(campaignName, (event) => {
            // log-clear events carry data:null — nothing to cue on.
            if (!event || !event.key || !event.key.startsWith('log-')) return;
            const cue = cueForRollEntry(event.data);
            if (cue) playCue(cue);
        });
    }, [campaignName]);

    return null;
}
