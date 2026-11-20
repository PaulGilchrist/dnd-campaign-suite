// @improved-by-ai

import { useEffect, useState } from 'react';
import { loadStarterSeed } from '../../services/campaign/starterSeedService.js';
import './EmptyCampaignState.css';

/**
 * Empty-state card for a loaded campaign whose roster has no characters yet
 * (backlog UM 2026-11-20): the shell used to render a fully blank main stage
 * once the offer-once creation wizard had been consumed, leaving the sidebar
 * "Add Character" button as the only door. Mirrors the MapUnavailable
 * placeholder pattern (global .ct-container + .ct-empty-state + .ct-btn
 * classes, scoped accent CSS).
 *
 * Seeded starter campaigns additionally offer the checklist affordance: the
 * seed read is the EXACT gate FirstSessionChecklist keys its own visibility
 * off (`seed?.entities`), and the starter-seed GET answers 200 `{seed:null}`
 * for non-starter campaigns, so this lane never errors for arena/standard.
 * The add-character button mirrors the sidebar's GM-only "Add Character" door
 * (localhost-only, same gate as Sidebar.jsx).
 */
function EmptyCampaignState({ campaignName, onAddCharacter, onOpenChecklist, isLocalhost = false }) {
  const [hasStarterSeed, setHasStarterSeed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHasStarterSeed(false);
    loadStarterSeed(campaignName)
      .then(seed => { if (!cancelled) setHasStarterSeed(Boolean(seed?.entities)); })
      .catch(() => { if (!cancelled) setHasStarterSeed(false); });
    return () => { cancelled = true; };
  }, [campaignName]);

  return (
    <div className="ct-container empty-campaign-state">
      <div className="ct-empty-state">
        <i className="fa-solid fa-dragon" aria-hidden="true"></i>
        <span>This campaign has no characters yet.</span>
        {isLocalhost && (
          <button type="button" className="ct-btn ct-btn-primary empty-campaign-add-btn" onClick={onAddCharacter}>
            <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add your first character
          </button>
        )}
        {hasStarterSeed && (
          <button type="button" className="ct-btn empty-campaign-checklist-btn" onClick={onOpenChecklist}>
            <i className="fa-solid fa-seedling" aria-hidden="true"></i> Open the starter checklist
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyCampaignState;
