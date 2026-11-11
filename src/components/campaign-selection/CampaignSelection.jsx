import { useCallback, useEffect, useRef, useState } from 'react';
import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaign/campaignService.js';
import { getCampaignTypes, CAMPAIGN_TYPE_BADGES } from '../../services/campaign/campaignMetaService.js';
import { createSeededCampaign, localDateStamp } from '../../services/campaign/seededCampaign.js';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import useEphemeralToast from '../map/hooks/useEphemeralToast.js';
import SeededCampaignModal, { ModalError } from './SeededCampaignModal.jsx';
import './CampaignSelection.css';

// Quick-create presets (arena-starter plan §2.3/§3.4): localhost-only buttons
// next to the standard create that seed a finished campaign via the shared
// orchestrator. Labels name what you actually get: a full campaign, a
// one-off arena battle, or a short guided starter adventure.
const SEEDED_PRESETS = {
  arena: {
    button: 'New Arena Battle',
    icon: 'fa-solid fa-shield-halved',
    prefix: 'Arena',
    note: 'Creates a one-off arena battle: two carved sparring halls plus a saved low-CR encounter pool, ready for pickup play. Campaign-only views (quests, factions, settlements, …) are hidden while an arena is open.',
  },
  starter: {
    button: 'New Starter Adventure',
    icon: 'fa-solid fa-seedling',
    prefix: 'Starter',
    note: 'Creates a short guided adventure: a generated village, wilds hex map with portal, dungeon, quests, and Dungeon Wave 1-3 encounters — every roll is fresh.',
  },
};

function seededDefaultName(prefix) {
  return `${prefix}-${localDateStamp()}`;
}

/**
 * The list region has three mutually exclusive faces (hoisted out of
 * CampaignSelection for the complexity ceiling): a FAILED folder fetch — an
 * outage, NOT the healthy "No campaigns found" empty state — recovers via an
 * in-place Retry refetch without a manual page reload (2026-11-02 BG); the
 * healthy-but-empty guidance; and the campaign rows themselves.
 */
