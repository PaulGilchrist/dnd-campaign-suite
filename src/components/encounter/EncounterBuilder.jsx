import { useState, useMemo, useEffect } from 'react';
import { cloneDeep } from 'lodash';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';
import EncounterMonsterTable from './EncounterMonsterTable.jsx';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';
import EncounterModal from './EncounterModal.jsx';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';
import MonsterCardModal from './MonsterCardModal.jsx';
import PreviewToggle from '../common/PreviewToggle.jsx';
import AiRefineButton from '../common/AiRefineButton.jsx';
import { formatEncounterName } from '../../services/encounters/encountersService.js';
import { addMonstersToInitiative } from '../../services/encounters/encounterToInitiative.js';
import { calculateXPThreshold, calculateDifficultyMultiplier } from '../../services/encounters/encounterGenerator.js';
import { ENCOUNTER_CONFIG } from '../../config/encounterConfig.js';
import { addEntry } from '../../services/ui/logService.js';
import './EncounterBuilder.css';

const difficultyLabels = ['Easy', 'Medium', 'Hard', 'Deadly'];

function calculateDifficultyIndex(effectiveXP, totalThreshold) {
  if (!totalThreshold) return 0;
  const ratio = effectiveXP / totalThreshold;
  if (ratio < 0.5) return 0;
  if (ratio < 1) return 1;
  if (ratio < 1.5) return 2;
  return 3;
}

function calculateTotalMonsterXP(selectedMonsters) {
  return selectedMonsters.reduce((sum, m) => sum + (m.xp || 0) * (m.qty || 1), 0);
}

function calculateMonsterCount(selectedMonsters) {
  return selectedMonsters.reduce((sum, m) => sum + (m.qty || 1), 0);
}

function crToNumber(cr) {
  if (cr === null || cr === undefined || cr === '' || cr === 'None') return NaN;
  const str = String(cr).trim().toLowerCase();
  if (str === 'any') return 999;
  const match = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (match) return parseInt(match[1], 10) / parseInt(match[2], 10);
  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

function matchesCrRange(m, crMinNum, crMaxNum) {
  if (crMinNum === null && crMaxNum === null) return true;
  const cr = crToNumber(m.challenge_rating);
  if (isNaN(cr)) return false;
  if (crMinNum !== null && cr < crMinNum) return false;
  if (crMaxNum !== null && cr > crMaxNum) return false;
  return true;
}

function matchesSearchQuery(m, q) {
  return m.name.toLowerCase().includes(q)
     || (m.type && m.type.toLowerCase().includes(q))
     || (m.subtype && m.subtype.toLowerCase().includes(q));
}

const monsterSortExtractors = {
  name: (m) => m.name.toLowerCase(),
  cr: (m) => m.challenge_rating || 0,
  xp: (m) => m.xp || 0,
  env: (m) => (m.environments || []).join(', ').toLowerCase(),
};

function getMonsterSortValue(m, sortField, selectedMonsters) {
  if (sortField === 'sel') return selectedMonsters.some((sm) => sm.index === m.index) ? 0 : 1;
  return (monsterSortExtractors[sortField] || monsterSortExtractors.name)(m);
}

function compareMonsters(a, b, sortField, sortDirection, selectedMonsters) {
  const valA = getMonsterSortValue(a, sortField, selectedMonsters);
  const valB = getMonsterSortValue(b, sortField, selectedMonsters);
  if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
  if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
  return 0;
}

function filterMonsters(monsters, filter = {}) {
  if (!monsters) return [];
  const { searchQuery = '', environmentFilter = '', typeFilter = '', sizeFilter = '', crMin = '', crMax = '' } = filter;
  const crMinNum = !crMin ? null : parseFloat(crMin);
  const crMaxNum = !crMax ? null : parseFloat(crMax);
  const q = searchQuery ? searchQuery.toLowerCase() : '';
  return monsters.filter(m => {
    if (environmentFilter && m.environments && !m.environments.includes(environmentFilter)) return false;
    if (typeFilter && m.type && m.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (sizeFilter && m.size && m.size.toLowerCase() !== sizeFilter.toLowerCase()) return false;
    if (!matchesCrRange(m, crMinNum, crMaxNum)) return false;
    if (!q) return true;
    return matchesSearchQuery(m, q);
  });
}

// --- Immutable state updaters ---

function toggleMonster(selected, monster) {
  const existing = selected.find(m => m.index === monster.index);
  if (existing) {
    return selected.map(m =>
      m.index === monster.index ? { ...m, qty: (m.qty || 1) - 1 } : m
    ).filter(m => m.qty > 0);
  }
  return [...selected, { ...monster, qty: 1 }];
}

function updateQty(selected, index, delta) {
  return selected.map(m =>
    m.index === index ? { ...m, qty: (m.qty || 1) + delta } : m
  ).filter(m => m.qty > 0);
}

// --- Load saved filter from localStorage ---
// localStorage-only: UI preference, no server endpoint needed
function loadSavedFilter() {
  try {
    const key = 'encounterFilter-2024';
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.difficulty === 'number') {
        return parsed;
      }
    }
  } catch { /* ignore corrupt data */ }
  return null;
}

