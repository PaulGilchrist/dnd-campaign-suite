import { useState } from 'react';
import RaceDetailCard from './RaceDetailCard.jsx';
import './WizardStepRace.css';

function WizardStepRace({ formData, errors, allRacesData, racesData, ruleset, onInputChange }) {
  const [expanded, setExpanded] = useState(false);

  const selectedRaceName = formData.race?.name || '';
  const selectedRace = racesData.find(r => r.name === selectedRaceName);
  const fullRaceData = allRacesData.find(r => r.name === selectedRaceName);

  const handleRaceChange = (e) => {
    onInputChange('race', {
      name: e.target.value,
      subrace: { name: '' }
    });
  };

  return (
    <div className="wizard-step wizard-step-race">
      <h2>Step 3: Race</h2>

      <div className="form-group">
        <label>Race *</label>
        <select
          value={selectedRaceName}
          onChange={handleRaceChange}
          className={errors.race ? 'error' : ''}
        >
          <option value="">Select a race</option>
          {racesData.map(race => (
            <option key={race.name} value={race.name}>{race.name}</option>
          ))}
        </select>
        {errors.race && <span className="error-message">{errors.race}</span>}
      </div>

      {selectedRace && (
        <RaceDetailCard
          selectedRace={selectedRace}
          fullRaceData={fullRaceData}
          ruleset={ruleset}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      )}
    </div>
  );
}

export default WizardStepRace;
