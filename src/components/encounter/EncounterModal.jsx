import React, { useState, useEffect } from 'react';
import { formatEncounterName } from '../../services/encountersService.js';
import './EncounterBuilder.css';

function EncounterModal({ isOpen, onClose, mode, onSave, onLoad, onDelete, onRename, encounters, loading }) {
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);

  useEffect(() => {
    if (mode === 'save') {
      setName('');
      setError('');
    } else if (mode === 'rename' && renameTarget) {
      setNewName(renameTarget.name);
      setError('');
    }
  }, [mode, renameTarget]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Encounter name is required');
      return;
    }
    setError('');
    await onSave(name.trim());
    setName('');
    onClose();
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      setError('New name is required');
      return;
    }
    setError('');
    await onRename(renameTarget.name, newName.trim());
    setRenameTarget(null);
    setNewName('');
  };

  const handleDelete = async (encounterName) => {
    if (window.confirm(`Delete "${formatEncounterName(encounterName)}"?`)) {
      await onDelete(encounterName);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="encounter-modal-overlay" onClick={handleBackdropClick}>
      <div className="encounter-modal">
        <div className="encounter-modal-header">
          <h3>
            {mode === 'save' && 'Save Encounter'}
            {mode === 'load' && 'Load Encounter'}
            {mode === 'rename' && 'Rename Encounter'}
          </h3>
          <button className="encounter-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="encounter-modal-body">
          {error && <div className="encounter-modal-error">{error}</div>}

          {mode === 'save' && (
            <div className="encounter-modal-save">
              <label htmlFor="encounter-name">Encounter Name</label>
              <input
                id="encounter-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Goblin Ambush"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button className="encounter-btn encounter-btn-primary" onClick={handleSave}>
                <i className="fa-solid fa-floppy-disk" /> Save
              </button>
            </div>
          )}

          {mode === 'rename' && (
            <div className="encounter-modal-rename">
              <label htmlFor="encounter-rename">New Name</label>
              <input
                id="encounter-rename"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                autoFocus
              />
              <button className="encounter-btn encounter-btn-primary" onClick={handleRename}>
                <i className="fa-solid fa-pen" /> Rename
              </button>
            </div>
          )}

          {mode === 'load' && (
            <div className="encounter-modal-load">
              {loading ? (
                <div className="encounter-modal-loading">Loading...</div>
              ) : encounters.length === 0 ? (
                <div className="encounter-modal-empty">No saved encounters yet.</div>
              ) : (
                <ul className="encounter-list">
                  {encounters.map((enc) => (
                    <li key={enc.name} className="encounter-list-item">
                      <div className="encounter-list-info">
                        <span className="encounter-list-name">{formatEncounterName(enc.name)}</span>
                        {enc.savedAt && (
                          <span className="encounter-list-date">
                            {new Date(enc.savedAt).toLocaleDateString()} {new Date(enc.savedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className="encounter-list-actions">
                        <button
                          className="encounter-btn encounter-btn-sm encounter-btn-primary"
                          onClick={() => onLoad(enc.name)}
                          aria-label={`Load ${enc.name}`}
                        >
                          <i className="fa-solid fa-download" /> Load
                        </button>
                        <button
                          className="encounter-btn encounter-btn-sm encounter-btn-secondary"
                          onClick={() => setRenameTarget(enc)}
                          aria-label={`Rename ${enc.name}`}
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button
                          className="encounter-btn encounter-btn-sm encounter-btn-danger"
                          onClick={() => handleDelete(enc.name)}
                          aria-label={`Delete ${enc.name}`}
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EncounterModal;
