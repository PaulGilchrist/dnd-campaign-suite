
import CascadingSelect from './CascadingSelect.jsx';

function OrderSelect({ label, options, value, error, onChange }) {
  return (
    <div className="form-group">
      <label>{label} *</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'error' : ''}
      >
        <option value="">Select a {label}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}

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

  const setClassField = (field, value) =>
    onInputChange('class', { ...formData.class, [field]: value });

  const selectSubraces = (selectedRace) => {
    const found = racesData.find(race => race.name === selectedRace);
    return found ? found.subraces : [];
  };

  const selectSubclasses = (selected) => {
    const found = classSubtypes.find(cs => cs.className === selected);
    return found ? found.subtypes : [];
  };

  return (
    <div className="wizard-step">
      <h2>Step 3: Race & Class</h2>
      
      <CascadingSelect
        label="Race"
        childLabel="Subrace"
        options={racesData}
        subOptionsSelector={selectSubraces}
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
        subOptionsSelector={selectSubclasses}
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
        <OrderSelect
          label="Divine Order"
          options={['Protector', 'Thaumaturge']}
          value={formData.class?.divineOrder || ''}
          error={errors['divineOrder']}
          onChange={(value) => setClassField('divineOrder', value)}
        />
      )}

      {isDruid2024 && (
        <OrderSelect
          label="Primal Order"
          options={['Magician', 'Warden']}
          value={formData.class?.primalOrder || ''}
          error={errors['primalOrder']}
          onChange={(value) => setClassField('primalOrder', value)}
        />
      )}
      
    </div>
  );
}

export default WizardStepRaceClass;
