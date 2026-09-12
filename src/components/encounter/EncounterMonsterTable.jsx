import './EncounterBuilder.css';

const MONSTER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'aberration', label: 'Aberration' },
  { value: 'beast', label: 'Beast' },
  { value: 'celestial', label: 'Celestial' },
  { value: 'construct', label: 'Construct' },
  { value: 'dragon', label: 'Dragon' },
  { value: 'elemental', label: 'Elemental' },
  { value: 'fey', label: 'Fey' },
  { value: 'fiend', label: 'Fiend' },
  { value: 'giant', label: 'Giant' },
  { value: 'humanoid', label: 'Humanoid' },
  { value: 'monstrosity', label: 'Monstrosity' },
  { value: 'ooze', label: 'Ooze' },
  { value: 'plant', label: 'Plant' },
  { value: 'swarm', label: 'Swarm' },
  { value: 'undead', label: 'Undead' },
];

const SIZES = [
  { value: '', label: 'All Sizes' },
  { value: 'tiny', label: 'Tiny' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'huge', label: 'Huge' },
  { value: 'gargantuan', label: 'Gargantuan' },
];

function SortableHeader({ field, label, className, ariaLabel, sortField, sortDirection, onSort }) {
  const indicator = sortField === field ? (sortDirection === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return (
    <th
      className={`${className} sortable`}
      onClick={() => onSort(field)}
      aria-label={ariaLabel}
      role="button"
      tabIndex={0}
    >
      {label}
      <span className="sort-indicator">{indicator}</span>
    </th>
  );
}

function MonsterTableRow({
  monster,
  selected,
  qty,
  showEnvironment,
  onToggleMonster,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveMonster,
  onViewDetails,
}) {
  const envLabel = (monster.environments || []).map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ');
  return (
    <tr
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
      {showEnvironment && (
        <td className="col-env">{envLabel}</td>
      )}
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
      <td className="col-details">
        <button
          type="button"
          className="details-btn"
          onClick={(e) => { e.stopPropagation(); onViewDetails?.(monster); }}
          aria-label={`View details for ${monster.name}`}
        >
          <i className="fa-solid fa-info-circle" />
        </button>
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
}

function EncounterMonsterTable({
  filteredMonsters,
  selectedMonsters,
  onToggleMonster,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveMonster,
  searchQuery,
  onSearchQueryChange,
  onSort,
  sortField,
  sortDirection,
  onViewDetails,
  showEnvironment,
  typeFilter,
  onTypeChange,
  sizeFilter,
  onSizeChange,
  crMin,
  crMax,
  onCRMinChange,
  onCRMaxChange,
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

      {/* Filter Row */}
      <div className="filter-row">
        <div className="filter-group">
          <label className="filter-label" htmlFor="monster-type-filter">Type</label>
          <select
            id="monster-type-filter"
            className="filter-select"
            value={typeFilter || ''}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            {MONSTER_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="monster-size-filter">Size</label>
          <select
            id="monster-size-filter"
            className="filter-select"
            value={sizeFilter || ''}
            onChange={(e) => onSizeChange(e.target.value)}
          >
            {SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-cr-group">
          <label className="filter-label" htmlFor="cr-min">CR Min</label>
          <input
            id="cr-min"
            type="number"
            className="filter-input"
            placeholder="Any"
            min="0"
            step="0.125"
            value={crMin ?? ''}
            onChange={(e) => onCRMinChange(e.target.value)}
            aria-label="Minimum challenge rating"
          />
        </div>&nbsp;&nbsp;&nbsp;&nbsp;
        <div className="filter-group filter-cr-group">
          <label className="filter-label" htmlFor="cr-max">CR Max</label>
          <input
            id="cr-max"
            type="number"
            className="filter-input"
            placeholder="Any"
            min="0"
            step="0.125"
            value={crMax ?? ''}
            onChange={(e) => onCRMaxChange(e.target.value)}
            aria-label="Maximum challenge rating"
          />
        </div>
      </div>

      {/* Monster Table */}
      {filteredMonsters.length > 0 ? (
        <div className="monster-table-wrapper">
          <table className="monster-table">
            <thead>
              <tr>
                <SortableHeader field="sel" label="Sel" className="col-check" ariaLabel="Sort by selection status" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="name" label="Monster" className="col-name" ariaLabel="Sort by monster name" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="cr" label="CR" className="col-cr" ariaLabel="Sort by challenge rating" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="xp" label="XP" className="col-xp" ariaLabel="Sort by XP" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                {showEnvironment && (
                  <SortableHeader field="env" label="Env" className="col-env" ariaLabel="Sort by environment" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                )}
                <th className="col-qty">Qty</th>
                <th className="col-details">Details</th>
                <th className="col-remove">Remove</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonsters.map((monster) => (
                <MonsterTableRow
                  key={monster.index}
                  monster={monster}
                  selected={isSelected(monster.index)}
                  qty={getQty(monster.index)}
                  showEnvironment={showEnvironment}
                  onToggleMonster={onToggleMonster}
                  onIncreaseQty={onIncreaseQty}
                  onDecreaseQty={onDecreaseQty}
                  onRemoveMonster={onRemoveMonster}
                  onViewDetails={onViewDetails}
                />
              ))}
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
