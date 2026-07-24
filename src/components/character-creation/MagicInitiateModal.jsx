import { useState, useCallback, useMemo } from 'react';
import { setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { renderMarkdown } from '../../services/ui/sanitize.js';
import './MagicInitiateModal.css';

const FIVE_E_CLASSES = ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'];
const TWO_THOUSAND_FOUR_CLASSES = ['Cleric', 'Druid', 'Wizard'];

function getClassesForRuleset(ruleset) {
  return ruleset === '2024' ? TWO_THOUSAND_FOUR_CLASSES : FIVE_E_CLASSES;
}

function getSpellClassList(spell) {
  return (spell.classes || []).map(c => c.charAt(0).toUpperCase() + c.slice(1));
}

function MagicInitiateModal({ formData, allSpells, onArrayFieldChange, onClose, campaignName }) {
  const characterKey = formData.name || 'Character';
  const existingInstances = useRuntimeValue(characterKey, '_magicInitiateInstances', campaignName);
  const [instances, setInstances] = useState(() => {
    if (existingInstances && Array.isArray(existingInstances)) {
      return existingInstances.map(inst => ({ ...inst }));
    }
    return [];
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [expandedSpell, setExpandedSpell] = useState(null);
  const [errors, setErrors] = useState({});

  const ruleset = formData.rules || '5e';
  const availableClasses = useMemo(() => getClassesForRuleset(ruleset), [ruleset]);

  const filteredSpells = useMemo(() => {
    if (!allSpells) return [];
    return allSpells;
  }, [allSpells]);

  const getSpellsForClass = useCallback((className) => {
    return filteredSpells.filter(spell => {
      const spellClasses = getSpellClassList(spell);
      return spellClasses.includes(className);
    });
  }, [filteredSpells]);

  const getCantripsForClass = useCallback((className) => {
    return getSpellsForClass(className).filter(spell => (spell.level === 0 || spell.level === '0'));
  }, [getSpellsForClass]);

  const getLevel1SpellsForClass = useCallback((className) => {
    return getSpellsForClass(className).filter(spell => spell.level === 1);
  }, [getSpellsForClass]);

  const createEmptyInstance = () => ({
    class: availableClasses[0],
    cantrips: [null, null],
    level1Spell: null,
  });

  const addInstance = () => {
    const newInstances = [...instances, createEmptyInstance()];
    setInstances(newInstances);
    setEditingIndex(newInstances.length - 1);
    setErrors({});
  };

  const removeInstance = (index) => {
    const newInstances = instances.filter((_, i) => i !== index);
    setInstances(newInstances);
    setEditingIndex(null);
    setErrors({});
  };

  const updateInstance = (index, updates) => {
    const newInstances = instances.map((inst, i) => {
      if (i === index) {
        return { ...inst, ...updates };
      }
      return inst;
    });
    setInstances(newInstances);
    setErrors({});
  };

  const updateCantrip = (instanceIndex, cantripIndex, cantripName) => {
    const inst = instances[instanceIndex];
    const newCantrips = [...inst.cantrips];
    newCantrips[cantripIndex] = cantripName;
    // Remove duplicate if selected
    const otherCantrip = newCantrips[1 - cantripIndex];
    if (cantripName && cantripName === otherCantrip) {
      newCantrips[1 - cantripIndex] = null;
    }
    updateInstance(instanceIndex, { cantrips: newCantrips });
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setErrors({});
  };

  const validateInstance = (index) => {
    const inst = instances[index];
    const errs = {};
    if (!inst.class) {
      errs.class = 'Class is required';
    }
    if (!inst.cantrips[0]) {
      errs.cantrip0 = 'Cantrip 1 is required';
    }
    if (!inst.cantrips[1]) {
      errs.cantrip1 = 'Cantrip 2 is required';
    }
    if (!inst.level1Spell) {
      errs.level1 = 'Level 1 spell is required';
    }
    // Check cantrips are from the selected class
    if (inst.class) {
      const cantrips = getCantripsForClass(inst.class);
      const cantripNames = cantrips.map(c => c.name);
      inst.cantrips.forEach((c, i) => {
        if (c && !cantripNames.includes(c)) {
          errs[`cantrip${i}`] = `Not a valid ${inst.class} cantrip`;
        }
      });
      if (inst.cantrips[0] && inst.cantrips[1] && inst.cantrips[0] === inst.cantrips[1]) {
        errs.cantrip1 = 'Must be different from Cantrip 1';
      }
      const level1Spells = getLevel1SpellsForClass(inst.class);
      const level1Names = level1Spells.map(s => s.name);
      if (inst.level1Spell && !level1Names.includes(inst.level1Spell)) {
        errs.level1 = 'Not a valid ' + inst.class + ' level 1 spell';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveInstance = (index) => {
    if (!validateInstance(index)) return;
    setEditingIndex(null);
  };

  const saveAll = () => {
    let allValid = true;
    for (let i = 0; i < instances.length; i++) {
      if (!validateInstance(i)) {
        allValid = false;
      }
    }
    if (!allValid) return;

    // Collect all spells from all instances
    const allSpellsFromInstances = [];
    instances.forEach(inst => {
      if (inst.cantrips[0]) allSpellsFromInstances.push(inst.cantrips[0]);
      if (inst.cantrips[1]) allSpellsFromInstances.push(inst.cantrips[1]);
      if (inst.level1Spell) allSpellsFromInstances.push(inst.level1Spell);
    });

    // Get existing spells (excluding any previously saved Magic Initiate spells)
    const existingSpells = formData.spells || [];
    const newSpells = [...new Set([...existingSpells, ...allSpellsFromInstances])];
    onArrayFieldChange('spells', newSpells);

    // Save instances to formData
    onArrayFieldChange('magicInitiateInstances', instances);

    onClose();
  };

  const getSpellDetails = (spellName) => {
    if (!spellName) return null;
    return filteredSpells.find(s => s.name === spellName);
  };

  const renderSpellSelector = (label, value, options, error, levelLabel) => {
    return (
      <div className="mi-selector">
        <label className="mi-selector-label">{label}:</label>
        <select
          className="mi-selector-select"
          value={value || ''}
          onChange={(e) => {
            const newValue = e.target.value || null;
            if (editingIndex !== null && levelLabel === 'cantrip') {
              const cantripIndex = label.includes('2') ? 1 : 0;
              updateCantrip(editingIndex, cantripIndex, newValue);
            } else if (editingIndex !== null) {
              updateInstance(editingIndex, { level1Spell: newValue });
            }
          }}
        >
          <option value="">Select a spell...</option>
          {options.map(spell => (
            <option key={spell.name} value={spell.name}>
              {spell.name} ({spell.level === 0 ? 'Cantrip' : spell.level + 'rd'})
            </option>
          ))}
        </select>
        {value && levelLabel !== 'cantrip' && editingIndex !== null && (
          <SpellDetails
            spell={getSpellDetails(value)}
            expanded={expandedSpell === value}
            onToggle={() => setExpandedSpell(expandedSpell === value ? null : value)}
          />
        )}
        {value && levelLabel === 'cantrip' && editingIndex !== null && (
          <SpellDetails
            spell={getSpellDetails(value)}
            expanded={expandedSpell === value}
            onToggle={() => setExpandedSpell(expandedSpell === value ? null : value)}
          />
        )}
        {error && <span className="mi-error">{error}</span>}
      </div>
    );
  };

  const renderInstanceSummary = (inst, index) => {
    return (
      <div key={index} className="mi-instance-summary">
        <div className="mi-instance-summary-header">
          <span className="mi-instance-summary-class">
            Instance {index + 1}: {inst.class || 'No class'}
          </span>
          <div className="mi-instance-summary-actions">
            <button
              type="button"
              className="mi-edit-btn"
              onClick={() => startEdit(index)}
            >
              Edit
            </button>
            {instances.length > 1 && (
              <button
                type="button"
                className="mi-remove-btn"
                onClick={() => removeInstance(index)}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="mi-instance-summary-spells">
          <span className="mi-spell-tag">{inst.cantrips[0] || '—'}</span>
          <span className="mi-spell-tag">{inst.cantrips[1] || '—'}</span>
          <span className="mi-spell-tag mi-level1-tag">{inst.level1Spell || '—'}</span>
        </div>
      </div>
    );
  };

  const renderInstanceEditor = (index) => {
    const inst = instances[index];
    if (!inst) return null;

    const cantrips = getCantripsForClass(inst.class);
    const level1Spells = getLevel1SpellsForClass(inst.class);

    return (
      <div key={index} className="mi-instance-editor">
        <div className="mi-editor-header">
          <h4>Instance {index + 1}</h4>
          <button type="button" className="mi-close-btn" onClick={() => setEditingIndex(null)}>
            Cancel
          </button>
        </div>
        <div className="mi-editor-body">
          <div className="mi-selector">
            <label className="mi-selector-label">Class:</label>
            <select
              className="mi-selector-select"
              value={inst.class || ''}
              onChange={(e) => updateInstance(index, { class: e.target.value })}
            >
              <option value="">Select a class...</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            {errors.class && <span className="mi-error">{errors.class}</span>}
          </div>

          {inst.class && (
            <>
              {renderSpellSelector('Cantrip 1', inst.cantrips[0], cantrips, errors.cantrip0, 'cantrip')}
              {renderSpellSelector('Cantrip 2', inst.cantrips[1], cantrips, errors.cantrip1, 'cantrip')}
              {renderSpellSelector('Level 1 Spell', inst.level1Spell, level1Spells, errors.level1, 'level1')}
            </>
          )}

          <div className="mi-editor-actions">
            <button type="button" className="mi-save-btn" onClick={() => saveInstance(index)}>
              Save Instance
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mi-overlay" onClick={onClose}>
      <div className="mi-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mi-header">
          <i className="fa-solid fa-hat-wizard"></i> Magic Initiate
        </div>
        <div className="mi-body">
          <p className="mi-description">
            Choose a class and select spells from its spell list. You learn two cantrips and one 1st-level spell.
            You can cast the 1st-level spell once without a spell slot and regain the ability to do so after a long rest.
          </p>

          {instances.length > 0 && !editingIndex && (
            <div className="mi-instances-list">
              {instances.map((inst, i) => renderInstanceSummary(inst, i))}
            </div>
          )}

          {editingIndex !== null && renderInstanceEditor(editingIndex)}

          {!editingIndex && (
            <div className="mi-add-instance">
              <button type="button" className="mi-add-btn" onClick={addInstance}>
                <i className="fa-solid fa-plus"></i> Add Another Instance
              </button>
            </div>
          )}

          {instances.length > 0 && !editingIndex && (
            <div className="mi-save-all">
              <button type="button" className="mi-save-all-btn" onClick={saveAll}>
                <i className="fa-solid fa-check"></i> Save All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpellDetails({ spell, expanded, onToggle }) {
  if (!spell) return null;
  return (
    <div className={`mi-spell-details ${expanded ? 'expanded' : ''}`}>
      <button className="mi-spell-details-toggle" onClick={onToggle}>
        <i className={`fa-solid ${expanded ? 'fa-caret-down' : 'fa-caret-right'}`}></i>
        {spell.name} details
      </button>
      {expanded && (
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
            {spell.damage && spell.damage.damage_type && <span>Damage: {spell.damage.damage_type}</span>}
            {spell.material && <span>Material: {spell.material}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default MagicInitiateModal;
