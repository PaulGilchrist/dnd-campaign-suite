import { useState } from 'react';

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
      setSelected(prev => {
        if (prev.includes(key)) return prev.filter(k => k !== key);
        if (prev.length >= maxSelections) return prev;
        return [...prev, key];
      });
    } else {
      setSelected(key);
    }
  };

  const isSelected = (option) => {
    const key = getOptionKey(option);
    return multiSelect ? selected.includes(key) : selected === key;
  };

  const isExisting = (option) => existingSelections.includes(getOptionKey(option));

  const handleApply = async () => {
    if ((multiSelect && selected.length === 0) || (!multiSelect && !selected)) return;
    const res = await onConfirm(selected);
    if (resultView) {
      setResult(res);
      setApplied(true);
    }
  };

  if (applied && result) {
    return (
      <div className="sp-overlay" onClick={onClose}>
        <div className="sp-modal" onClick={e => e.stopPropagation()}>
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

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
              const atMax = multiSelect && selected.length >= maxSelections && !isSel;

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
                <label
                  key={i}
                  className={`choice-option${isSel ? ' choice-selected' : ''}${isEx && !isSel ? ' choice-existing' : ''}${atMax ? ' choice-disabled' : ''}`}
                >
                  <input
                    type={multiSelect ? 'checkbox' : 'radio'}
                    name={inputName}
                    checked={isSel}
                    onChange={() => handleToggle(opt)}
                    disabled={atMax}
                  />
                  <span className="choice-label">
                    <strong>{getOptionLabel(opt)}</strong>
                    {getOptionDescription(opt) && (
                      <span className="choice-description"> — {getOptionDescription(opt)}</span>
                    )}
                  </span>
                  {isEx && !isSel && <span className="choice-existing-badge">(current)</span>}
                </label>
              );
            })}
          </div>
        </div>
        <div className="sp-actions">
          <button className="sp-roll-btn" onClick={handleApply} disabled={multiSelect ? selected.length === 0 : !selected}>
            <i className={`fa-solid ${confirmIcon || icon}`}></i> {confirmLabel}
          </button>
          <button className="sp-dismiss-btn" onClick={onClose}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
