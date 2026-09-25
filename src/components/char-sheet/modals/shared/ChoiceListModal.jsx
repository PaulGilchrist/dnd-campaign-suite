import { useState } from 'react';

function toggleSelectionKey(prev, key, maxSelections) {
  if (prev.includes(key)) return prev.filter(k => k !== key);
  if (prev.length >= maxSelections) return prev;
  return [...prev, key];
}

function optionIsSelected(multiSelect, selected, key) {
  return multiSelect ? selected.includes(key) : selected === key;
}

function optionAtMax(multiSelect, selected, maxSelections, isSel) {
  return multiSelect && selected.length >= maxSelections && !isSel;
}

function choiceApplyBlocked(multiSelect, selected) {
  return (multiSelect && selected.length === 0) || (!multiSelect && !selected);
}

function ChoiceResultView({ icon, title, result, onClose }) {
  return (
    <div className="sp-overlay">
      <div className="sp-modal">
        <div className="sp-header">
          <i className={`fa-solid ${icon}`}></i> {title}
        </div>
        <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload?.description || '' }}>
        </div>
        <div className="sp-actions">
          <button className="sp-roll-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function DefaultChoiceOptionRow({ option, isSelected, isExisting, disabled, multiSelect, inputName, getOptionLabel, getOptionDescription, onToggle }) {
  return (
    <label
      className={`choice-option${isSelected ? ' choice-selected' : ''}${isExisting && !isSelected ? ' choice-existing' : ''}${disabled ? ' choice-disabled' : ''}`}
    >
      <input
        type={multiSelect ? 'checkbox' : 'radio'}
        name={inputName}
        checked={isSelected}
        onChange={onToggle}
        disabled={disabled}
      />
      <span className="choice-label">
        <strong>{getOptionLabel(option)}</strong>
        {getOptionDescription(option) && (
          <span className="choice-description"> — {getOptionDescription(option)}</span>
        )}
      </span>
      {isExisting && !isSelected && <span className="choice-existing-badge">(current)</span>}
    </label>
  );
}

function ChoiceConfirmButton({ multiSelect, selected, confirmIcon, icon, confirmLabel, onApply }) {
  return (
    <button className="sp-roll-btn" onClick={onApply} disabled={multiSelect ? selected.length === 0 : !selected}>
      <i className={`fa-solid ${confirmIcon || icon}`}></i> {confirmLabel}
    </button>
  );
}

function ChoiceListContent({
  icon,
  title,
  description,
  options,
  multiSelect,
  selected,
  maxSelections,
  inputName,
  SelectedComponent,
  isSelected,
  isExisting,
  handleToggle,
  handleApply,
  confirmIcon,
  confirmLabel,
  cancelLabel,
  getOptionLabel,
  getOptionDescription,
  onClose,
}) {
  return (
    <div className="sp-overlay">
      <div className="sp-modal">
        <div className="sp-header">
          <i className={`fa-solid ${icon}`}></i> {title}
        </div>
        <div className="sp-body">
          {description && <p>{description}</p>}
          {multiSelect && (
            <p style={{ fontSize: '0.9em', opacity: 0.7, marginTop: '4px' }}>
              Selected: {selected.length} / {maxSelections}
            </p>
          )}
          <div className="choice-list">
            {options.map((opt, i) => {
              const isSel = isSelected(opt);
              const isEx = isExisting(opt);
              const atMax = optionAtMax(multiSelect, selected, maxSelections, isSel);

              if (SelectedComponent) {
                return (
                  <SelectedComponent
                    key={i}
                    option={opt}
                    selected={isSel}
                    existing={isEx}
                    disabled={atMax}
                    onToggle={() => handleToggle(opt)}
                  />
                );
              }

              return (
                <DefaultChoiceOptionRow
                  key={i}
                  option={opt}
                  isSelected={isSel}
                  isExisting={isEx}
                  disabled={atMax}
                  multiSelect={multiSelect}
                  inputName={inputName}
                  getOptionLabel={getOptionLabel}
                  getOptionDescription={getOptionDescription}
                  onToggle={() => handleToggle(opt)}
                />
              );
            })}
          </div>
        </div>
        <div className="sp-actions">
          <ChoiceConfirmButton multiSelect={multiSelect} selected={selected} confirmIcon={confirmIcon} icon={icon} confirmLabel={confirmLabel} onApply={handleApply} />
          <button className="sp-dismiss-btn" onClick={onClose}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function ChoiceListModal({
  icon,
  title,
  description,
  options,
  multiSelect = false,
  maxSelections = 1,
  existingSelections = [],
  confirmLabel = 'Confirm',
  confirmIcon,
  cancelLabel = 'Cancel',
  resultView = false,
  inputName = 'choiceOption',
  SelectedComponent,
  onConfirm,
  onClose,
  getOptionKey = (opt) => opt.name || opt.id,
  getOptionLabel = (opt) => opt.name,
  getOptionDescription = (opt) => opt.description,
}) {
  const [selected, setSelected] = useState(multiSelect ? [] : null);
  const [applied, setApplied] = useState(false);
  const [result, setResult] = useState(null);

  const handleToggle = (option) => {
    const key = getOptionKey(option);
    if (multiSelect) {
      setSelected(prev => toggleSelectionKey(prev, key, maxSelections));
    } else {
      setSelected(key);
    }
  };

  const isSelected = (option) => optionIsSelected(multiSelect, selected, getOptionKey(option));

  const isExisting = (option) => existingSelections.includes(getOptionKey(option));

  const handleApply = async () => {
    if (choiceApplyBlocked(multiSelect, selected)) return;
    const res = await onConfirm(selected);
    if (resultView) {
      setResult(res);
      setApplied(true);
    }
  };

  if (applied && result) {
    return <ChoiceResultView icon={icon} title={title} result={result} onClose={onClose} />;
  }

  return (
    <ChoiceListContent
      icon={icon}
      title={title}
      description={description}
      options={options}
      multiSelect={multiSelect}
      selected={selected}
      maxSelections={maxSelections}
      inputName={inputName}
      SelectedComponent={SelectedComponent}
      isSelected={isSelected}
      isExisting={isExisting}
      handleToggle={handleToggle}
      handleApply={handleApply}
      confirmIcon={confirmIcon}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      getOptionLabel={getOptionLabel}
      getOptionDescription={getOptionDescription}
      onClose={onClose}
    />
  );
}
