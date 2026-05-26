import './EncounterBuilder.css';

function EncounterFilterPanel({
  filter,
  onDifficultyChange,
  onAddPlayer,
  onRemovePlayer,
  onPlayerLevelChange,
}) {
  const { difficulty, playerLevels, totalThreshold, difficultyIndex, difficultyLabels, difficultyColors } = filter;

  const thresholdColor = difficultyColors && difficultyColors[difficultyIndex]
    ? difficultyColors[difficultyIndex]
    : 'var(--color-text)';
  const difficultyLabel = difficultyLabels && difficultyLabels[difficultyIndex]
    ? difficultyLabels[difficultyIndex]
    : 'Unknown';

  return (
    <div className="encounter-filters">
      {/* Difficulty Dropdown */}
      <div>
        <label className="encounter-label" htmlFor="difficulty-select">Difficulty</label>
        <select
          id="difficulty-select"
          className="encounter-select"
          value={difficulty}
          onChange={onDifficultyChange}
        >
          <option value={0}>Easy</option>
          <option value={1}>Medium</option>
          <option value={2}>Hard</option>
          <option value={3}>Deadly</option>
        </select>
      </div>

      {/* Player Levels */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span className="encounter-label" style={{ marginBottom: 0 }}>Party</span>
          <button
            type="button"
            className="encounter-btn"
            onClick={onAddPlayer}
            aria-label="Add player"
          >
            <i className="fa-solid fa-plus" /> Add Player
          </button>
        </div>
        <div className="player-levels">
          {playerLevels.map((level, index) => (
            <div key={index} className="player-level-row">
              <label className="player-level-label" htmlFor={`player-level-${index}`}>
                PC {index + 1}
              </label>
              <input
                id={`player-level-${index}`}
                type="number"
                className="player-level-input"
                min={1}
                max={20}
                value={level}
                onChange={(e) => onPlayerLevelChange(index, Number(e.target.value))}
              />
              <button
                type="button"
                className="player-level-remove"
                disabled={playerLevels.length <= 1}
                onClick={() => onRemovePlayer(index)}
                aria-label={`Remove player ${index + 1}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Target Threshold Display */}
      <div className="threshold-display" style={{ borderLeftColor: thresholdColor }}>
        Target: <strong>{totalThreshold.toLocaleString()} XP</strong> ({difficultyLabel})
      </div>
    </div>
  );
}

export default EncounterFilterPanel;
