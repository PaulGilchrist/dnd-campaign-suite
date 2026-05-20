import React from 'react';
import './EncounterBuilder.css';

function EncounterMonsterTable({
  filteredMonsters,
  selectedMonsters,
  onToggleMonster,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveMonster,
  searchQuery,
  onSearchQueryChange,
}) {
  const isSelected = (monsterIndex) => {
    return selectedMonsters.some((m) => m.index === monsterIndex);
  };

  const getQty = (monsterIndex) => {
    const found = selectedMonsters.find((m) => m.index === monsterIndex);
    return found ? found.qty : 0;
  };

  return (
    <div className="encounter-monster-table-section">
      {/* Search Input */}
      <div className="search-row">
        <i className="fa-solid fa-search search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, type, or subtype..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          aria-label="Search monsters"
        />
      </div>

      {/* Monster Table */}
      {filteredMonsters.length > 0 ? (
        <div className="monster-table-wrapper">
          <table className="monster-table">
            <thead>
              <tr>
                <th className="col-check">Sel</th>
                <th className="col-name">Monster</th>
                <th className="col-cr">CR</th>
                <th className="col-xp">XP</th>
                <th className="col-qty">Qty</th>
                <th className="col-remove" />
              </tr>
            </thead>
            <tbody>
              {filteredMonsters.map((monster) => {
                const selected = isSelected(monster.index);
                const qty = getQty(monster.index);

                return (
                  <tr
                    key={monster.index}
                    className={`monster-row ${selected ? 'monster-row-selected' : ''}`}
                    onClick={() => onToggleMonster(monster)}
                  >
                    <td className="col-check">
                      <input
                        type="checkbox"
                        className="monster-checkbox"
                        checked={selected}
                        onChange={() => onToggleMonster(monster)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${monster.name}`}
                      />
                    </td>
                    <td className="col-name">{monster.name}</td>
                    <td className="col-cr">{monster.challenge_rating}</td>
                    <td className="col-xp">{monster.xp.toLocaleString()}</td>
                    <td className="col-qty">
                      {qty > 0 ? (
                        <span className="qty-controls">
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={(e) => { e.stopPropagation(); onDecreaseQty(monster.index); }}
                            aria-label={`Decrease quantity of ${monster.name}`}
                          >
                            &minus;
                          </button>
                          <span className="qty-value">{qty}</span>
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={(e) => { e.stopPropagation(); onIncreaseQty(monster.index); }}
                            aria-label={`Increase quantity of ${monster.name}`}
                          >
                            +
                          </button>
                        </span>
                      ) : (
                        <span className="qty-value">&mdash;</span>
                      )}
                    </td>
                    <td className="col-remove">
                      {qty > 0 && (
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={(e) => { e.stopPropagation(); onRemoveMonster(monster.index); }}
                          aria-label={`Remove ${monster.name}`}
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <i className="fa-solid fa-search" style={{ marginRight: 6 }} />
          No monsters found
        </div>
      )}
    </div>
  );
}

export default EncounterMonsterTable;