function CampaignListArea({ foldersError, onRetry, campaigns, campaignTypes, selecting, onSelect }) {
  if (foldersError) {
    return (
      <div className="campaign-load-error" role="alert">
        <p className="error-message">{foldersError}</p>
        <button className="reload-button" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (campaigns.length === 0) {
    return (
      <p className="no-campaigns">
        No campaigns found. Please create folders under ./public/campaigns to get started.
      </p>
    );
  }
  return (
    <div className="campaign-list">
      {campaigns.map((campaign) => {
        const badge = CAMPAIGN_TYPE_BADGES[campaignTypes[campaign]];
        return (
          <button
            key={campaign}
            className={`campaign-button${badge ? ` campaign-button--${badge.cls}` : ''}`}
            onClick={() => onSelect(campaign)}
            disabled={selecting}
          >
            {campaign}
            {badge && (
              <span className={`campaign-type-badge campaign-type-badge--${badge.cls}`}>
                <i className={badge.icon}></i> {badge.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Post-delete success notice sink — hoisted (complexity ceiling) from the
 * CampaignSelection body. Renders the consumed 'postDeleteNotice' transport
 * through the ephemeral-toast lane's message; null-when-idle mirrors the
 * MapNoticeToast.jsx sink contract.
 */
function DeleteNotice({ message }) {
  if (!message) return null;
  return (
    <div className="success-message" role="status">
      <p>✅ {message}</p>
    </div>
  );
}

function CampaignSelection({ onCampaignSelect, autoSelectCampaign, isLocalhost = true }) {
  const [campaigns, setCampaigns] = useState([]);
  const [campaignTypes, setCampaignTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  // null | 'arena' | 'starter' — which preset the name-entry modal is for.
  const [seedPreset, setSeedPreset] = useState(null);
  const [seeding, setSeeding] = useState(false);
  // Transient folder-fetch failure (2026-11-02 BG retry-affordance fix): kept
  // separate from the hard-fail `error` screen so the header, quick-create
  // buttons and SSE live-refresh stay mounted while the user recovers the
  // list in place with Retry (MapUnavailable "Check Again" pattern).
  const [foldersError, setFoldersError] = useState(null);
  // Quick-create denial lane (backlog 2026-11-11 LZ): a refused CREATE (e.g.
  // the CAMPAIGN_LOCK 403 for an off-allowlist name) is the form's own error
  // — it renders INLINE in the open modal with the typed name preserved. It
  // never routes through `error`, whose full-page screen stays reserved for
  // genuine load/select failures (campaign data that cannot be read at all).
  const [createError, setCreateError] = useState(null);

  // Post-delete carry-over (backlog CP 2026-11-04): CampaignAdmin's typed-name
  // delete stores a one-shot sessionStorage notice before its full page
  // reload (same handoff as usePostRestoreNotice — UI feedback, never game
  // state). Consume + remove it HERE on mount so the notice survives exactly
  // one visit, and surface it through the shared ephemeral-toast lane
  // (useEphemeralToast: auto-hide at 4s, display-only timer, already on the
  // no-timers allowlist) rendered in this page's own .success-message box.
  const { message: deletedMessage, show: showDeletedToast } = useEphemeralToast(4000);
  useEffect(() => {
    let notice = null;
    try {
      const raw = sessionStorage.getItem('postDeleteNotice');
      if (!raw) return;
      sessionStorage.removeItem('postDeleteNotice'); // single-use, even if corrupt
      notice = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to consume post-delete notice:', err);
      return;
    }
    if (notice && notice.campaign) showDeletedToast(`${notice.campaign} deleted successfully.`);
    // showDeletedToast is a stable useCallback (duration is a constant prop to
    // the hook), so this effect is mount-once while staying lint-honest.
  }, [showDeletedToast]);

  // One modal at a time: the New Campaign and seed modals each own a
  // full-viewport .modal-overlay, and stacking two silently intercepts every
  // click on the buried one. While any modal is open the quick-create buttons
  // render disabled (visible not-allowed state) and the open handlers are
  // guarded, so keyboard focus behind the overlay can never stack a second.
  const modalOpen = showNewCampaignModal || seedPreset !== null;

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const folders = await getCharacterFolders();
      const types = await getCampaignTypes();
      setCampaigns(folders);
      setCampaignTypes(types);
      setFoldersError(null);
    } catch (_err) {
      // campaignService logs the cause once and rethrows (failure is never
      // silently downgraded to a healthy empty list).
      setFoldersError('Failed to load campaigns. Please ensure campaign folders exist under ./public/campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Live refresh (starter-seed SSE doctrine, 71f617299): the server publishes
  // app-level `campaigns-list` events on campaign create/rename/delete/meta
  // writes (server/routes/campaigns-admin.js + campaigns-meta.js). Selection
  // happens BEFORE any campaign is joined, so this rides the shared SSE
  // client's app-level channel (empty campaign key → `/subscribe` with no
  // `campaign` param) — still ONE shared EventSource, closed automatically
  // when this screen unmounts. The refetch is non-destructive: only the
  // folder/type lists are set-if-changed (stable refs when equal, so no
  // re-render churn) and no modal/loading state is touched.
  const refreshCampaigns = useCallback(async () => {
    try {
      const [folders, types] = await Promise.all([
        getCharacterFolders(),
        getCampaignTypes(),
      ]);
      setCampaigns(prev => (JSON.stringify(prev) === JSON.stringify(folders) ? prev : folders));
      setCampaignTypes(prev => (JSON.stringify(prev) === JSON.stringify(types) ? prev : types));
      // A successful refresh means the API is answering again — retire any
      // stale folder-load error/Retry lane.
      setFoldersError(null);
    } catch (err) {
      // Transient failure: keep the visible rows rather than wiping the
      // screen; the next event (or the folder-load Retry button) recovers.
      // (Service rethrows, so a mid-session outage can no longer blank the
      // list with a swallowed [] — the old LAN-deselect symptom.)
      console.error('Campaign list refresh failed:', err);
    }
  }, []);

  useEffect(() => subscribeToSSE(null, (event) => {
    if (!event || event.key !== 'campaigns-list') return;
    refreshCampaigns();
  }), [refreshCampaigns]);

  const handleCampaignSelect = async (campaign) => {
        try {
                  setLoading(true);
                  const characterFiles = await getCharacterFiles(campaign);
                  const characters = await loadCharacters(campaign, characterFiles);
          
          // Notify parent to switch views
          if (onCampaignSelect) {
            onCampaignSelect(campaign, characters);
            }
      } catch (_err) {
          setError(`Failed to load campaign ${campaign}`);
        } finally {
          setLoading(false);
          }
        };

  // Post-rollback carry-over: auto-open the campaign named by the restore notice.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectCampaign && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      handleCampaignSelect(autoSelectCampaign);
    }
    // handleCampaignSelect intentionally omitted: autoSelectedRef guards re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectCampaign]);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      setCreateError('Please enter a campaign name');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            },
        body: JSON.stringify({ campaignName: newCampaignName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      // Show success message
      setShowSuccessMessage(true);
      
      // Close modal and clear input
      setShowNewCampaignModal(false);
      setNewCampaignName('');
      setCreateError(null);
      
      // Reload the page to show the new campaign
      setTimeout(() => {
        window.location.reload();
       }, 2000);
      } catch (err) {
      // Denial stays IN the modal (typed name preserved) — the full-page
      // `error` screen is for load/select failures, never for a refused
      // create (lock 403 etc., backlog 2026-11-11 LZ).
      setCreateError(err.message);
    } finally {
      setLoading(false);
      }
    };

  const openNewCampaignModal = () => {
      // Two modals never coexist: quick-create buttons are disabled while one
      // is open, and this guard also blocks keyboard/programmatic activation
      // (a stacked .modal-overlay silently intercepts every click).
      if (modalOpen) return;
      setShowNewCampaignModal(true);
      setCreateError(null);
  };

  const closeModal = () => {
    setShowNewCampaignModal(false);
    setCreateError(null);
    setNewCampaignName('');
  };

  const openSeedModal = (presetKey) => {
    if (modalOpen) return; // see openNewCampaignModal — no stacked overlays
    setSeedPreset(presetKey);
    setNewCampaignName(seededDefaultName(SEEDED_PRESETS[presetKey].prefix));
    setCreateError(null);
  };

  const closeSeedModal = () => {
    setSeedPreset(null);
    setNewCampaignName('');
    setCreateError(null);
  };

  // Seeded quick-create (arena/starter): create folder + run the preset's
  // generators through the shared orchestrator, then jump straight into the
  // new campaign (the "reload to it" step of plan §2.3 without losing state).
  const handleCreateSeededCampaign = async () => {
    const name = newCampaignName.trim();
    if (!name) {
      setCreateError('Please enter a campaign name');
      return;
    }
    setSeeding(true);
    try {
      const result = await createSeededCampaign(seedPreset, { name });
      setSeedPreset(null);
      setNewCampaignName('');
      setCreateError(null);
      await handleCampaignSelect(result.name);
      // If the parent kept us mounted, surface the fresh row (and its badge).
      await refreshCampaigns();
    } catch (err) {
      // Same inline-denial lane as the standard modal: the seed modal stays
      // open with the typed name preserved (createSeededCampaign surfaces the
      // server's lock refusal verbatim).
      setCreateError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading && campaigns.length === 0) {
    return (
        <div className="campaign-selection loading">
           <p>Loading campaigns...</p>
        </div>
       );
     }

  if (loading && campaigns.length > 0) {
    return (
        <div className="campaign-selection loading">
           <p>Creating campaign...</p>
        </div>
       );
     }

  // Hard-fail screen: only load/select failures route here (never a refused
  // create — quick-create denials render inline in the open modal via
  // `createError`, backlog 2026-11-11 LZ). An off-target campaign load under
  // CAMPAIGN_LOCK still lands here with the server's lock message.
  if (error) {
    return (
        <div className="campaign-selection error">
           <p className="error-message">{error}</p>
           <button className="reload-button" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
       );
     }

  return (
       <div className="campaign-selection">
         <h1>Select a Campaign</h1>
         {showSuccessMessage && (
           <div className="success-message">
             <p>✅ Campaign created successfully!</p>
             <p>Reloading...</p>
           </div>
         )}
         <DeleteNotice message={deletedMessage} />
         {isLocalhost && (
           <button className="new-campaign-button" onClick={openNewCampaignModal} disabled={modalOpen}><i className="fas fa-plus"></i> New Campaign</button>
         )}
         {isLocalhost && Object.entries(SEEDED_PRESETS).map(([presetKey, cfg]) => (
           <button
             key={presetKey}
             className="new-campaign-button new-campaign-button--seeded"
             onClick={() => openSeedModal(presetKey)}
             disabled={modalOpen}
           >
             <i className={cfg.icon}></i> {cfg.button}
           </button>
         ))}
          <CampaignListArea
            foldersError={foldersError}
            onRetry={loadCampaigns}
            campaigns={campaigns}
            campaignTypes={campaignTypes}
            selecting={loading}
            onSelect={handleCampaignSelect}
          />
       
         {isLocalhost && showNewCampaignModal && (
           <div className="modal-overlay">
             <div className="modal-content">
               <h2>New Campaign</h2>
               <input
               type="text"
               value={newCampaignName}
               onChange={(e) => setNewCampaignName(e.target.value)}
               placeholder="Enter campaign name"
               className="modal-input"
               autoFocus
               />
               <ModalError message={createError} />
               <div className="modal-buttons">
                 <button className="modal-btn-primary" onClick={handleCreateCampaign} disabled={loading}>
                Create
                 </button>
                 <button className="modal-btn-secondary" onClick={closeModal}>
                Cancel
                 </button>
               </div>
             </div>
           </div>
         )}

         {isLocalhost && seedPreset && (
           <SeededCampaignModal
             preset={SEEDED_PRESETS[seedPreset]}
             name={newCampaignName}
             onNameChange={setNewCampaignName}
             seeding={seeding}
             onCreate={handleCreateSeededCampaign}
             onCancel={closeSeedModal}
             error={createError}
           />
         )}
       </div>
     );
}

export default CampaignSelection;

