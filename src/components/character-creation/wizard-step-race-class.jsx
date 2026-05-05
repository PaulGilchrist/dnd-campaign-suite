import React from 'react';
import CascadingSelect from './CascadingSelect';

function WizardStepRaceClass({ 
  formData, 
  errors, 
  racesData, 
  classSubtypes,
  ruleset,
  onInputChange 
}) {
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
      
    </div>
  );
}

export default WizardStepRaceClass;
