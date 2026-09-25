import { useState, useMemo } from 'react';
import { renderMarkdown } from '../../services/ui/sanitize.js';
import './MagicInitiateModal.css';
import './RitualMasterModal.css';

function RitualMasterModal({ formData, allSpells, onArrayFieldChange, onClose }) {
  const charLevel = parseInt(formData?.level, 10) || 1;
  const proficiencyBonus = Math.floor((charLevel - 1) / 4) + 2;

  const existingSelection = useMemo(
    () => (Array.isArray(formData.ritualMasterSpells) ? [...formData.ritualMasterSpells] : []),
    [formData.ritualMasterSpells]
  );
  const [selected, setSelected] = useState(existingSelection);
  const [expandedSpell, setExpandedSpell] = useState(null);
  const [errors, setErrors] = useState({});

  const ritualSpells = useMemo(() => {
    if (!allSpells) return [];
    return allSpells.filter(spell => spell.level === 1 && spell.ritual === true);
  }, [allSpells]);

  const toggleSpell = (spellName) => {
    setErrors({});
    setSelected(prev => (
      prev.includes(spellName) ? prev.filter(n => n !== spellName) : [...prev, spellName]
    ));
  };

  const saveSelection = () => {
    const errs = {};
    if (selected.length !== proficiencyBonus) {
      errs.spells = `Choose exactly ${proficiencyBonus} level 1 spell${proficiencyBonus === 1 ? '' : 's'} with the Ritual tag (you have ${selected.length})`;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onArrayFieldChange('ritualMasterSpells', [...selected]);
    onClose();
  };

  return (
    <div className="mi-overlay">
      <div className="mi-modal ritual-master-modal">
        <div className="mi-header">
          <i className="fa-solid fa-scroll"></i> Ritual Spells
          <button type="button" className="mi-header-close" onClick={onClose} aria-label="Close" title="Close (configure later from the Spells step)">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <div className="mi-body">
          <p className="mi-description">
            Choose a number of level 1 spells with the Ritual tag equal to your Proficiency Bonus ({proficiencyBonus}).
            You always have those spells prepared, and you can cast them with any spell slots you have.
            The spells&apos; spellcasting ability is the ability increased by this feat.
            Quick Ritual: cast one of these prepared Ritual spells using its regular casting time without a spell slot, once per Long Rest.
          </p>

          <div className="mi-selector">
            <label className="mi-selector-label">Level 1 Ritual Spells ({selected.length}/{proficiencyBonus}):</label>
            <div className="ritual-master-spell-list">
              {ritualSpells.length === 0 && (
                <span className="mi-error">No level 1 ritual spells available.</span>
              )}
              {ritualSpells.map(spell => {
                const isSelected = selected.includes(spell.name);
                const isExpanded = expandedSpell === spell.name;
                return (
                  <div key={spell.index || spell.name}>
                    <div
                      className={`ritual-master-spell-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSpell(spell.name)}
                    >
                      <input type="checkbox" checked={isSelected} readOnly tabIndex={-1} aria-hidden="true" />
                      <span className="ritual-master-spell-name">{spell.name}</span>
                      <span className="ritual-master-spell-tag">Lvl 1 Ritual</span>
                      <button
                        type="button"
                        className="ritual-master-info-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedSpell(isExpanded ? null : spell.name);
                        }}
                        aria-label={`Details for ${spell.name}`}
                        title="View spell details"
                      >
                        <i className="fa-solid fa-circle-info"></i>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mi-spell-details expanded ritual-master-spell-details">
                        <div className="mi-spell-details-content">
                          {spell.description && spell.description[0] && (
                            <div className="mi-spell-desc" dangerouslySetInnerHTML={{ __html: renderMarkdown(spell.description[0]) }} />
                          )}
                          <div className="mi-spell-meta">
                            {spell.school && <span>School: {spell.school}</span>}
                            {spell.casting_time && <span>Casting: {spell.casting_time}</span>}
                            {spell.ritual && <span>Ritual</span>}
                            {spell.concentration && <span>Concentration</span>}
                            {spell.duration && <span>Duration: {spell.duration}</span>}
                            {spell.components && <span>Components: {spell.components.join(', ')}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {errors.spells && <span className="mi-error">{errors.spells}</span>}
          </div>

          <div className="mi-save-all">
            <button type="button" className="mi-save-all-btn" onClick={saveSelection}>
              <i className="fa-solid fa-check"></i> Save
            </button>
            <div className="mi-skip">
              <button type="button" className="mi-skip-btn" onClick={onClose}>
                <i className="fa-solid fa-times"></i> Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RitualMasterModal;
