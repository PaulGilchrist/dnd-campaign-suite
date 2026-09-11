import ClassDetailCard from './ClassDetailCard.jsx';
import './WizardStepClass.css';

function WizardStepClass({ formData, errors, allClassesData, ruleset, onInputChange }) {
  const selectedClassName = formData.class?.name || '';
  const fullClassData = allClassesData.find(c => c.name === selectedClassName);

  const isCleric2024 = ruleset === '2024' && selectedClassName === 'Cleric';
  const isDruid2024 = ruleset === '2024' && selectedClassName === 'Druid';

  const divineOrderOptions = isCleric2024 ? ['Protector', 'Thaumaturge'] : [];
  const primalOrderOptions = isDruid2024 ? ['Magician', 'Warden'] : [];

  const handleClassChange = (e) => {
    const name = e.target.value;
    const cls = allClassesData.find(c => c.name === name);
    const hasSubs = (cls?.subclasses || cls?.majors || []).length > 0;
    onInputChange('class', {
      name: name,
      subclass: hasSubs ? { name: '' } : { name: '' },
      divineOrder: '',
      primalOrder: ''
    });
  };

  return (
    <div className="wizard-step wizard-step-class">
      <h2>Step 6: Class</h2>

      <div className="form-group">
        <label>Class *</label>
        <select
          value={selectedClassName}
          onChange={handleClassChange}
          className={errors.class ? 'error' : ''}
        >
          <option value="">Select a class</option>
          {allClassesData.map(cls => (
            <option key={cls.index || cls.name} value={cls.name}>{cls.name}</option>
          ))}
        </select>
        {errors.class && <span className="error-message">{errors.class}</span>}
      </div>

      {isCleric2024 && (
        <div className="form-group">
          <label>Divine Order *</label>
          <select
            value={formData.class?.divineOrder || ''}
            onChange={(e) => onInputChange('class', { ...formData.class, divineOrder: e.target.value })}
            className={errors.divineOrder ? 'error' : ''}
          >
            <option value="">Select a Divine Order</option>
            {divineOrderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.divineOrder && <span className="error-message">{errors.divineOrder}</span>}
        </div>
      )}

      {isDruid2024 && (
        <div className="form-group">
          <label>Primal Order *</label>
          <select
            value={formData.class?.primalOrder || ''}
            onChange={(e) => onInputChange('class', { ...formData.class, primalOrder: e.target.value })}
            className={errors.primalOrder ? 'error' : ''}
          >
            <option value="">Select a Primal Order</option>
            {primalOrderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.primalOrder && <span className="error-message">{errors.primalOrder}</span>}
        </div>
      )}

      {fullClassData && <ClassDetailCard fullClassData={fullClassData} />}
    </div>
  );
}

export default WizardStepClass;
