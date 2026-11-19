// @maintained-by-ai
// Roadmap Item 5 (TV shared dice): recent roll results projected BIG on the
// TV presentation layout. Read-only consumer of the ALREADY-SYNCED campaign
// log lane — every roll (sheet attacks/saves/damage/initiative, monster-card
// dice chips, sidebar dice tray) is published as a `type:'roll'` log entry and
// reaches every client through the shared SSE singleton (useLog). No new
// server route, no new write lane, no dice mechanics.
//
// Decode reuse is total: each entry renders through the log's own RollEntry
// (src/components/log/LogRollEntry.jsx), the same renderer that decodes every
// roll shape (adv/dis dice faces, NAT 20/FUMBLE, HIT/MISS vs AC, save vs DC,
// damage type, resistance notices) — the panel never re-parses roll JSON. The
// across-the-room magnification rides the SAME lever the TV cards use
// (`zoom`, Initiative.css TV section), so the shared log skin scales whole.
//
// Replacement policy (timer-free, AGENTS "No Game Timers"): a newest-first
// row of at most TV_ROLL_PANEL_SIZE slots; a new roll pushes the oldest out of
// the window — never a setTimeout auto-dismiss, never unbounded scrolling.
// Entering TV mode seeds a clean panel: only rolls that LAND AFTER the log
// lane finishes its initial load are projected (a stale crit from an hour ago
// never glows on a freshly-mounted screen).

import { useEffect, useMemo, useState } from 'react';
import useLog from '../../hooks/runtime/useLog.js';
import { RollEntry } from '../log/LogRollEntry.jsx';
import '../log/Log.css';
import './TvRollPanel.css';

// Bounded panel: newest three results side by side (newest leftmost).
export const TV_ROLL_PANEL_SIZE = 3;

// TV-only gate lives HERE (mirrors the GmStatBlockModal pattern in
// Initiative.jsx) so the container renders the element unconditionally and
// stays under the complexity ratchet. Off-TV the live child never mounts, so
// useLog (log GET + SSE handler) adds zero traffic to non-TV screens — those
// keep the per-card floaters exactly as they were.
export default function TvRollPanel({ tvMode, campaignName }) {
    if (!tvMode) return null;
    return <TvRollPanelLive campaignName={campaignName} />;
}

function TvRollPanelLive({ campaignName }) {
    const { logEntries, initialized } = useLog(campaignName);

    // Baseline = id of the newest pre-existing entry at first initialization.
    // The functional setter self-guards, so later log appends never move it;
    // after a log clear the baseline id is absent and every (new) entry shows.
    const [baselineId, setBaselineId] = useState(undefined);
    useEffect(() => {
        if (!initialized) return;
        const lastId = logEntries.length ? logEntries[logEntries.length - 1].id : null;
        setBaselineId(prev => (prev === undefined ? lastId : prev));
    }, [initialized, logEntries]);

    const recentRolls = useMemo(() => {
        if (!initialized || baselineId === undefined) return [];
        const cutoff = logEntries.findIndex(entry => entry.id === baselineId);
        const projected = cutoff === -1 ? logEntries : logEntries.slice(cutoff + 1);
        return projected
            .filter(entry => entry.type === 'roll')
            .slice(-TV_ROLL_PANEL_SIZE)
            .reverse();
    }, [initialized, logEntries, baselineId]);

    if (!recentRolls.length) return null;

    return (
        <div className='tv-roll-panel' role='log' aria-label='Recent roll results'>
            {recentRolls.map(entry => (
                <div className='tv-roll-slot' key={entry.id}>
                    <RollEntry entry={entry} />
                </div>
            ))}
        </div>
    );
}