// localStorage-only: UI preference, no server endpoint needed
function saveFilter(filter) {
  try {
    const key = 'encounterFilter-2024';
    localStorage.setItem(key, JSON.stringify({
      difficulty: filter.difficulty,
      environment: filter.environment,
      type: filter.type,
      size: filter.size,
      crMin: filter.crMin,
      crMax: filter.crMax,
    }));
   } catch { /* storage full, ignore */ }
}

function stripMonsters(monsters) {
  return monsters.map(m => ({
    index: m.index,
    name: m.name,
    qty: m.qty || 1,
  }));
}

// Resolve saved/refined monster refs back into bestiary rows (bestiary-first,
// ref-fallback) — shared by the load lane and the AI-refine proposal lane so
// the hydration rule lives in exactly one place.
function resolveMonsterRefs(refs, monsters) {
  return (refs || []).map(ref => {
    const full = (monsters || []).find(m => m.index === ref.index);
    return full ? { ...full, qty: ref.qty || 1 } : { ...ref, qty: ref.qty || 1 };
  });
}

// AI-refine proposal → working-draft state (kept out of the component to stay
// under the complexity cap — same idiom as EncounterValidationBanner).
function refinedEncounterToState(replacement, monsters) {
  return {
    description: replacement.description || '',
    selectedMonsters: resolveMonsterRefs(replacement.selectedMonsters, monsters),
  };
}

// The refine button belongs to the SAVED-encounter editing surface only — an
// unnamed draft has no row to refine (server lane: POST .../ai/refine/
// encounter). Own component so EncounterBuilder keeps its complexity.
function EncounterAiRefine({ campaignName, encounterName, description, selectedMonsters, onApplied }) {
  if (!encounterName) return null;
  return (
    <AiRefineButton
      campaignName={campaignName}
      kind="encounter"
      entity={{ name: encounterName, description, selectedMonsters: stripMonsters(selectedMonsters) }}
      onReplaced={onApplied}
    />
  );
}

// Inline validate-with-error banner (empty-draft save gate) — extracted so
// EncounterBuilder stays under the complexity cap.
function EncounterValidationBanner({ message }) {
  return message ? <div className="encounter-modal-error" role="alert">{message}</div> : null;
}

