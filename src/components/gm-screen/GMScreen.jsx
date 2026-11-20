// GM Screen — the single at-a-glance panel for a running GM (roadmap
// Phase 2, Item 3). PURE presentation: party lookup derived from
// PlayerStats (computedCharacters, the single source of truth) + live
// runtime-store subscriptions (read-only useRuntimeValue), an "In Play"
// summary of conditions/effects/combat, and a conditions/actions quick
// reference. It never writes to the server and holds no game state — the
// sidebar entry is the same localhost-only gate every other GM view uses
// (Sidebar NAV_ITEMS localhostOnly). Spell-overlay zone adoption rides the
// ONE shared SSE lane (subscribeToSSE — never a new EventSource) with the
// Initiative lane's createOverlayHandler reducer.
import { useEffect, useMemo, useState } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { createOverlayHandler } from '../initiative/sseHandlers.js';
import { fetchSpellOverlays } from '../../services/maps/spellOverlayService.js';
import GMScreenPartyTable from './GMScreenPartyTable.jsx';
import GMScreenInPlay from './GMScreenInPlay.jsx';
import GMScreenQuickRef from './GMScreenQuickRef.jsx';
import './GMScreen.css';

export default function GMScreen({ characters, campaignName }) {
    // Views receive the enriched roster; rows without computedStats have no
    // trustworthy AC/saves to show, so they stay out of the lookup table.
    const party = useMemo(
        () => (characters || []).filter(character => character.computedStats),
        [characters],
    );
    // One campaign-level subscription feeds every target-effect consumer
    // below (zones + per-creature badges) — the same key CharSummary reads.
    const campaignEffects = useRuntimeValue('campaign', 'targetEffects', campaignName) ?? [];

    // Spell-overlay zones (the circles a GM reads as zones on the map) live
    // OUTSIDE the runtime store — mount-fetch + live add/update/remove/clear
    // adoption through the ONE shared SSE lane, the exact Initiative pattern
    // (dedupe-merge so a fetch that lands after an SSE add never re-adds,
    // and the functional updates return `prev` unchanged on no-op events).
    const [spellZones, setSpellZones] = useState([]);
    useEffect(() => {
        if (!campaignName) return undefined;
        let cancelled = false;
        fetchSpellOverlays(campaignName).then(loaded => {
            if (!loaded.length || cancelled) return;
            setSpellZones(prev => {
                const existingIds = new Set(prev.map(o => o.id));
                const unique = loaded.filter(n => !existingIds.has(n.id));
                return unique.length ? [...prev, ...unique] : prev;
            });
        });
        const handleOverlayEvent = createOverlayHandler(campaignName);
        const unsubscribe = subscribeToSSE(campaignName, (event) => {
            handleOverlayEvent(event, setSpellZones);
        });
        return () => { cancelled = true; unsubscribe(); };
    }, [campaignName]);

    return (
        <div className="campaign-tool gm-screen-view">
            <div className="gm-toolbar">
                <h2><i className="fa-solid fa-eye"></i> GM Screen</h2>
            </div>
            <GMScreenPartyTable party={party} campaignName={campaignName} campaignEffects={campaignEffects} />
            <GMScreenInPlay party={party} campaignName={campaignName} campaignEffects={campaignEffects} spellZones={spellZones} />
            <GMScreenQuickRef />
        </div>
    );
}
