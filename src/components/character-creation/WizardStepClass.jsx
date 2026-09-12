import ClassDetailCard from './ClassDetailCard.jsx';
import ClassOrderSelect from './ClassOrderSelect.jsx';
import './WizardStepClass.css';

const CLASS_ORDER_CONFIGS = {
  2024: {
    Cleric: { field: 'divineOrder', label: 'Divine Order *', placeholder: 'Select a Divine Order', options: ['Protector', 'Thaumaturge'] },
    Druid: { field: 'primalOrder', label: 'Primal Order *', placeholder: 'Select a Primal Order', options: ['Magician', 'Warden'] },
  },
};

function WizardStepClass({ formData, errors, allClassesData, ruleset, onInputChange }) {
  const selectedClass = formData.class || {};
  const selectedClassName = selectedClass.name || '';
  const fullClassData = allClassesData.find(c => c.name === selectedClassName);
  const orderConfig = CLASS_ORDER_CONFIGS[ruleset]?.[selectedClassName];

  const handleClassChange = (e) => {
    onInputChange('class', {
      name: e.target.value,
      subclass: { name: '' },
      divineOrder: '',
      primalOrder: ''
    });
  };

  const handleOrderChange = (value) => {
    onInputChange('class', { ...selectedClass, [orderConfig.field]: value });
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

      {orderConfig && (
        <ClassOrderSelect
          config={orderConfig}
          value={selectedClass[orderConfig.field] || ''}
          error={errors[orderConfig.field]}
          onChange={handleOrderChange}
        />
      )}

      {fullClassData && <ClassDetailCard fullClassData={fullClassData} />}
    </div>
  );
}

export default WizardStepClass;
