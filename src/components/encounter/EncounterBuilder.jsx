import { useState, useMemo, useEffect, useRef } from 'react';
import { useMonstersData } from '../../hooks/useMonstersData.js';
import useEncounterManagement from '../../hooks/useEncounterManagement.js';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';
import EncounterMonsterTable from './EncounterMonsterTable.jsx';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';
import EncounterModal from './EncounterModal.jsx';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';
import MonsterCardModal from './MonsterCardModal.jsx';
import PreviewToggle from '../common/PreviewToggle.jsx';
import { formatEncounterName } from '../../services/encountersService.js';
import { loadEncounterToInitiative } from '../../services/encounterToInitiative.js';
import { generateLootSuggestions } from '../../services/lootGenerator.js';
import { calculateXPThreshold, calculateDifficultyMultiplier } from '../../services/encounterGenerator.js';
import { ENCOUNTER_CONFIG } from '../../config/encounterConfig.js';
import storage from '../../services/storage.js';
import * as logService from '../../services/logService.js';
import './EncounterBuilder.css';

const difficultyLabels = ['Easy', 'Medium', 'Hard', 'Deadly'];

// Local helpers not available in the service
function calculateMaxXP(playerLevels, difficultyIndex) {
  return calculateXPThreshold(playerLevels, difficultyIndex) * 1.5;
}

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

