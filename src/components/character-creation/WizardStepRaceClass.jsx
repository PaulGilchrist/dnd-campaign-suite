
import CascadingSelect from './CascadingSelect.jsx';

function WizardStepRaceClass({ 
  formData, 
  errors, 
  racesData, 
  classSubtypes,
  ruleset,
  onInputChange
}) {
  const selectedClass = formData.class?.name || '';
  const isCleric2024 = ruleset === '2024' && selectedClass === 'Cleric';
  const isDruid2024 = ruleset === '2024' && selectedClass === 'Druid';

  const divineOrderOptions = isCleric2024 ? ['Protector', 'Thaumaturge'] : [];
  const primalOrderOptions = isDruid2024 ? ['Magician', 'Warden'] : [];

  return (
    <div className="wizard-step">
      <h2>Step 3: Race & Class</h2>
      
      <CascadingSelect
        label="Race"
        childLabel="Subrace"
        options={racesData}
        subOptionsSelector={(selectedRace) => {
          const found = racesData.find(race => race.name === selectedRace);
          return found ? found.subraces : [];
        }}
        fieldName="race"
        childFieldName="subrace"
        errorKey="subrace"
        loadingText="Loading races..."
        ruleset={ruleset}
        formData={formData}
        onInputChange={onInputChange}
        errors={errors}
        childExtraFields={{ description: '' }}
      />
      
      <CascadingSelect
        label="Class"
        childLabel="Subclass"
        optionsKey="className"
        options={classSubtypes}
        subOptionsSelector={(selectedClass) => {
          const found = classSubtypes.find(cs => cs.className === selectedClass);
          return found ? found.subtypes : [];
        }}
        fieldName="class"
        childFieldName="subclass"
        errorKey="subclass"
        loadingText="Loading classes..."
        ruleset={ruleset}
        formData={formData}
        onInputChange={onInputChange}
        errors={errors}
        childExtraFields={{ type: '' }}
      />

      {isCleric2024 && (
        <div className="form-group">
          <label>Divine Order *</label>
          <select
            value={formData.class?.divineOrder || ''}
            onChange={(e) => onInputChange('class', { ...formData.class, divineOrder: e.target.value })}
            className={errors['divineOrder'] ? 'error' : ''}
          >
            <option value="">Select a Divine Order</option>
            {divineOrderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors['divineOrder'] && <span className="error-message">{errors['divineOrder']}</span>}
        </div>
      )}

      {isDruid2024 && (
        <div className="form-group">
          <label>Primal Order *</label>
          <select
            value={formData.class?.primalOrder || ''}
            onChange={(e) => onInputChange('class', { ...formData.class, primalOrder: e.target.value })}
            className={errors['primalOrder'] ? 'error' : ''}
          >
            <option value="">Select a Primal Order</option>
            {primalOrderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors['primalOrder'] && <span className="error-message">{errors['primalOrder']}</span>}
        </div>
      )}
      
    </div>
  );
}

export default WizardStepRaceClass;
