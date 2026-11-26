import React from 'react';
import GMCopilot from '../GMCopilot/GMCopilot.jsx';
import { loadEncounters } from '../../services/encounters/encountersService.js';
import { loadMaps } from '../../services/maps/mapsService.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';

/**
 * "Try next" invitations (learnability plan Phase 2) — the Session panel's
 * optional nudge row. Invitations only, never removals:
 *
 * - Each fires ONLY while a genuine precondition holds (saved encounters and
 *   an empty board; maps built but none active; a live board worth
 *   presenting). One cold GET of each lane on mount — no timers, no polling
 *   (AGENTS.md); the panel re-reads on every visit.
 * - Taking the action navigates through the same sidebar lane the buttons use
 *   and settles NOTHING — the invitation returns until it's genuinely lived
 *   (the condition flips) or the GM dismisses it with × (settled forever,
 *   server-first in the shared `gmCopilot` key).
 * - A failed lane read renders no invitation for it — an honest absence beats
 *   a fabricated nudge.
 * - Toolbelt respect (Item 1): an invitation NEVER targets a view the GM has
 *   hidden from this campaign's sidebar — an invite into a surface the table
 *   chose not to show is a contradiction, so that card simply does not fire.
 */
function TryNextSection({ campaignName, characters = [], onNavigate, hiddenViews = [] }) {
  const [counts, setCounts] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadEncounters(campaignName).catch(() => null),
      loadMaps(campaignName).catch(() => null),
      loadCombatSummary(campaignName).catch(() => null),
    ]).then(([encountersRes, mapsRes, combat]) => {
      if (cancelled) return;
      setCounts({
        encounters: encountersRes?.encounters?.length ?? 0,
        maps: mapsRes?.maps?.length ?? 0,
        mapLaneOk: mapsRes != null,
        activeMap: Boolean((mapsRes?.maps || []).some((m) => m.isActive)),
        board: combat?.creatures?.length ?? 0,
      });
    });
    return () => { cancelled = true; };
  }, [campaignName]);

  if (!counts || !onNavigate) return null;
  const vars = { encounters: counts.encounters, maps: counts.maps };
  // Toolbelt gate: a hidden target view kills that card's precondition — no
  // invitation can invite the GM into a surface this campaign hides.
  const notHidden = (view) => !hiddenViews.includes(view);
  return (
    <>
      <GMCopilot
        campaignName={campaignName}
        tipId="try-combat"
        vars={vars}
        when={notHidden('encounter') && characters.length > 0 && counts.encounters > 0 && counts.board === 0}
        onAction={() => onNavigate('encounter')}
        actionLabel="Open Encounter Builder"
      />
      <GMCopilot
        campaignName={campaignName}
        tipId="try-maps"
        vars={vars}
        when={notHidden('mapsManager') && counts.mapLaneOk && counts.maps > 0 && !counts.activeMap}
        onAction={() => onNavigate('mapsManager')}
        actionLabel="Open Maps"
      />
      <GMCopilot
        campaignName={campaignName}
        tipId="try-tv"
        when={notHidden('initiative') && counts.board >= 2}
        onAction={() => onNavigate('initiative')}
        actionLabel="Open Initiative"
      />
    </>
  );
}

export default TryNextSection;
