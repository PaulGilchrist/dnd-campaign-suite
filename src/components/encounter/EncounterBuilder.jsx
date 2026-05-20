import { useState, useMemo, useEffect } from 'react';
import { useMonstersData } from '../../hooks/useMonstersData.js';
import EncounterFilterPanel from './EncounterFilterPanel.jsx';
import EncounterSummaryPanel from './EncounterSummaryPanel.jsx';
import EncounterMonsterTable from './EncounterMonsterTable.jsx';
import EncounterSelectedMonsters from './EncounterSelectedMonsters.jsx';
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

function filterMonsters(monsters, searchQuery, playerLevels, difficultyIndex) {
  if (!monsters) return [];
  const maxXP = calculateMaxXP(playerLevels, difficultyIndex);
  return monsters.filter(m => {
    if (m.xp > maxXP) return false;
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
    ).filter(m => (m.qty || 1) > 0);
  }
  return [...selected, { ...monster, qty: 1 }];
}

function updateQty(selected, index, delta) {
  return selected.map(m =>
    m.index === index ? { ...m, qty: (m.qty || 1) + delta } : m
  ).filter(m => (m.qty || 1) > 0);
}

// --- Determine majority ruleset from characters ---
function inferRuleset(characters) {
  if (!characters || characters.length === 0) return '5e';
  const counts = { '5e': 0, '2024': 0 };
  characters.forEach(c => {
    if (c.rules === '2024') counts['2024']++;
    else counts['5e']++;
  });
  return counts['2024'] > counts['5e'] ? '2024' : '5e';
}

// --- Load saved filter from localStorage ---
function loadSavedFilter(rulesVersion) {
  try {
    const key = `encounterFilter-${rulesVersion}`;
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

function saveFilter(filter, rulesVersion) {
  try {
    const key = `encounterFilter-${rulesVersion}`;
    localStorage.setItem(key, JSON.stringify({ difficulty: filter.difficulty }));
  } catch { /* storage full, ignore */ }
}

function EncounterBuilder({ characters, campaignName }) {
  // Infer initial ruleset from characters
  const [rulesVersion, setRulesVersion] = useState(() => inferRuleset(characters));

  // Load monsters for the selected ruleset
  const { monsters, loading } = useMonstersData(rulesVersion);

  // Initialize filter: difficulty from localStorage, player levels from characters
  const [filter, setFilter] = useState(() => {
    const saved = loadSavedFilter(rulesVersion);
    const playerLevels = (characters && characters.length > 0)
      ? characters.map(c => c.level || 1)
      : (saved ? saved.playerLevels : [1]);
    return {
      difficulty: saved ? saved.difficulty : 2, // default: Hard
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
    saveFilter(filter, rulesVersion);
  }, [filter.difficulty, rulesVersion]);

  // Reset selected monsters when rules change
  const [selectedMonsters, setSelectedMonsters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSelectedMonsters([]);
    setSearchQuery('');
  }, [rulesVersion]);

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

  const effectiveXP = Math.round(totalMonsterXP / (difficultyMultiplier || 1));

  const difficultyIndex = useMemo(
    () => calculateDifficultyIndex(effectiveXP, totalThreshold),
    [effectiveXP, totalThreshold]
  );

  const filteredMonsters = useMemo(
    () => filterMonsters(monsters, searchQuery, filter.playerLevels, filter.difficulty),
    [monsters, searchQuery, filter.playerLevels, filter.difficulty]
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

  const handleRulesVersionChange = (version) => {
    setRulesVersion(version);
    setFilter(prev => {
      const saved = loadSavedFilter(version);
      return {
        difficulty: saved ? saved.difficulty : prev.difficulty,
        playerLevels: prev.playerLevels,
      };
    });
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="encounter-builder">
        <div className="encounter-header-row">
          <h2 className="encounter-title">Encounter Builder</h2>
          <div className="ruleset-toggle"></div>
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
          <i className="fa-solid fa-dragon"></i>&nbsp; Encounter Builder
        </h2>

        {/* Ruleset Toggle */}
        <div className="ruleset-toggle">
          <button
            className={`ruleset-btn${rulesVersion === '5e' ? ' ruleset-btn-active' : ''}`}
            onClick={() => handleRulesVersionChange('5e')}
          >
            5e
          </button>
          <button
            className={`ruleset-btn${rulesVersion === '2024' ? ' ruleset-btn-active' : ''}`}
            onClick={() => handleRulesVersionChange('2024')}
          >
            2024
          </button>
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
      />

      {/* Selected Monsters Detail */}
      <EncounterSelectedMonsters
        selectedMonsters={selectedMonsters}
        onRemoveMonster={handleRemoveMonster}
      />
    </div>
  );
}

export default EncounterBuilder;
