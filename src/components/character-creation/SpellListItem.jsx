import { renderMarkdown } from '../../services/ui/sanitize.js';

function getSpellLevelClass(spell) {
  const level = spell.level !== undefined ? spell.level : 0;
  if (level === 0) return 'cantrip';
  if (level <= 3) return 'low';
  if (level <= 5) return 'mid';
  return 'high';
}

function SpellItemMeta({ spell }) {
  return (
    <div className="spell-meta">
      <span className="spell-school">{spell.school || 'Unknown'}</span>
      {spell.ritual && <span className="spell-ritual">Ritual</span>}
      {spell.concentration && <span className="spell-concentration">Concentration</span>}
      {spell.duration && <span className="spell-duration">Duration: {spell.duration}</span>}
      {spell.casting_time && <span className="spell-casting-time">Casting: {spell.casting_time}</span>}
    </div>
  );
}

function SpellItemFullDetails({ spell }) {
  return (
    <div className="list-item-full-details">
      <div className="spell-description">
        {spell.description?.[0] && (
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(spell.description[0]) }} />
        )}
      </div>

      {spell.components && spell.components.length > 0 && (
        <div className="spell-components">
          <strong>Components:</strong> {spell.components.join(', ')}
        </div>
      )}

      {spell.damage && spell.damage.damage_type && (
        <div className="spell-damage">
          <strong>Damage:</strong> {spell.damage.damage_type}
        </div>
      )}

      {spell.material && (
        <div className="spell-material">
          <strong>Material:</strong> {spell.material}
        </div>
      )}
    </div>
  );
}

export default function SpellListItem({
  spell,
  index,
  isSelected,
  isPreSelected,
  isExpanded,
  onToggle,
  onToggleExpand
}) {
  const checked = isSelected || isPreSelected;

  const handleBodyClick = () => {
    if (isPreSelected) return;
    onToggleExpand();
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (isPreSelected) return;
    onToggle();
  };

  return (
    <div
      key={spell.index || index}
      className={`list-item spell-item ${isSelected ? 'selected' : ''} ${isPreSelected ? 'pre-selected' : ''}`}
    >
      <div className="list-item-body" onClick={handleBodyClick}>
        <div className="list-item-header">
          <div className="list-item-name">
            {spell.name}
            {isPreSelected && <span className="pre-selected-label"> (Auto-assigned)</span>}
          </div>
          <span className={`spell-level ${getSpellLevelClass(spell)}`}>
            {spell.level !== undefined ? spell.level : '0'}
          </span>
          <div
            className={`list-item-checkbox ${checked ? 'checked' : ''} list-item-checkbox-trigger`}
            onClick={handleCheckboxClick}
          >
            {checked ? '✓' : ''}
          </div>
        </div>

        <div className="list-item-details">
          <SpellItemMeta spell={spell} />

          {isExpanded && <SpellItemFullDetails spell={spell} />}

          <div className="list-item-full-details">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="toggle-details-btn"
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
