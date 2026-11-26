import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCampaignMeta, saveCampaignToolbelt } from '../../services/campaign/campaignMetaService.js';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { resolveVisibleView } from '../../services/ui/sidebarNav.js';

/**
 * Campaign meta for the open campaign: the preset type (sidebar chip +
 * arena nav gating — replaces the retired useCampaignType hook) and the
 * sidebar toolbelt's hidden-view set (learnability backlog Item 1).
 *
 * Default policy lives HERE (the service throws):
 * - first load (campaign enter/select) → all-visible default on failure, so
 *   a blip never bricks the nav (the campaign-type law, carried over);
 * - a live SSE refresh → last-known value is KEPT on failure; defaults are
 *   never pasted over a working sidebar mid-session.
 *
 * Live convergence rides the EXISTING `campaigns-list` SSE event the meta
 * PUT already publishes (server/routes/campaigns-meta.js) — no new lane:
 * every mounted tab of the campaign re-reads the meta on 'updated', so the
 * whole table's nav converges within moments, GM and visitors alike.
 */
const ALL_VISIBLE = { type: 'standard', hiddenViews: [] };

export default function useCampaignMeta(campaignName, viewGuard) {
  const [meta, setMeta] = useState(ALL_VISIBLE);
  // Latest campaign, read inside async continuations so a slow response from
  // the campaign you LEFT can never paint over the one you entered.
  const campaignRef = useRef(campaignName);
  campaignRef.current = campaignName;

  useEffect(() => {
    if (!campaignName) {
      setMeta(ALL_VISIBLE);
      return undefined;
    }
    let cancelled = false;
    loadCampaignMeta(campaignName)
      .then((next) => { if (!cancelled) setMeta(next); })
      .catch((error) => {
        console.error('[campaignMeta] load failed — showing all views:', error);
      });
    return () => { cancelled = true; };
  }, [campaignName]);

  useEffect(() => {
    if (!campaignName) return undefined;
    return subscribeToSSE(campaignName, (event) => {
      if (event?.key !== 'campaigns-list') return;
      if (event.data?.action !== 'updated' || event.data?.campaign !== campaignName) return;
      // Re-read on every meta 'updated' (toolbelt AND type writes share the
      // event; the type chip converges on the same seam). Our own write
      // echoes too — an idempotent GET keeps this tab identical to the rest.
      loadCampaignMeta(campaignName)
        .then((next) => {
          if (campaignRef.current === campaignName) setMeta(next);
        })
        .catch((error) => {
          console.error('[campaignMeta] live refresh failed — keeping last-known nav:', error);
        });
    });
  }, [campaignName]);

  const saveHiddenViews = useCallback(async (hiddenViews) => {
    if (!campaignName) throw new Error('No campaign is open.');
    await saveCampaignToolbelt(campaignName, hiddenViews);
    // Optimistic local convergence; the SSE echo re-read confirms it.
    setMeta((prev) => ({ ...prev, hiddenViews }));
  }, [campaignName]);

  // Route guard folded in (App sits at its max-statements ceiling — one
  // combined call): a view hidden mid-session must not stay mounted.
  useHiddenViewFallback(viewGuard?.activeView, meta.hiddenViews, viewGuard?.setActiveView);

  return { campaignType: meta.type, hiddenViews: meta.hiddenViews, saveHiddenViews };
}

/**
 * Hidden-view route guard: a view the toolbelt hides (live SSE or a fresh
 * load) must not stay mounted — every tab falls back to the neutral stage
 * (activeView null) when its current view disappears from the nav, GM and
 * visitors alike. Mounted by useCampaignMeta when a `{ activeView,
 * setActiveView }` guard is passed; exported for direct testing.
 */
export function useHiddenViewFallback(activeView, hiddenViews, setActiveView) {
  useEffect(() => {
    if (!setActiveView) return undefined;
    const visible = resolveVisibleView(activeView, hiddenViews);
    if (visible !== activeView) setActiveView(visible);
  }, [activeView, hiddenViews, setActiveView]);
}
