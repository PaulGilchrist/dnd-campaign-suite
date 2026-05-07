import { useState, useEffect, useCallback } from 'react';
import SelectableList from './selectable-list';
import WarningList from '../common/warning-list';
import { getSpellLimits, validateSpellSelection } from '../../services/spell-limits.js';
import { getSpellValidationInfo } from '../../services/spell-validation.js';
import './wizard-step-spells.css';
function WizardStepSpells({ formData, allSpells, onArrayFieldChange }) {
  const [spellCounts, setSpellCounts] = useState({ cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 });
  const [spellLimits, setSpellLimits] = useState({ cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 });
  const [spellWarnings, setSpellWarnings] = useState([]);
  const [, setValidationMessage] = useState('');
  const [, setIsLoadingLimits] = useState(false);
  // Fetch spell limits dynamically based on class and level
  useEffect(() => {
    const fetchSpellLimits = async () => {
      if (!formData || !formData.class || !formData.level) {
        return;
      }
      
      const className = formData.class.name;
      const charLevel = parseInt(formData.level) || 1;
      const version = formData.rules || '5e';
      const majorName = formData.class.major?.name || formData.class.subclass?.name || null;
      
      setIsLoadingLimits(true);
      try {
        const limits = await getSpellLimits(className, charLevel, version, majorName);
        setSpellLimits(limits);
      } catch (error) {
        console.error('Error fetching spell limits:', error);
        setSpellLimits({ cantrip: 4, level1: 2, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 });
      } finally {
        setIsLoadingLimits(false);
       }
      };
    
    fetchSpellLimits();
  }, [formData, formData.class, formData.level, formData.rules]);

  // Calculate spell counts by level
  useEffect(() => {   
    const counts = { cantrip: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 };
    
    if (formData.spells && formData.spells.length > 0) {
      formData.spells.forEach(spellName => {
        const spell = allSpells.find(s => s.name === spellName || s.index === spellName);
        if (spell) {
          const level = spell.level !== undefined ? spell.level : 0;
          const levelKey = level === 0 ? 'cantrip' : `level${level}`;
          counts[levelKey] = (counts[levelKey] || 0) + 1;
        }
      });
    }
    
    setSpellCounts(counts);
  }, [formData.spells, allSpells]);

  // Check if spell selection exceeds limits
  const getValidationMessage = useCallback(async () => {
    if (!formData || !formData.class) {
      return '';
    }

    const className = formData.class.name;
    const charLevel = parseInt(formData.level) || 1;
    const version = formData.rules || '5e';
    const majorName = formData.class.major?.name || formData.class.subclass?.name || null;

    // Validate spell selection
    const validation = await validateSpellSelection(formData.spells || [], allSpells || [], className, charLevel, version, majorName);

    if (className === 'Barbarian' || className === 'Monk' || className === 'Rogue' || className === 'Fighter') {
      if (validation.valid) {
        return 'This class does not have spellcasting abilities. Consider choosing a spellcasting class.';
      }
    }

    if (!validation.valid) {
      return `Spell limit exceeded: ${validation.violations.join(', ')}`;
    }

    return '';
  }, [formData, allSpells]);

  useEffect(() => {
    const validate = async () => {
      const message = await getValidationMessage();
      setValidationMessage(message);
    };
    validate();
  }, [spellCounts, spellLimits, formData.class, formData.level, formData.spells, allSpells, formData.rules, getValidationMessage]);

  // Spell validation warnings using the new spell-validation service
  useEffect(() => {
    const validateSpells = async () => {
      if (!formData || !formData.class || !formData.spells || formData.spells.length === 0) {
        setSpellWarnings([]);
        return;
       }
      
      const version = formData.rules || '5e';
      try {
        const validationInfo = await getSpellValidationInfo(
          formData,
          formData.spells,
          allSpells || [],
          version
          );
        
        setSpellWarnings(validationInfo.warnings || []);
       } catch (error) {
        console.error('Error validating spells:', error);
        setSpellWarnings([]);
        }
      };
    
    validateSpells();
   }, [formData, formData.class, formData.race, formData.background, formData.feats, formData.spells, formData.level, formData.rules, allSpells]);

   // Get level class for styling
  const getLevelClass = (spell) => {
    const level = spell.level !== undefined ? spell.level : 0;
    if (level === 0) return 'cantrip';
    if (level <= 3) return 'low';
    if (level <= 5) return 'mid';
    return 'high';
  };

   // Render item function
  const renderItem = (spell, index, { isSelected, isExpanded, onToggle, onToggleExpand }) => {
    return (
      <div
        key={spell.index || index}
        className={`list-item spell-item ${isSelected ? 'selected' : ''}`}
        onClick={onToggle}
      >
        <div className="list-item-header">
          <div className="list-item-name">{spell.name}</div>
          <span className={`spell-level ${getLevelClass(spell)}`}>
            {spell.level !== undefined ? spell.level : '0'}
          </span>
          <div className={`list-item-checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected ? '✓' : ''}
          </div>
        </div>
        
        <div className="list-item-details">
          <div className="spell-meta">
            <span className="spell-school">{spell.school || 'Unknown'}</span>
            {spell.ritual && <span className="spell-ritual">Ritual</span>}
            {spell.concentration && <span className="spell-concentration">Concentration</span>}
            {spell.duration && <span className="spell-duration">Duration: {spell.duration}</span>}
            {spell.casting_time && <span className="spell-casting-time">Casting: {spell.casting_time}</span>}
          </div>

          {isExpanded && (
            <div className="list-item-full-details">
              <div className="spell-description">
                {spell.desc && spell.desc[0] && spell.desc[0]}
              </div>
              
              {spell.higher_level && spell.higher_level[0] && (
                <div className="spell-higher-level">
                  <strong>Higher Levels:</strong> {spell.higher_level[0]}
                </div>
              )}
              
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
        <div className="spells-summary">
          <h4>Spell Selection Summary</h4>
          
          <div className="spell-levels-summary">
            <div className="level-summary-item">
              <span className="level-label">Cantrips:</span>
              <span className={`level-count ${spellCounts.cantrip > (spellLimits.cantrip || 0) ? 'exceeded' : ''}`}>
                {spellCounts.cantrip}/{spellLimits.cantrip || 0}
              </span>
            </div>
            {['level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9'].map(levelKey => (
              <div key={levelKey} className="level-summary-item">
                <span className="level-label">{levelKey.replace('level', '')}th level:</span>
                <span className={`level-count ${spellCounts[levelKey] > (spellLimits[levelKey] || 0) ? 'exceeded' : ''}`}>
                  {spellCounts[levelKey] || 0}/{spellLimits[levelKey] || 0}
                </span>
              </div>
            ))}
          </div>
            
            {spellWarnings.length > 0 && <WarningList warnings={spellWarnings} showIcons />}
        </div>
    );

   // Filter configuration
  const filters = [
    {
      label: 'Spell Level',
      field: 'level',
      className: 'level-filter',
      getValue: (spell) => spell.level !== undefined ? spell.level.toString() : '0',
      renderOption: (level) => level === '0' ? 'Cantrip' : level,
      sortFn: (a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return parseInt(a) - parseInt(b);
}
     },
    {
      label: 'Class',
      field: 'class',
      className: 'class-filter',
      getValue: (spell) => spell.classes
     }
   ];

  return (
     <SelectableList
      items={allSpells}
      fieldName="spells"
      formData={formData}
      onArrayFieldChange={onArrayFieldChange}
      title="Step 9: Spells"
      searchPlaceholder="Search spells..."
      filters={filters}
      renderItem={renderItem}
      renderSummary={renderSummary}
      loadingMessage="Spell data not yet loaded. Please try again."
      className="wizard-step-spells"
      resultLabel="spell"
     />
   );
}

export default WizardStepSpells;
