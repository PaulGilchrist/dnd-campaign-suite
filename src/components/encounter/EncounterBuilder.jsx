import { useState, useMemo, useEffect } from 'react';
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
import './EncounterBuilder.css';

// XP thresholds per level [Easy, Medium, Hard, Deadly] for levels 0-20
const xpThresholds = [
  [15, 25, 40, 50], [25, 50, 75, 100], [50, 100, 150, 200],
  [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]
];

const difficultyLabels = ['Easy', 'Medium', 'Hard', 'Deadly'];

// --- Pure calculation functions (extracted for testability) ---

function calculateXPThreshold(playerLevels, difficultyIndex) {
  return playerLevels.reduce((sum, level) => {
    const idx = parseInt(level, 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 20) {
      return sum + (xpThresholds[idx][difficultyIndex] || 0);
    }
    return sum;
  }, 0);
}

function calculateMaxXP(playerLevels, difficultyIndex) {
  return calculateXPThreshold(playerLevels, difficultyIndex) * 2;
}

function calculateDifficultyMultiplier(monsterCount) {
  if (monsterCount <= 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
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

function filterMonsters(monsters, searchQuery, playerLevels, difficultyIndex, totalThreshold) {
  if (!monsters) return [];
  const maxXP = calculateMaxXP(playerLevels, difficultyIndex);
  const avgLevel = playerLevels.reduce((sum, l) => sum + l, 0) / playerLevels.length;
  const minCRMultipliers = [0.25, 0.35, 0.45, 0.55];
  const minCR = avgLevel * (minCRMultipliers[difficultyIndex] ?? 0.25);
  const minXP = totalThreshold * 0.2;
  return monsters.filter(m => {
    if (m.xp > maxXP) return false;
    if (m.xp < minXP) return false;
    if ((m.challenge_rating ?? 0) < minCR) return false;
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
    localStorage.setItem(key, JSON.stringify({ difficulty: filter.difficulty }));
  } catch { /* storage full, ignore */ }
}

function stripMonsters(monsters) {
  return monsters.map(m => ({
    index: m.index,
    name: m.name,
    qty: m.qty || 1,
  }));
}

function EncounterBuilder({ characters, campaignName }) {
  const { monsters, loading } = useMonstersData();

  const [filter, setFilter] = useState(() => {
    const saved = loadSavedFilter();
    const playerLevels = (characters && characters.length > 0)
      ? characters.map(c => c.level || 1)
      : (saved ? saved.playerLevels : [1]);
    return {
      difficulty: saved ? saved.difficulty : 2,
      playerLevels,
    };
  });

  // When characters change (e.g., campaign switch), update player levels
  useEffect(() => {
    if (characters && characters.length > 0) {
      setFilter(prev => ({
        ...prev,
        playerLevels: characters.map(c => c.level || 1),
      }));
    }
  }, [characters]);

  // Save difficulty to localStorage when it changes
  useEffect(() => {
    saveFilter(filter);
  }, [filter.difficulty]);

  const [selectedMonsters, setSelectedMonsters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Encounter save/load
  const {
    modalOpen,
    modalMode,
    encounters,
    loading: encounterLoading,
    loadEncounterList,
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
    () => calculateDifficultyMultiplier(monsterCount),
    [monsterCount]
  );

  const effectiveXP = Math.round(totalMonsterXP * difficultyMultiplier);

  const difficultyIndex = useMemo(
    () => calculateDifficultyIndex(effectiveXP, totalThreshold),
    [effectiveXP, totalThreshold]
  );

  const filteredMonsters = useMemo(
    () => {
      const result = filterMonsters(monsters, searchQuery, filter.playerLevels, filter.difficulty, totalThreshold);
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
    [monsters, searchQuery, filter.playerLevels, filter.difficulty, totalThreshold, sortField, sortDirection]
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

  const handleSaveEncounter = () => {
    const data = {
      difficulty: filter.difficulty,
      playerLevels: filter.playerLevels,
      selectedMonsters: stripMonsters(selectedMonsters),
      description: description,
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

        setFilter({
          difficulty: data.difficulty ?? 2,
          playerLevels: data.playerLevels || [1],
        });
        setDescription(data.description || '');

        const monsterRefs = data.selectedMonsters || [];
        const resolvedMonsters = monsterRefs.map(ref => {
          const fullMonster = (monsters || []).find(m => m.index === ref.index);
          if (fullMonster) {
            return { ...fullMonster, qty: ref.qty || 1 };
          }
          return { ...ref, qty: ref.qty || 1 };
        });

        setSelectedMonsters(resolvedMonsters);
        setTimeout(() => {
          setSelectedMonsters(resolvedMonsters);
        }, 0);
      }
    } catch (error) {
      console.error('Failed to load encounter:', error);
    }
  };

  const handleApplySuggestion = (monsters) => {
    setSelectedMonsters(monsters);
  };

  const handleReset = () => {
    setEncounterTitle('Encounter Builder');
    setCurrentEncounterName(null);
    setPendingEncounterData(null);
    setFilter({
      difficulty: 2,
      playerLevels: (characters && characters.length > 0)
        ? characters.map(c => c.level || 1)
        : [1],
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
      </div>

      {/* Top Row: Filters + Summary */}
      <div className="encounter-top-row">
        <EncounterFilterPanel
          filter={{
            ...filter,
            totalThreshold,
            difficultyIndex,
            difficultyLabels,
            difficultyColors: ['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)'],
          }}
          onDifficultyChange={handleDifficultyChange}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={handleRemovePlayer}
          onPlayerLevelChange={handlePlayerLevelChange}
        />
        <EncounterSummaryPanel
          totalMonsterXP={totalMonsterXP}
          monsterCount={monsterCount}
          difficultyMultiplier={difficultyMultiplier}
          effectiveXP={effectiveXP}
          difficultyIndex={difficultyIndex}
          difficultyLabels={difficultyLabels}
          difficultyColors={['var(--color-success)', 'var(--color-warning)', '#fd7e14', 'var(--color-error)']}
          selectedMonsters={selectedMonsters}
          onClearMonsters={handleClearMonsters}
        />
      </div>

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
      />

      {/* Selected Monsters Detail */}
      <EncounterSelectedMonsters
        selectedMonsters={selectedMonsters}
        onRemoveMonster={handleRemoveMonster}
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
