import { useState, useEffect } from 'react';
import WarningList from '../common/WarningList.jsx';

function WizardStepResistances({ formData, onResistanceToggle, onImmunityToggle, warnings, preSelectedResistances, preSelectedImmunities }) {
  const [resistancesImmunities, setResistancesImmunities] = useState([]);

  useEffect(() => {
    fetch('/data/resistances-immunities.json')
          .then(response => response.json())
          .then(data => setResistancesImmunities(data))
          .catch(error => console.error('Error loading resistances/immunities:', error));
    }, []);
  return (
    <div className="wizard-step">
      <h2>Step 8: Resistances & Immunities</h2>
      
        {/* Display warnings if any */}
        {warnings && warnings.length > 0 && <WarningList warnings={warnings} />}

      <div className="form-group">
        <label>Resistances</label>
        <div className="multi-select-container multi-select-compact">
          {resistancesImmunities.map(type => {
            const isPreSelected = (preSelectedResistances || []).includes(type);
            const isSelected = (formData.resistances || []).includes(type);
            return (
              <label
                key={`resistance-${type}`}
                className={`multi-select-item ${isSelected ? 'selected' : ''} ${isPreSelected ? 'pre-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onResistanceToggle(type)}
                  disabled={isPreSelected && isSelected}
                />
                &nbsp;{type}{isPreSelected ? ' (Granted)' : ''}
              </label>
            );
          })}
        </div>
      </div>
      
      <div className="form-group">
        <label>Immunities</label>
        <div className="multi-select-container multi-select-compact">
          {resistancesImmunities.map(type => {
            const isPreSelected = (preSelectedImmunities || []).includes(type);
            const isSelected = (formData.immunities || []).includes(type);
            return (
              <label
                key={`immunity-${type}`}
                className={`multi-select-item ${isSelected ? 'selected' : ''} ${isPreSelected ? 'pre-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onImmunityToggle(type)}
                  disabled={isPreSelected && isSelected}
                />
                &nbsp;{type}{isPreSelected ? ' (Granted)' : ''}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WizardStepResistances;