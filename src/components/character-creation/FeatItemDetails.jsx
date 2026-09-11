import { normalizeFeatDescription } from '../../services/character/featValidation.js';
import { computeFeatBuffs } from '../../services/character/featBuffService.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

const renderPrerequisites = (feat) => {
  if (!feat.prerequisites) return '';
  if (Array.isArray(feat.prerequisites)) {
    return feat.prerequisites
      .filter(p => typeof p === 'string' || (typeof p === 'object' && p.name))
      .map(p => typeof p === 'string' ? p : (p.name || JSON.stringify(p)))
      .join(', ');
  }
  return typeof feat.prerequisites === 'string' ? feat.prerequisites : JSON.stringify(feat.prerequisites);
};

function FeatItemDetails({ feat, isSelected, isExpanded, onToggleExpand, ruleset }) {
  const descData = normalizeFeatDescription(feat);
  const featBuffs = isSelected ? computeFeatBuffs(feat, ruleset) : null;

  return (
    <div className="list-item-details">
      {isExpanded && (
        <div className="list-item-full-details">
          {feat.prerequisites && (
            <div className="feat-prerequisites">
              <strong>Prerequisites:</strong> {renderPrerequisites(feat)}
            </div>
          )}
          {descData.text && (
            <div className="feat-description">
              {descData.isHtml ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(descData.text) }} />
              ) : (
                descData.text
              )}
            </div>
          )}
          {isSelected && featBuffs.abilityScoreIncreases.length > 0 && (
            <div className="feat-buffs">
              <strong>Ability Score Increase:</strong>
              {featBuffs.abilityScoreIncreases.map((inc, i) => (
                <span key={i} className="feat-buff-tag">
                  {inc.isChoice ? `${inc.name} +${inc.amount} (choice)` : `${inc.name} +${inc.amount}`}
                </span>
              ))}
            </div>
          )}
          {isSelected && featBuffs.proficiencies.length > 0 && (
            <div className="feat-buffs">
              <strong>Proficiencies:</strong>
              {featBuffs.proficiencies.map((p, i) => (
                <span key={i} className="feat-buff-tag">{p.name}</span>
              ))}
            </div>
          )}
          {isSelected && featBuffs.resistances.length > 0 && (
            <div className="feat-buffs">
              <strong>Resistances:</strong>
              {featBuffs.resistances.map((r, i) => (
                <span key={i} className="feat-buff-tag">{r}</span>
              ))}
            </div>
          )}
        </div>
      )}
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
  );
}

export default FeatItemDetails;
