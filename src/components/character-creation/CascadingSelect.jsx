
function resolveChildLabel(label, childLabelProp, ruleset) {
  const text = childLabelProp || label;
  return ruleset === '2024' ? `${text} (Major)` : text;
}

function optionValue(option, key, fallbackKey = 'index') {
  return option[key] || option[fallbackKey];
}

function ParentOptionList({ options, optionsKey, loadingText }) {
  if (options.length === 0) {
    return <option value="">{loadingText}</option>;
  }
  return options.map(option => {
    const value = optionValue(option, optionsKey);
    return <option key={value} value={value}>{value}</option>;
  });
}

function ChildOptionList({ options, childOptionsKey, childOptionsIndexKey }) {
  return options.map(option => {
    const value = optionValue(option, childOptionsKey, childOptionsIndexKey);
    return <option key={value} value={value}>{value}</option>;
  });
}

function SubOptionsBlock({ childLabel, parentData, childFieldName, error, options, childOptionsKey, childOptionsIndexKey, onChange }) {
  return (
    <ChildSelect
      childLabel={childLabel}
      value={parentData?.[childFieldName]?.name || ''}
      onChange={onChange}
      className={error ? 'error' : ''}
      error={error}
      options={options}
      childOptionsKey={childOptionsKey}
      childOptionsIndexKey={childOptionsIndexKey}
    />
  );
}

function CascadingSelect({
  label,
  options,
  subOptionsSelector,
  fieldName,
  childFieldName,
  errorKey,
  loadingText,
  ruleset,
  formData,
  onInputChange,
  errors,
  childOptionsKey = 'name',
  childOptionsIndexKey = 'index',
  childExtraFields = {},
  childLabel: childLabelProp = null,
  optionsKey = 'name'
}) {
  const selectedParentValue = formData[fieldName]?.name || '';

  const availableSubOptions = subOptionsSelector(selectedParentValue) || [];
  const childError = errors[errorKey];

  const childLabel = resolveChildLabel(label, childLabelProp, ruleset);

  const handleParentChange = (e) => {
    onInputChange(fieldName, { name: e.target.value });
  };

  const handleChildChange = (e) => {
    const updatedParent = {
      ...formData[fieldName],
      [childFieldName]: { name: e.target.value, ...childExtraFields }
    };
    onInputChange(fieldName, updatedParent);
  };

  return (
    <div>
      <div className="form-group">
        <label>{label} *</label>
        <select
          value={selectedParentValue}
          onChange={handleParentChange}
          className={errors[fieldName] ? 'error' : ''}
        >
          <option value="">Select a {label.toLowerCase()}</option>
          <ParentOptionList options={options} optionsKey={optionsKey} loadingText={loadingText} />
        </select>
        {errors[fieldName] && <span className="error-message">{errors[fieldName]}</span>}
      </div>

      {availableSubOptions.length > 0 && (
        <SubOptionsBlock
          childLabel={childLabel}
          parentData={formData[fieldName]}
          childFieldName={childFieldName}
          error={childError}
          options={availableSubOptions}
          childOptionsKey={childOptionsKey}
          childOptionsIndexKey={childOptionsIndexKey}
          onChange={handleChildChange}
        />
      )}
    </div>
  );
}

function ChildSelect({ childLabel, value, onChange, className, error, options, childOptionsKey, childOptionsIndexKey }) {
  return (
    <div className="form-group">
      <label>{childLabel} *</label>
      <select value={value} onChange={onChange} className={className}>
        <option value="">Select a {childLabel.toLowerCase()}</option>
        <ChildOptionList
          options={options}
          childOptionsKey={childOptionsKey}
          childOptionsIndexKey={childOptionsIndexKey}
        />
      </select>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}

export default CascadingSelect;
