// GM Screen — the single at-a-glance panel for a running GM (roadmap
// Phase 2, Item 3). PURE presentation: party lookup derived from
// PlayerStats (computedCharacters, the single source of truth) + live
// runtime-store subscriptions (read-only useRuntimeValue), an "In Play"
// summary of conditions/effects/combat, and a conditions/actions quick
// reference. It never writes to the server, opens no new SSE lane, and
// holds no game state — the sidebar entry is the same localhost-only gate
// every other GM view uses (Sidebar NAV_ITEMS localhostOnly).
import { useMemo } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
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

    return (
        <div className="campaign-tool gm-screen-view">
            <div className="gm-toolbar">
                <h2><i className="fa-solid fa-eye"></i> GM Screen</h2>
            </div>
            <GMScreenPartyTable party={party} campaignName={campaignName} campaignEffects={campaignEffects} />
            <GMScreenInPlay party={party} campaignName={campaignName} campaignEffects={campaignEffects} />
            <GMScreenQuickRef />
        </div>
    );
}
