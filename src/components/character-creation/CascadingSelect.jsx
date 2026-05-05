import React from 'react';

function CascadingSelect({
  label,
  options,
  subOptionsSelector,
  fieldName,
  childFieldName,
  childValueKey,
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

  const childLabel = childLabelProp
    ? (ruleset === '2024' ? `${childLabelProp} (Major)` : childLabelProp)
    : (ruleset === '2024' ? `${label} (Major)` : label);

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
          value={formData[fieldName]?.name || ''}
          onChange={handleParentChange}
          className={errors[fieldName] ? 'error' : ''}
        >
          <option value="">Select a {label.toLowerCase()}</option>
          {options.length > 0 ? (
            options.map(option => (
              <option key={option[optionsKey] || option.index} value={option[optionsKey] || option.index}>
                {option[optionsKey] || option.index}
              </option>
            ))
          ) : (
            <option value="">{loadingText}</option>
          )}
        </select>
        {errors[fieldName] && <span className="error-message">{errors[fieldName]}</span>}
      </div>

      {availableSubOptions.length > 0 && (
        <div className="form-group">
          <label>{childLabel} *</label>
          <select
            value={formData[fieldName]?.[childFieldName]?.name || ''}
            onChange={handleChildChange}
            className={errors[errorKey] ? 'error' : ''}
          >
            <option value="">Select a {childLabel.toLowerCase()}</option>
            {availableSubOptions.map(option => (
              <option key={option[childOptionsKey] || option[childOptionsIndexKey]} value={option[childOptionsKey] || option[childOptionsIndexKey]}>
                {option[childOptionsKey] || option[childOptionsIndexKey]}
              </option>
            ))}
          </select>
          {errors[errorKey] && <span className="error-message">{errors[errorKey]}</span>}
        </div>
      )}
    </div>
  );
}

export default CascadingSelect;
