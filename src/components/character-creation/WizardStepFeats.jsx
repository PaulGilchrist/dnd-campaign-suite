import React from 'react';
import SelectableList from './SelectableList.jsx';
import WarningList from '../common/WarningList.jsx';
import { validateFeats, getFeatLimits, normalizeFeatDescription } from '../../services/featValidation.js';
import { computeFeatBuffs } from '../../services/featBuffService.js';
import { sanitizeHtml } from '../../services/sanitize.js';

function WizardStepFeats({ formData, allFeats, onArrayFieldChange, preSelectedFeats, computedBuffs }) {
  const [warnings, setWarnings] = React.useState([]);
    // Validate feats when selection changes
      React.useEffect(() => {
            const fetchWarnings = async () => {
              const validationWarnings = await validateFeats(formData, allFeats);
              setWarnings(validationWarnings);
            };
            fetchWarnings();
          }, [formData, formData.feats, formData.level, formData.rules, allFeats]);

    // Get feat limits for display
    const [featLimits, setFeatLimits] = React.useState({ allowed: 0, originRequired: false, details: '' });
  React.useEffect(() => {
        const fetchLimits = async () => {
          const limits = await getFeatLimits(formData);
          setFeatLimits(limits);
          };
        fetchLimits();
      }, [formData, formData.level, formData.rules]);

    // Render prerequisites
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

    // Render item function
  const renderItem = (feat, index, { isSelected, isPreSelected, isExpanded, onToggle, onToggleExpand }) => {
    const descData = normalizeFeatDescription(feat);
    const ruleset = formData.rules || '5e';
    const featBuffs = isSelected ? computeFeatBuffs(feat, ruleset) : null;

    const hasAbilityIncrease = featBuffs && featBuffs.abilityScoreIncreases.length > 0;
    const hasProficiencies = featBuffs && featBuffs.proficiencies.length > 0;
    const hasResistances = featBuffs && featBuffs.resistances.length > 0;
        return (
            <div
                key={feat.index || index}
                className={`list-item feat-item ${isSelected ? 'selected' : ''} ${isPreSelected ? 'pre-selected' : ''}`}
          onClick={onToggle}
            >
                <div className="list-item-header">
                    <div className="list-item-name">
                        {feat.name}
                        {isPreSelected && <span className="pre-selected-label">(Pre-selected)</span>}
                    </div>
                    {feat.type && <span className="feat-type">{feat.type}</span>}
                    <div className={`list-item-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected ? '✓' : ''}
                    </div>
                </div>

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
                            {isSelected && hasAbilityIncrease && (
                              <div className="feat-buffs">
                                <strong>Ability Score Increase:</strong>
                                {featBuffs.abilityScoreIncreases.map((inc, i) => (
                                  <span key={i} className="feat-buff-tag">
                                    {inc.isChoice ? `${inc.name} +${inc.amount} (choice)` : `${inc.name} +${inc.amount}`}
                                  </span>
                                ))}
                              </div>
                            )}
                            {isSelected && hasProficiencies && (
                              <div className="feat-buffs">
                                <strong>Proficiencies:</strong>
                                {featBuffs.proficiencies.map((p, i) => (
                                  <span key={i} className="feat-buff-tag">{p.name}</span>
                                ))}
                              </div>
                            )}
                            {isSelected && hasResistances && (
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
            </div>
        );
    };

    // Render summary
  const renderSummary = () => {
    const preSelected = preSelectedFeats || [];
    const allSelected = formData.feats || [];
    const userSelectedCount = allSelected.filter(f => !preSelected.includes(f)).length;
    const preSelectedCount = allSelected.filter(f => preSelected.includes(f)).length;
    const totalASI = computedBuffs?.abilityScoreIncreases?.filter(inc => inc.name && inc.name !== 'any').length || 0;
    const totalProfs = computedBuffs?.proficiencies?.length || 0;
    const totalResists = computedBuffs?.resistances?.length || 0;
    const totalFeatures = computedBuffs?.features?.length || 0;
    const hasBuffs = totalASI > 0 || totalProfs > 0 || totalResists > 0 || totalFeatures > 0;

    return (
      <div className="rule-info">
        <p><strong>Rules:</strong> {featLimits.details}</p>
        <p>
          You have selected {userSelectedCount} of {featLimits.allowed} allowed feat(s)
          {preSelectedCount > 0 ? ` (plus ${preSelectedCount} background feat)` : ''}.
        </p>
        {hasBuffs && (
          <div className="feat-buffs-summary">
            <p><strong>Applied Buffs:</strong></p>
            {totalASI > 0 && <p className="feat-buff-line">• {totalASI} ability score increase(s)</p>}
            {totalProfs > 0 && <p className="feat-buff-line">• {totalProfs} proficiency/proficiencie(s)</p>}
            {totalResists > 0 && <p className="feat-buff-line">• {totalResists} resistance(s)</p>}
            {totalFeatures > 0 && <p className="feat-buff-line">• {totalFeatures} passive/feature buff(s)</p>}
          </div>
        )}
      </div>
    );
  };

     // Filter configuration
   const filters = [
         { label: 'Feat Type', field: 'type', className: 'type-filter' }
       ];

    return (
          <SelectableList
         items={allFeats}
         fieldName="feats"
         formData={formData}
         onArrayFieldChange={onArrayFieldChange}
         title="Step 4: Feats"
         searchPlaceholder="Search feats..."
         filters={filters}
         renderItem={renderItem}
         renderSummary={renderSummary}
         renderWarnings={() => warnings.length > 0 && <WarningList warnings={warnings} />}
         loadingMessage="Feat data not yet loaded. Please try again."
         preSelectedItems={preSelectedFeats || []}
         className="wizard-step-feats"
         resultLabel="feat"
          />
        );
}

export default WizardStepFeats;

