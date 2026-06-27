import { useState, useCallback } from 'react';
import TargetPopupBase from './TargetPopupBase';

export default function TargetWithCheckboxesPopup({
  spell, creatureTargets, onConfirm, onSkip,
  icon, title, school, defaultLevel, description, confirmLabel, cancelLabel,
  loadTargetData, noItemsMessage,
}) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [checkboxes, setCheckboxes] = useState([]);
  const [selections, setSelections] = useState([]);

  const handleTargetClick = useCallback((name) => {
    setSelectedTarget(name);
    setSelections([]);
    const maybePromise = loadTargetData(name);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(result => {
        setCheckboxes(result || []);
      }).catch(() => {
        setCheckboxes([]);
      });
    } else {
      setCheckboxes(maybePromise || []);
    }
  }, [loadTargetData]);

  const toggleSelection = useCallback((checkbox) => {
    setSelections(prev => {
      const exists = prev.some(s => s.id === checkbox.id);
      if (exists) return prev.filter(s => s.id !== checkbox.id);
      return [...prev, checkbox];
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedTarget || selections.length === 0) return;
    onConfirm({ targetName: selectedTarget, selections: selections.map(s => s.selectionData) });
  }, [selectedTarget, selections, onConfirm]);

  const needsTarget = !selectedTarget;
  const needsSelection = selections.length === 0;

  return (
    <TargetPopupBase
      icon={icon}
      title={title}
      spell={spell}
      school={school}
      defaultLevel={defaultLevel}
      description={description}
      confirmDisabled={needsTarget || needsSelection}
      confirmLabel={confirmLabel || `Cast ${title}`}
      cancelLabel={cancelLabel || 'Cancel'}
      onConfirm={handleConfirm}
      onSkip={onSkip}
    >
      <div className="metamagic-twin-target">
        <label>
          <strong>Target:</strong>
          <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
            {creatureTargets.map(name => (
              <div
                key={name}
                onClick={() => handleTargetClick(name)}
                style={{
                  padding: '6px 10px',
                  margin: '4px 0',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  backgroundColor: selectedTarget === name ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  border: selectedTarget === name ? '1px solid #4CAF50' : '1px solid transparent',
                }}
              >
                {selectedTarget === name ? '\u2713 ' : ''}{name}
              </div>
            ))}
          </div>
        </label>
      </div>
      {selectedTarget && (
        <div className="metamagic-twin-target" style={{ marginTop: '12px' }}>
          <label>
            <strong>Effects to remove from {selectedTarget}:</strong>
            <div style={{ marginTop: '8px' }}>
              {checkboxes.map(cb => {
                const isSelected = selections.some(s => s.id === cb.id);
                return (
                  <div
                    key={cb.id}
                    onClick={() => toggleSelection(cb)}
                    style={{
                      padding: '6px 10px',
                      margin: '4px 0',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                      border: isSelected ? '1px solid #4CAF50' : '1px solid transparent',
                    }}
                  >
                    {isSelected ? '\u2713 ' : ''}{cb.label}
                  </div>
                );
              })}
              {checkboxes.length === 0 && (
                <div style={{ padding: '6px 10px', fontStyle: 'italic', color: '#999' }}>
                  {noItemsMessage || 'No applicable effects found on this target'}
                </div>
              )}
            </div>
          </label>
        </div>
      )}
    </TargetPopupBase>
  );
}