function filterMonsters(monsters, searchQuery, playerLevels, difficultyIndex, totalThreshold, environmentFilter) {
  if (!monsters) return [];
  const maxXP = calculateMaxXP(playerLevels, difficultyIndex);
  const minXP = totalThreshold * 0.15;
  return monsters.filter(m => {
    if (m.xp > maxXP) return false;
    if (m.xp < minXP) return false;
    if (environmentFilter && m.environments && !m.environments.includes(environmentFilter)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q)
       || (m.type && m.type.toLowerCase().includes(q))
       || (m.subtype && m.subtype.toLowerCase().includes(q));
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

function saveFilter(filter) {
  try {
    const key = 'encounterFilter-2024';
    localStorage.setItem(key, JSON.stringify({ difficulty: filter.difficulty, environment: filter.environment }));
   } catch { /* storage full, ignore */ }
}

function stripMonsters(monsters) {
  return monsters.map(m => ({
    index: m.index,
    name: m.name,
    qty: m.qty || 1,
  }));
}

function EncounterBuilder({ characters, campaignName, onStartCombat }) {
  const { monsters, loading } = useMonstersData();

  const [filter, setFilter] = useState(() => {
      const saved = loadSavedFilter();
      const playerLevels = (characters && characters.length > 0)
        ? characters.map(c => c.level || 1)
        : (saved ? saved.playerLevels : [1]);
     return {
       difficulty: saved ? saved.difficulty : ENCOUNTER_CONFIG.defaultDifficulty,
       playerLevels,
       environment: saved ? saved.environment : '',
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
  const [viewingMonster, setViewingMonster] = useState(null);
  const [encounterTitle, setEncounterTitle] = useState('Encounter Builder');
  const [currentEncounterName, setCurrentEncounterName] = useState(null);
  const [description, setDescription] = useState('');
  const [lootData, setLootData] = useState({ lootEntries: [], totalEncounterXp: 0 });
   const [generatingLoot, setGeneratingLoot] = useState(false);
   const [encounterCompleted, setEncounterCompleted] = useState(false);
  const [combatStarted, setCombatStarted] = useState(false);

      // GM-only working session persistence (survives unmount when navigating to initiative)
   function saveSession() {
     try {
       localStorage.setItem(`encounterSession-${campaignName}`, JSON.stringify({
         currentEncounterName, description, lootData, combatStarted, encounterCompleted,
         selectedMonsters: stripMonsters(selectedMonsters),
        filter: { difficulty: filter.difficulty, playerLevels: filter.playerLevels },
       encounterTitle,
        }));
       } catch { /* ignore */ }
      }

  function loadSavedSession(existingsMonsters) {
    try {
       const sessionData = localStorage.getItem(`encounterSession-${campaignName}`);
       if (!sessionData) return null;
        const parsed = JSON.parse(sessionData);
        if (parsed && Array.isArray(parsed.selectedMonsters)) {
         return {
           ...parsed,
          selectedMonsters: parsed.selectedMonsters.map(ref => {
             const full = (existingsMonsters || []).find(m => m.index === ref.index);
            return full ? { ...full, qty: ref.qty || 1 } : { ...ref, qty: ref.qty || 1 };
            }),
            };
         }
       } catch { /* ignore */ }
     return null;
       }

// Restore session on mount (resolves monster refs against current monsters data) - only runs when monsters load
   useEffect(() => {
         const session = loadSavedSession(monsters);
        if (!session) return;
        setCurrentEncounterName(session.currentEncounterName || null);
       setDescription(session.description || '');
       setLootData(session.lootData || { lootEntries: [], totalEncounterXp: 0 });
     setCombatStarted(!!session.combatStarted);
         setEncounterCompleted(!!session.encounterCompleted);
         if (session.filter) {
            setFilter({ difficulty: session.filter.difficulty, playerLevels: session.filter.playerLevels || [1], environment: session.filter.environment || '' });
                   }
       if (session.encounterTitle) setEncounterTitle(session.encounterTitle);
          setSelectedMonsters(session.selectedMonsters);
           }, [campaignName, monsters]); // eslint-disable-line react-hooks/exhaustive-deps

// Guard to skip persist effect on initial render - lets restore effect run first
   const persisted = useRef(false);

// Persist working session to localStorage - skips first render, only saves (never auto-clears)
    useEffect(() => {
         if (!persisted.current) {
            persisted.current = true;
           return;
               }

        if (combatStarted && !encounterCompleted && lootData.lootEntries.length > 0) {
             saveSession();
                }
           }, [campaignName, currentEncounterName, description, lootData, combatStarted, encounterCompleted, selectedMonsters, filter, encounterTitle]); // eslint-disable-line react-hooks/exhaustive-deps



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
        const result = filterMonsters(monsters, searchQuery, filter.playerLevels, filter.difficulty, totalThreshold, filter.environment);
        for (const sm of selectedMonsters) {
          if (!result.some(m => m.index === sm.index)) {
            const full = (monsters || []).find(m => m.index === sm.index);
            if (full) result.unshift(full);
            }
           }

        result.sort((a, b) => {
         let valA, valB;
         switch (sortField) {
          case 'name':
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case 'cr':
            valA = a.challenge_rating || 0;
            valB = b.challenge_rating || 0;
            break;
          case 'xp':
            valA = a.xp || 0;
            valB = b.xp || 0;
            break;
          case 'env':
            valA = (a.environments || []).join(', ').toLowerCase();
            valB = (b.environments || []).join(', ').toLowerCase();
            break;
          case 'sel':
            valA = selectedMonsters.some((m) => m.index === a.index) ? 0 : 1;
            valB = selectedMonsters.some((m) => m.index === b.index) ? 0 : 1;
            break;
           default:
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
           }
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
         if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
         return 0;
           });
        return result;
        },
        [monsters, searchQuery, filter.playerLevels, filter.difficulty, totalThreshold, filter.environment, selectedMonsters, sortField, sortDirection]
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

  const handleGenerateLoot = async () => {
    setGeneratingLoot(true);
    try {
      const lootResult = await generateLootSuggestions(selectedMonsters);
      setLootData(lootResult || { lootEntries: [], totalEncounterXp: 0 });
      setEncounterCompleted(false);
      } catch (error) {
      console.error('Failed to generate loot:', error);
      } finally {
      setGeneratingLoot(false);
      }
    };

  const handleSaveEncounter = () => {
    const data = {
      selectedMonsters: stripMonsters(selectedMonsters),
      description: description,
      lootData,
      encounterCompleted,
      };
    if (currentEncounterName) {
      // Update existing encounter — no modal needed
      updateEncounter(currentEncounterName, data);
    } else {
      // New encounter — prompt for name
      setPendingEncounterData(data);
      openSaveModal();
    }
  };

  const handleModalSave = async (name) => {
    if (pendingEncounterData) {
      await saveEncounter(name, pendingEncounterData);
      setCurrentEncounterName(name);
      setEncounterTitle(formatEncounterName(name));
      setPendingEncounterData(null);
    }
  };

  const handleLoadEncounter = async (name) => {
   try {
     const data = await loadEncounterData(name);
     if (data) {
      setEncounterTitle(formatEncounterName(name));
      setCurrentEncounterName(name);

      setDescription(data.description || '');
        setLootData(data.lootData || { lootEntries: [], totalEncounterXp: 0 });
               setEncounterCompleted(false);
               setCombatStarted(false);

         const monsterRefs = data.selectedMonsters || [];
        const resolvedMonsters = monsterRefs.map(ref => {
          const fullMonster = (monsters || []).find(m => m.index === ref.index);
          if (fullMonster) {
            return { ...fullMonster, qty: ref.qty || 1 };
          }
          return { ...ref, qty: ref.qty || 1 };
        });

        setSelectedMonsters(resolvedMonsters);

          }
        } catch (error) {
       console.error('Failed to load encounter:', error);
      }
    };

   const logEntry = async (entry) => {
     try { await logService.addEntry(campaignName, entry); } catch { /* ignore */ }
   };

   const handleStartEncounter = () => {
     if (!selectedMonsters.length) return;

     // Write combatStarted=true directly to localStorage before navigation unmounts the component
     try {
       localStorage.setItem(`encounterSession-${campaignName}`, JSON.stringify({
         currentEncounterName, description, lootData, encounterCompleted,
         combatStarted: true,
         selectedMonsters: stripMonsters(selectedMonsters),
         filter: { difficulty: filter.difficulty, playerLevels: filter.playerLevels, environment: filter.environment },
         encounterTitle,
       }));
     } catch { /* ignore */ }

     logEntry({
       type: 'encounter',
       action: 'started',
       encounterName: encounterTitle || currentEncounterName || 'Unnamed Encounter',
       monsters: selectedMonsters.map(m => `${m.qty || 1}x ${m.name}`),
     });

     setCombatStarted(true);
     loadEncounterToInitiative(selectedMonsters, characters, campaignName);
     onStartCombat();
   };

   const handleCompleteEncounter = async () => {
     const numChars = characters && characters.length > 0 ? characters.length : filter.playerLevels.length;
     const xpPerChar = Math.floor(lootData.totalEncounterXp / numChars);

     if (!window.confirm(`Award ${xpPerChar} XP to each of ${numChars} party members and log the loot?`)) return;

     for (const charData of (characters || [])) {
       const currentXp = storage.getProperty(charData.name, 'xp', campaignName) || 0;
       storage.setProperty(charData.name, 'xp', currentXp + xpPerChar, campaignName);
     }

     await logService.addEntry(campaignName, {
         type: 'loot',
         encounterName: encounterTitle || currentEncounterName || 'Unnamed Encounter',
         lootItems: lootData.lootEntries.filter(item => item !== 'No loot for these monsters'),
         xpPerChar,
         totalEncounterXp: lootData.totalEncounterXp,
     });

     await logEntry({
       type: 'encounter',
       action: 'completed',
       encounterName: encounterTitle || currentEncounterName || 'Unnamed Encounter',
       xpPerChar,
       totalEncounterXp: lootData.totalEncounterXp,
       lootItems: lootData.lootEntries.filter(item => item !== 'No loot for these monsters'),
     });

     setEncounterCompleted(true);
   };

  const handleApplySuggestion = (monsters) => {
    setSelectedMonsters(monsters);
    };

  const handleReset = () => {
    setEncounterTitle('Encounter Builder');
    setCurrentEncounterName(null);
    setPendingEncounterData(null);
     setLootData({ lootEntries: [], totalEncounterXp: 0 });
     setEncounterCompleted(false);
     setCombatStarted(false);
      setFilter({
         difficulty: ENCOUNTER_CONFIG.defaultDifficulty,
        playerLevels: (characters && characters.length > 0)
               ? characters.map(c => c.level || 1)
               : [1],
        environment: '',
           });
    setSelectedMonsters([]);
    setSearchQuery('');
    setDescription('');
    };

  const handleDeleteEncounter = async (name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      await deleteEncounterAction(name);
    }
  };

  const handleRenameEncounter = async (oldName, newName) => {
    await renameEncounterAction(oldName, newName);
  };

  const handleDifficultyChange = (e) => {
    setFilter(prev => ({ ...prev, difficulty: parseInt(e.target.value, 10) }));
   };

  const handleEnvironmentChange = (e) => {
    setFilter(prev => ({ ...prev, environment: e.target.value }));
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
           </div>
         </div>

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
        {selectedMonsters.length > 0 && (
          <button
           className="encounter-btn encounter-btn-loot"
           onClick={handleGenerateLoot}
           disabled={generatingLoot}
           title="Generate loot suggestions for selected monsters"
          >
            <i className="fa-solid fa-coins"></i>&nbsp; {generatingLoot ? 'Generating...' : 'Generate Loot'}
          </button>
        )}
      </div>

        {/* Loot Suggestions + XP */}
        {lootData.lootEntries.length > 0 && (
          <div className="encounter-loot-section">
            <div className="encounter-loot-title">
              <i className="fa-solid fa-gem"></i>&nbsp; Loot Suggestions
              <button
               className="encounter-btn encounter-btn-secondary encounter-btn-sm"
               onClick={() => { setLootData({ lootEntries: [], totalEncounterXp: 0 }); setEncounterCompleted(false); }}
               title="Clear loot suggestions"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <ul className="encounter-loot-list">
              {lootData.lootEntries.map((item, i) => (
                <li key={i} className="encounter-loot-item">{item}</li>
               ))}
            </ul>

            {lootData.totalEncounterXp > 0 && (
              <div className="encounter-xp-summary">
                <span className="encounter-xp-label">
                  <i className="fa-solid fa-star"></i>&nbsp; Encounter XP: {lootData.totalEncounterXp.toLocaleString()} total &middot; {Math.floor(lootData.totalEncounterXp / (characters && characters.length > 0 ? characters.length : filter.playerLevels.length))} per character
                </span>
                  {!combatStarted && !encounterCompleted && selectedMonsters.length > 0 && (
                    <button
                    className="encounter-btn encounter-btn-complete"
                    onClick={handleStartEncounter}
                    title="Roll initiative and start combat"
                    disabled={lootData.lootEntries.length === 0}
                    >
                        <i className="fa-solid fa-skull"></i>Start Encounter
                    </button>
                    )}
                  {combatStarted && !encounterCompleted && (
                    <button
                    className="encounter-btn encounter-btn-complete"
                    onClick={handleCompleteEncounter}
                    title="Award XP to party and log loot"
                    >
                         <i className="fa-solid fa-trophy"></i>Complete Encounter
                    </button>
                    )}
                {encounterCompleted && (
                  <span className="encounter-xp-complete">
                    <i className="fa-solid fa-check-circle"></i> XP Awarded
                  </span>
                  )}
              </div>
            )}
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
        />
      )}
    </div>
  );
}

export default EncounterBuilder;
