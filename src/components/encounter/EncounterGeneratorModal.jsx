import { useState, useMemo } from 'react';
import { generateEncounterSuggestions } from '../../services/encounterGenerator.js';
import './EncounterGeneratorModal.css';

const ENVIRONMENT_GROUPS = [
  { label: 'Arctic', environments: ['arctic', 'mountain'] },
  { label: 'Temperate', environments: ['forest', 'grassland', 'hill'] },
  { label: 'Wetlands', environments: ['swamp', 'coastal'] },
  { label: 'Desert', environments: ['desert'] },
  { label: 'Underground', environments: ['underdark'] },
  { label: 'Aquatic', environments: ['underwater'] },
  { label: 'Urban', environments: ['urban'] },
];

const QUICK_PICKS = [
  { label: 'All', environments: ['arctic', 'coastal', 'desert', 'forest', 'grassland', 'hill', 'mountain', 'swamp', 'underdark', 'underwater', 'urban'] },
  { label: 'Dungeon', environments: ['underdark', 'urban'] },
  { label: 'Wilderness', environments: ['forest', 'grassland', 'hill', 'mountain'] },
];

function EncounterGeneratorModal({ monsters, playerLevels, difficulty, onApply, onClose }) {
  const [selectedEnvs, setSelectedEnvs] = useState(() => {
    const all = ENVIRONMENT_GROUPS.flatMap(g => g.environments);
    return new Set(all);
  });
  const [suggestions, setSuggestions] = useState([]);
  const [generating, setGenerating] = useState(false);

  const toggleEnv = (env) => {
    setSelectedEnvs(prev => {
      const next = new Set(prev);
      if (next.has(env)) next.delete(env);
      else next.add(env);
      return next;
    });
  };

  const setEnvironments = (envs) => {
    setSelectedEnvs(new Set(envs));
  };

  const availableCount = useMemo(() => {
    if (!monsters) return 0;
    const selected = [...selectedEnvs];
    return monsters.filter(m => m.environments && m.environments.some(e => selected.includes(e))).length;
  }, [monsters, selectedEnvs]);

  const handleGenerate = () => {
    setGenerating(true);
    const partySize = playerLevels.length;

    // Run synchronously — the service is pure logic
    const results = generateEncounterSuggestions({
      monsters,
      playerLevels,
      difficulty,
      environments: [...selectedEnvs],
      count: 3,
    });

    setSuggestions(results);
    setGenerating(false);
  };

  const handleApply = (suggestion) => {
    onApply(suggestion.monsters);
    onClose();
  };

  const diffClass = (label) => {
    if (label === 'Easy') return 'gen-suggestion-diff-easy';
    if (label === 'Medium') return 'gen-suggestion-diff-medium';
    if (label === 'Hard') return 'gen-suggestion-diff-hard';
    return 'gen-suggestion-diff-deadly';
  };

  return (
    <div className="encounter-modal-overlay gen-modal-overlay" onClick={onClose}>
      <div className="encounter-modal gen-modal" onClick={e => e.stopPropagation()}>
        <div className="encounter-modal-header">
          <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Generate Encounter</h3>
          <button className="encounter-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="encounter-modal-body">
          <div className="gen-section">
            <label className="gen-section-label">Environments</label>
            <div className="gen-quick-picks">
              {QUICK_PICKS.map(p => (
                <button
                  key={p.label}
                  className="gen-quick-btn"
                  onClick={() => setEnvironments(p.environments)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="gen-env-groups">
              {ENVIRONMENT_GROUPS.map(group => {
                const allSelected = group.environments.every(e => selectedEnvs.has(e));
                const someSelected = group.environments.some(e => selectedEnvs.has(e));
                return (
                  <div key={group.label} className="gen-env-group">
                    <div className="gen-env-group-label">{group.label}</div>
                    {group.environments.map(env => (
                      <label key={env} className="gen-env-item">
                        <input
                          type="checkbox"
                          checked={selectedEnvs.has(env)}
                          onChange={() => toggleEnv(env)}
                        />
                        <span>{env}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="gen-env-count">
              {availableCount} monster{availableCount !== 1 ? 's' : ''} available
            </div>
          </div>

          <div className="gen-actions">
            <button
              className="encounter-btn gen-generate-btn"
              onClick={handleGenerate}
              disabled={generating || availableCount === 0 || playerLevels.length === 0}
            >
              {generating ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
              ) : (
                <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate</>
              )}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="gen-results">
              <label className="gen-section-label">Suggestions</label>
              <div className="gen-note">
                Max {playerLevels.length} monster{playerLevels.length !== 1 ? 's' : ''} (one per PC)
              </div>
              {suggestions.map((s, i) => (
                <div key={i} className="gen-suggestion">
                  <div className="gen-suggestion-header">
                    <span className={`gen-suggestion-diff ${diffClass(s.difficultyLabel)}`}>
                      {s.difficultyLabel}
                    </span>
                    <span className="gen-suggestion-xp">
                      {s.totalXP.toLocaleString()} XP &middot; {s.monsterCount} monster{s.monsterCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="gen-suggestion-list">
                    {s.monsters.map(m => (
                      <li key={m.index} className="gen-suggestion-item">
                        <span className="gen-suggestion-mname">{m.name}</span>
                        <span className="gen-suggestion-mcr">CR {m.challenge_rating}</span>
                        <span className="gen-suggestion-mqty">&times;{m.qty}</span>
                        <span className="gen-suggestion-mxp">{m.xp.toLocaleString()} XP</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="encounter-btn gen-apply-btn"
                    onClick={() => handleApply(s)}
                  >
                    <i className="fa-solid fa-check"></i> Apply
                  </button>
                </div>
              ))}
            </div>
          )}

          {suggestions.length === 0 && !generating && (
            <div className="gen-empty">
              <i className="fa-solid fa-dice-d6"></i> Pick environments and click Generate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EncounterGeneratorModal;
