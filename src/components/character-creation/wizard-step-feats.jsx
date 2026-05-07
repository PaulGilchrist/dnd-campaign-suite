import React from 'react';
import SelectableList from './selectable-list';
import WarningList from '../common/warning-list';
import { validateFeats, getFeatLimits, normalizeFeatDescription } from '../../services/feat-validation.js';
import { sanitizeHtml } from '../../services/sanitize.js';

function WizardStepFeats({ formData, allFeats, onArrayFieldChange, preSelectedFeats }) {
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
  const renderSummary = () => (
                <div className="rule-info">
                    <p><strong>Rules:</strong> {featLimits.details}</p>
                    <p>You have selected {formData.feats?.length || 0} of {featLimits.allowed} allowed feat(s).</p>
                </div>
        );

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

