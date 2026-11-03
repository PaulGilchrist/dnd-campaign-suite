import { useCallback, useEffect, useRef, useState } from 'react';
import { getCharacterFolders, getCharacterFiles, loadCharacters } from '../../services/campaign/campaignService.js';
import { getCampaignTypes, CAMPAIGN_TYPE_BADGES } from '../../services/campaign/campaignMetaService.js';
import { createSeededCampaign } from '../../services/campaign/seededCampaign.js';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import SeededCampaignModal from './SeededCampaignModal.jsx';
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
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
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
      setError('Please enter a campaign name');
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
      setError(null);
      
      // Reload the page to show the new campaign
      setTimeout(() => {
        window.location.reload();
       }, 2000);
      } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      }
    };

  const openNewCampaignModal = () => {
      setShowNewCampaignModal(true);
      setError(null);
  };

  const closeModal = () => {
    setShowNewCampaignModal(false);
    setError(null);
    setNewCampaignName('');
  };

  const openSeedModal = (presetKey) => {
    setSeedPreset(presetKey);
    setNewCampaignName(seededDefaultName(SEEDED_PRESETS[presetKey].prefix));
    setError(null);
  };

  const closeSeedModal = () => {
    setSeedPreset(null);
    setNewCampaignName('');
    setError(null);
  };

  // Seeded quick-create (arena/starter): create folder + run the preset's
  // generators through the shared orchestrator, then jump straight into the
  // new campaign (the "reload to it" step of plan §2.3 without losing state).
  const handleCreateSeededCampaign = async () => {
    const name = newCampaignName.trim();
    if (!name) {
      setError('Please enter a campaign name');
      return;
    }
    setSeeding(true);
    try {
      const result = await createSeededCampaign(seedPreset, { name });
      setSeedPreset(null);
      setNewCampaignName('');
      await handleCampaignSelect(result.name);
      // If the parent kept us mounted, surface the fresh row (and its badge).
      await refreshCampaigns();
    } catch (err) {
      setError(err.message);
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
         {isLocalhost && (
           <button className="new-campaign-button" onClick={openNewCampaignModal}><i className="fas fa-plus"></i> New Campaign</button>
         )}
         {isLocalhost && Object.entries(SEEDED_PRESETS).map(([presetKey, cfg]) => (
           <button
             key={presetKey}
             className="new-campaign-button new-campaign-button--seeded"
             onClick={() => openSeedModal(presetKey)}
             disabled={seeding}
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
           />
         )}
       </div>
     );
}

export default CampaignSelection;

