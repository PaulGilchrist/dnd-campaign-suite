
export function MonsterEvasionModal({ evasionSelection, setEvasionSelection, creatures, monsterName, handleEvasionConfirm, handleEvasionSkip }) {
  return (
    <div className="mc-overlay mc-overlay--evasion">
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-shield-halved"></i> Leading Evasion — Choose Allies
        </div>
        <div className="sp-body">
          <p>Which creatures should benefit from <strong>Leading Evasion</strong>?</p>
          <p className="sp-note">Select all allies within 5 feet of the Bard. On a successful save, selected allies take no damage. On a failure, they take half damage.</p>
          <div className="secondary-target-list">
            {(creatures || []).filter(c => c.name !== monsterName).map((creature, i) => {
              const isSelected = evasionSelection.includes(creature.name);
              return (
                <label
                  key={i}
                  className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                  onClick={() => {
                    const currentSelection = evasionSelection;
                    const isSelected = currentSelection.includes(creature.name);
                    setEvasionSelection(
                      isSelected
                        ? currentSelection.filter(n => n !== creature.name)
                        : [...currentSelection, creature.name]
                    );
                  }}
                >
                  <input
                    type="checkbox"
                    checked={evasionSelection.includes(creature.name)}
                    onChange={() => {}}
                  />
                  <span className="secondary-target-name">
                    <strong>{creature.name}</strong>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="sp-actions">
          <button
            className="sp-roll-btn"
            onClick={() => handleEvasionConfirm(evasionSelection)}
            disabled={evasionSelection.length === 0}
            type="button"
          >
            <i className="fa-solid fa-shield-halved"></i> Apply Evasion ({evasionSelection.length})
          </button>
          <button className="sp-dismiss-btn" onClick={handleEvasionSkip} type="button">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