function EncounterBuilder({ characters, campaignName, onJoinEncounter }) {
  const { monsters, loading } = useMonstersData();

  const [filter, setFilter] = useState(() => {
      const saved = loadSavedFilter();
      const playerLevels = (characters && characters.length > 0)
        ? characters.map(c => c.level || 1)
        : (saved && saved.playerLevels ? saved.playerLevels : [1]);
     return {
       difficulty: saved ? saved.difficulty : ENCOUNTER_CONFIG.defaultDifficulty,
       playerLevels,
       environment: saved ? saved.environment : '',
       type: saved ? saved.type : '',
       size: saved ? saved.size : '',
       crMin: saved && saved.crMin !== undefined ? saved.crMin : '',
       crMax: saved && saved.crMax !== undefined ? saved.crMax : '',
       };
    });

  // When characters change (e.g., campaign switch), show in party summary for display purposes only
  // Player levels filter is not auto-overwritten so loaded encounters preserve their settings

  // Save difficulty to localStorage when it changes
  useEffect(() => {
    saveFilter(filter);
  }, [filter.difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedMonsters, setSelectedMonsters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Empty-draft save gate: clicking Save with zero monsters shows a visible
  // inline error instead of persisting an empty encounter (validate-with-error
  // UX mirroring EncounterModal's "Encounter name is required" / MapsManager's
  // "Map name cannot be empty"). Clears as soon as a monster is drafted.
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    if (selectedMonsters.length > 0) {
      setSaveError(prev => (prev ? '' : prev));
    }
  }, [selectedMonsters]);

  // Encounter save/load
  const {
    modalOpen,
    modalMode,
    encounters,
    loading: encounterLoading,
    openSaveModal,
    openLoadModal,
    closeModal,
    saveEncounter,
    updateEncounter,
    loadEncounterData,
    deleteEncounterAction,
    renameEncounterAction,
  } = useEncounterManagement(campaignName);

  const [pendingEncounterData, setPendingEncounterData] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);
  // Display-only save/load confirmation toast (mirrors .sessions-toast in Sessions.jsx)
  const [toast, setToast] = useState(null);

  const showToast = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 2500); // toast auto-hide (display only, no game state)
  };
  const [viewingMonster, setViewingMonster] = useSyncedState('campaign', 'encounter-viewingMonster', null, campaignName);
  const [encounterTitle, setEncounterTitle] = useState('Encounter Builder');
  const [currentEncounterName, setCurrentEncounterName] = useState(null);
  const [description, setDescription] = useState('');



 // Sort state for monster table
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // --- Derived values ---
  // Environment filter options derived from the loaded bestiary (/data/monsters.json),
  // never retyped — stays in sync with the environments actually present in the data.
  const environmentOptions = useMemo(() => {
    const envs = new Set();
    (monsters || []).forEach(m => (m.environments || []).forEach(e => envs.add(e)));
    return [...envs].sort();
  }, [monsters]);

  const totalThreshold = useMemo(
    () => calculateXPThreshold(filter.playerLevels, filter.difficulty),
    [filter.playerLevels, filter.difficulty]
  );

  const totalMonsterXP = useMemo(
    () => calculateTotalMonsterXP(selectedMonsters),
    [selectedMonsters]
  );

  const monsterCount = useMemo(
    () => calculateMonsterCount(selectedMonsters),
    [selectedMonsters]
  );

  const difficultyMultiplier = useMemo(
      () => calculateDifficultyMultiplier(monsterCount, filter.playerLevels.length),
    [monsterCount, filter.playerLevels.length]
  );

   const effectiveXP = Math.round(totalMonsterXP * difficultyMultiplier);

    // Dropdown-selected difficulty index — used only for filtering the monster table
   const filterDifficultyIndex = parseInt(filter.difficulty, 10) || 0;

    // Actual difficulty is calculated independently of the dropdown selection.
   const actualDifficultyIndex = useMemo(() => {
      const mediumThreshold = calculateXPThreshold(filter.playerLevels, 1);
      return calculateDifficultyIndex(effectiveXP, mediumThreshold);
    }, [effectiveXP, filter.playerLevels]);

    const filteredMonsters = useMemo(
        () => {
         // Ensure selected monsters always appear in the table, even if they don't match current filters
        const result = filterMonsters(monsters, {
          searchQuery,
          environmentFilter: filter.environment,
          typeFilter: filter.type,
          sizeFilter: filter.size,
          crMin: filter.crMin,
          crMax: filter.crMax,
        });
        for (const sm of selectedMonsters) {
          if (!result.some(m => m.index === sm.index)) {
            const full = (monsters || []).find(m => m.index === sm.index);
            if (full) result.unshift(full);
            }
           }

        result.sort((a, b) => compareMonsters(a, b, sortField, sortDirection, selectedMonsters));
        return result;
        },
        [monsters, searchQuery, filter.environment, filter.type, filter.size, filter.crMin, filter.crMax, selectedMonsters, sortField, sortDirection]
    );

  // --- Handlers ---
  const handleToggleMonster = (monster) => {
    setSelectedMonsters(prev => toggleMonster(prev, monster));
  };

  const handleIncreaseQty = (index) => {
    setSelectedMonsters(prev => updateQty(prev, index, 1));
  };

  const handleDecreaseQty = (index) => {
    setSelectedMonsters(prev => updateQty(prev, index, -1));
  };

  const handleRemoveMonster = (index) => {
    setSelectedMonsters(prev => prev.filter(m => m.index !== index));
  };

  const handleClearMonsters = () => {
   setSelectedMonsters([]);
  };

  const handleJoinEncounter = async () => {
    if (!selectedMonsters.length) return;

    const monsterLabels = selectedMonsters.map(m => `${m.qty || 1}x ${m.name}`);

    try {
      await addMonstersToInitiative(selectedMonsters, characters, campaignName);
    } catch (error) {
      // The join never reached the board — say so loudly and log NOTHING:
      // a pre-written `joined` row here left the durable campaign log
      // claiming an encounter join that never happened (log/board divergence).
      console.error('Failed to join encounter:', error);
      showToast('Failed to join encounter', true);
      return;
    }

    // Board accepted the creatures — only now is the join true.
    logEntry({
      type: 'encounter',
      action: 'joined',
      encounterName: encounterTitle || currentEncounterName || 'Unnamed Encounter',
      monsters: monsterLabels,
    });

    setSelectedMonsters([]);
    setDescription('');

    if (onJoinEncounter) {
      onJoinEncounter();
    }
  };

  const handleSaveEncounter = async () => {
    if (!selectedMonsters.length) {
      setSaveError('Encounter has no monsters to save');
      return;
    }
    const data = {
      selectedMonsters: stripMonsters(selectedMonsters),
      description: description,
      effectiveXP,
      };
    if (currentEncounterName) {
      // Named native confirm before overwriting durable campaign data — house
      // canon for destructive/durable mutations (row delete: EncounterModal.jsx:68
      // `Delete "X"?`; level-change, character/map deletes all confirm). The
      // toolbar button IS the click point for this lane (no leaf modal), so the
      // confirm lives here. Cancel = zero network, draft + disk untouched.
      if (!window.confirm(`Overwrite encounter "${formatEncounterName(currentEncounterName)}"? This replaces the saved encounter.`)) {
        return;
      }
      try {
        await updateEncounter(currentEncounterName, data);
        showToast('Encounter updated');
      } catch (error) {
        // No console.error here — the service owns the single log line
        // (c5d784d1f delete-lane fingerprint: 1 service, 0 wrappers).
        if (error.status === 404) {
          // Row deleted elsewhere since Load: name the encounter in the copy,
          // detach the stale name (toolbar Save flips back to create mode;
          // `Reset` is no longer the only recovery), and route the surviving
          // draft straight into the create-name modal so one save lands a
          // fresh row.
          const missingName = formatEncounterName(currentEncounterName);
          setCurrentEncounterName(null);
          setEncounterTitle('Encounter Builder');
          setPendingEncounterData(data);
          openSaveModal();
          showToast(`Could not update "${missingName}" — it no longer exists. Save it as a new encounter.`, true);
        } else {
          showToast('Failed to save encounter', true);
        }
      }
    } else {
      setPendingEncounterData(data);
      openSaveModal();
    }
  };

  const handleModalSave = async (name) => {
    if (pendingEncounterData) {
      try {
        await saveEncounter(name, pendingEncounterData);
        setCurrentEncounterName(name);
        setEncounterTitle(formatEncounterName(name));
        setPendingEncounterData(null);
        showToast('Encounter saved');
      } catch (error) {
        console.error('Failed to save encounter:', error);
        showToast('Failed to save encounter', true);
      }
    }
  };

  const handleLoadEncounter = async (name) => {
   try {
     const data = await loadEncounterData(name);
     if (data) {
      setEncounterTitle(formatEncounterName(name));
      setCurrentEncounterName(name);

      setDescription(data.description || '');

      const monsterRefs = data.selectedMonsters || [];
       const resolvedMonsters = resolveMonsterRefs(monsterRefs, monsters);

       setSelectedMonsters(resolvedMonsters);

       if (monsterRefs.length > 0 && monsters.length > 0) {
         const totalXP = monsterRefs.reduce((sum, ref) => {
           const full = (monsters || []).find(m => m.index === ref.index);
           return sum + ((full?.xp || ref.xp || 0) * (ref.qty || 1));
         }, 0);
         const mult = calculateDifficultyMultiplier(
           monsterRefs.reduce((s, r) => s + (r.qty || 1), 0),
           filter.playerLevels.length
         );
         const effectiveXP = Math.round(totalXP * mult);
         if (data.effectiveXP !== effectiveXP) {
           // Clone-at-seam: mutate a clone, never the object resolved by
           // loadEncounterData — on PUT failure or unmount the caller's copy
           // must stay honest (server/disk is truth, re-read via the next
           // loadEncounterData GET). Sibling idiom: cloneDeep-before-persist
           // at encounterToInitiative.js:137/:247 and monsterShapeShift.js:164.
           const payload = cloneDeep(data);
           payload.effectiveXP = effectiveXP;
           updateEncounter(name, payload);
         }
       }

        showToast('Encounter loaded');

         }
       } catch (error) {
      console.error('Failed to load encounter:', error);
      showToast('Failed to load encounter', true);
     }
       };

   const logEntry = async (entry) => {
     try { await addEntry(campaignName, entry); } catch { /* ignore */ }
   };

  const handleApplySuggestion = (monsters) => {
    // Replacement feedback only when a draft actually existed — an empty draft
    // is not "replaced" (matches Save-lane honesty; toast is display-only).
    if (selectedMonsters.length > 0) {
      showToast('Draft replaced by generator');
    }
    setSelectedMonsters(monsters);
    };

  // AI refine (campaign-authoring Phase 6 residual): the proposal lands in the
  // working draft ONLY — nothing persists here. The toolbar Update button
  // (updateEncounter lane) stays the single path to disk, exactly like the
  // generator's handleApplySuggestion above. The row keeps its loaded name —
  // renaming belongs to the rename lane, not a proposal side effect.
  const handleAiRefineApply = (replacement) => {
    const next = refinedEncounterToState(replacement, monsters);
    setDescription(next.description);
    setSelectedMonsters(next.selectedMonsters);
    showToast('AI proposal applied — press Update to save');
  };

  const handleReset = () => {
    setEncounterTitle('Encounter Builder');
    setCurrentEncounterName(null);
    setPendingEncounterData(null);
       setFilter({
         difficulty: ENCOUNTER_CONFIG.defaultDifficulty,
        playerLevels: (characters && characters.length > 0)
               ? characters.map(c => c.level || 1)
               : [1],
        environment: '',
        type: '',
        size: '',
        crMin: '',
        crMax: '',
           });
    setSelectedMonsters([]);
    setSearchQuery('');
    setDescription('');
    };

  // Fix#410: no confirm here — the leaf EncounterModal owns the single delete
  // prompt (:55, formatted display name). This is a straight dispatcher, mirroring
  // handleRenameEncounter below; confirming at both layers stacked two dialogs
  // per click. House pattern: leaf components confirm at the click point
  // (Notes, Factions, Sessions, Quests, Settlements, NPCs, PartyInventory, CharSummary).
  const handleDeleteEncounter = async (name) => {
    await deleteEncounterAction(name);
  };

  const handleRenameEncounter = async (oldName, newName) => {
    // Backlog 2026-10-28-T: rename success was the only silent lane — save/load/
    // update/404 all toast. renameEncounterAction reloads the list before
    // resolving and throws on non-2xx/network failure, so a resolved await here
    // is a true success (same ownership contract as the save lane); failures
    // pass through untouched to the leaf modal's inline error (EncounterModal.jsx).
    await renameEncounterAction(oldName, newName);
    showToast('Encounter renamed');
  };

  const handleDifficultyChange = (e) => {
    setFilter(prev => ({ ...prev, difficulty: parseInt(e.target.value, 10) }));
   };

  const handleEnvironmentChange = (e) => {
    setFilter(prev => ({ ...prev, environment: e.target.value }));
   };

  const handleTypeChange = (value) => {
    setFilter(prev => ({ ...prev, type: value }));
  };

  const handleSizeChange = (value) => {
    setFilter(prev => ({ ...prev, size: value }));
  };

  const handleCRMinChange = (value) => {
    setFilter(prev => ({ ...prev, crMin: value }));
  };

  const handleCRMaxChange = (value) => {
    setFilter(prev => ({ ...prev, crMax: value }));
  };

  const handleAddPlayer = () => {
    setFilter(prev => ({ ...prev, playerLevels: [...prev.playerLevels, 1] }));
  };

  const handleRemovePlayer = (index) => {
    setFilter(prev => {
      const updated = prev.playerLevels.filter((_, i) => i !== index);
      return updated.length > 0 ? { ...prev, playerLevels: updated } : prev;
    });
  };

  const handlePlayerLevelChange = (index, value) => {
    setFilter(prev => {
      const updated = [...prev.playerLevels];
      updated[index] = parseInt(value, 10) || 1;
      return { ...prev, playerLevels: updated };
    });
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="encounter-builder">
        <div className="encounter-header-row">
          <h2 className="encounter-title">Encounter Builder</h2>
        </div>
        <div className="encounter-loading">
          <i className="fa-solid fa-spinner fa-spin"></i>&nbsp; Loading monsters...
        </div>
      </div>
    );
  }

  return (
    <div className="encounter-builder">
      <div className="encounter-header-row">
        <h2 className="encounter-title">
          <i className="fa-solid fa-dragon"></i>&nbsp; {encounterTitle}
        </h2>

        {/* Save/Load/Generate/Reset Buttons */}
        <div className="encounter-actions">
          <button
            className="encounter-btn encounter-btn-secondary"
            onClick={handleSaveEncounter}
            aria-label="Save encounter"
            title={currentEncounterName ? 'Update encounter' : 'Save encounter'}
          >
            <i className="fa-solid fa-floppy-disk" /> {currentEncounterName ? 'Update' : 'Save'}
          </button>
          <button
            className="encounter-btn encounter-btn-secondary"
            onClick={openLoadModal}
            aria-label="Load encounter"
            title="Load encounter"
          >
            <i className="fa-solid fa-folder-open" /> Load
          </button>
          <button
            className="encounter-btn encounter-btn-generate"
            onClick={() => setShowGenerator(true)}
            aria-label="Generate encounter"
            title="Generate encounter from environments"
          >
            <i className="fa-solid fa-wand-magic-sparkles" /> Generate
          </button>
              {currentEncounterName && (
               <button
               className="encounter-btn encounter-btn-secondary"
               onClick={handleReset}
               aria-label="Reset encounter"
               title="Reset to blank"
               >
                 <i className="fa-solid fa-rotate-left" /> Reset
                </button>
              )}
              {/* Saved-encounter editing surface only — an unnamed draft has no
                  row to refine (server lane: POST .../ai/refine/encounter). */}
              <EncounterAiRefine
                campaignName={campaignName}
                encounterName={currentEncounterName}
                description={description}
                selectedMonsters={selectedMonsters}
                onApplied={handleAiRefineApply}
              />
           </div>
         </div>

      <EncounterValidationBanner message={saveError} />

      {toast && (
        <div className={`encounter-toast${toast.isError ? ' encounter-toast-error' : ''}`} role="status">
          {toast.message}
        </div>
      )}

        {/* Party Composition Summary */}
      {characters && characters.length > 0 && (
        <div className="party-summary">
          <span className="party-summary-label">
            <i className="fa-solid fa-users"></i>&nbsp; Party
          </span>
          {characters.map((c, i) => (
            <span key={i} className="party-member-tag">
              {c.name}
              <span className="party-member-level">Lv{c.level || 1}</span>
            </span>
          ))}
        </div>
      )}
      {(!characters || characters.length === 0) && (
        <div className="party-summary" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          No characters in this campaign. Add characters to auto-populate party levels.
        </div>
      )}

       {/* Encounter Description */}
      <div className="encounter-description-section">
        <PreviewToggle
         id="encounter-description"
         value={description}
         onChange={setDescription}
         placeholder="Describe this encounter..."
         label="Description"
         minHeight="100px"
        />
      </div>

        {/* Join Encounter Button */}
      {selectedMonsters.length > 0 && (
        <div className="encounter-join-section">
          <button
            className="encounter-btn encounter-btn-join"
            onClick={handleJoinEncounter}
            title="Add monsters to initiative and navigate to combat"
          >
              <i className="fa-solid fa-skull"></i>Join Encounter
          </button>
        </div>
      )}

      {/* Top Row: Filters + Summary */}
      <div className="encounter-top-row">
          <EncounterFilterPanel
           filter={{
              ...filter,
             totalThreshold,
              difficultyIndex: filterDifficultyIndex,
             difficultyLabels,
             difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
            }}
           onDifficultyChange={handleDifficultyChange}
           onEnvironmentChange={handleEnvironmentChange}
           environmentOptions={environmentOptions}
           onAddPlayer={handleAddPlayer}
           onRemovePlayer={handleRemovePlayer}
           onPlayerLevelChange={handlePlayerLevelChange}
          />
          <EncounterSummaryPanel
           totalMonsterXP={totalMonsterXP}
           monsterCount={monsterCount}
           difficultyMultiplier={difficultyMultiplier}
           effectiveXP={effectiveXP}
           difficultyIndex={actualDifficultyIndex}
          difficultyLabels={difficultyLabels}
          difficultyColors={['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)']}
          selectedMonsters={selectedMonsters}
          onClearMonsters={handleClearMonsters}
        />
      </div>

         {/* Selected Monsters Detail */}
         <EncounterSelectedMonsters
         selectedMonsters={selectedMonsters}
         onRemoveMonster={handleRemoveMonster}
         onViewDetails={setViewingMonster}
         />

        {/* Monster Selection Table */}
           <EncounterMonsterTable
           filteredMonsters={filteredMonsters}
           selectedMonsters={selectedMonsters}
           onToggleMonster={handleToggleMonster}
           onIncreaseQty={handleIncreaseQty}
           onDecreaseQty={handleDecreaseQty}
           onRemoveMonster={handleRemoveMonster}
           searchQuery={searchQuery}
           onSearchQueryChange={setSearchQuery}
           onSort={handleSort}
           sortField={sortField}
           sortDirection={sortDirection}
           onViewDetails={setViewingMonster}
           showEnvironment={true}
           typeFilter={filter.type}
           onTypeChange={handleTypeChange}
           sizeFilter={filter.size}
           onSizeChange={handleSizeChange}
           crMin={filter.crMin}
           crMax={filter.crMax}
           onCRMinChange={handleCRMinChange}
           onCRMaxChange={handleCRMaxChange}
           />

      {/* Encounter Save/Load Modal */}
      <EncounterModal
        isOpen={modalOpen}
        onClose={closeModal}
        mode={modalMode}
        onSave={handleModalSave}
        onLoad={handleLoadEncounter}
        onDelete={handleDeleteEncounter}
        onRename={handleRenameEncounter}
        encounters={encounters}
        loading={encounterLoading}
      />

      {/* Encounter Generator Modal */}
      {showGenerator && (
        <EncounterGeneratorModal
          monsters={monsters}
          playerLevels={filter.playerLevels}
          difficulty={filter.difficulty}
          targetXP={totalThreshold}
          onApply={handleApplySuggestion}
          onClose={() => setShowGenerator(false)}
        />
      )}

      {/* Monster Card Modal */}
      {viewingMonster && (
        <MonsterCardModal
          monster={viewingMonster}
          onClose={() => setViewingMonster(null)}
          campaignName={campaignName}
          characters={characters}
        />
      )}
    </div>
  );
}

export default EncounterBuilder;
