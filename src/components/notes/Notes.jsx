import React, { useState, useEffect, useMemo } from 'react';
import useNotesManagement from '../../hooks/useNotesManagement.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import './Notes.css';

function Notes({ campaignName, characters, isLocalhost, onBack }) {
  const { notes, loading, loadNotesList, saveNotesList, deleteNoteAction } =
    useNotesManagement(campaignName);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load notes on mount
  useEffect(() => {
    if (campaignName) {
      loadNotesList();
    }
  }, [campaignName, loadNotesList]);

  // Auto-calculated party level
  const partyLevel = useMemo(() => {
    if (!characters || characters.length === 0) return 1;
    const total = characters.reduce((sum, c) => sum + (c.level || 1), 0);
    return Math.round(total / characters.length);
  }, [characters]);

  // Filtered notes based on search
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter((note) =>
      note.description.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  // Open modal for new note
  const handleNewNote = () => {
    setFormData({
      id: crypto.randomUUID(),
      description: '',
      isPrivate: false,
      dateCreated: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      partyLevel,
      partyLocation: '',
    });
    setEditingNote(null);
    setModalOpen(true);
  };

  // Open modal for editing a note
  const handleEditNote = (note) => {
    setFormData({ ...note });
    setEditingNote(note);
    setModalOpen(true);
  };

  // Close modal and reset
  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData(null);
    setEditingNote(null);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save note (create or update)
  const handleSave = async () => {
    if (!formData || !formData.description.trim()) return;

    setSaving(true);
    try {
      const updated = {
        ...formData,
        dateModified: new Date().toISOString(),
      };
      const updatedNotes = editingNote
        ? notes.map((n) => (n.id === editingNote.id ? updated : n))
        : [...notes, updated];

      await saveNotesList(updatedNotes);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete note
  const handleDelete = async () => {
    if (!editingNote) return;

    if (!window.confirm('Delete this note?')) return;

    setDeleting(true);
    try {
      await deleteNoteAction(editingNote.id);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  // Truncate description for preview
  const truncateDescription = (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '…';
  };

  return (
    <div className="ct-container">
      {/* Header */}
      <div className="ct-header">
        <button className="ct-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <h2 className="ct-title">
          <i className="fa-solid fa-book-open" /> Notes
        </h2>
        <button className="ct-new-btn" onClick={handleNewNote}>
          <i className="fa-solid fa-plus" /> New Note
        </button>
      </div>

      {/* Search bar */}
      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search notes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search notes"
        />
        {searchQuery && (
          <button
            className="ct-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading notes…
        </div>
      )}

      {/* Notes list */}
      {!loading && filteredNotes.length === 0 && (
        <div className="ct-empty-state">
          {searchQuery ? (
            <>
              <i className="fa-solid fa-search" />
              No notes found matching &ldquo;{searchQuery}&rdquo;
            </>
          ) : (
            <>
              <i className="fa-solid fa-book-open" />
              No notes yet. Click &ldquo;New Note&rdquo; to create one.
            </>
          )}
        </div>
      )}

      {!loading && filteredNotes.length > 0 && (
        <ul className="ct-list">
          {filteredNotes.map((note) => (
            <li
              key={note.id}
              className="ct-list-item"
              onClick={() => handleEditNote(note)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleEditNote(note);
                }
              }}
              aria-label={`Edit note: ${truncateDescription(note.description, 50)}`}
            >
              <div className="ct-list-item-header">
                <span className="notes-list-location">
                  {note.partyLocation ? (
                    <>
                      <i className="fa-solid fa-location-dot" />{' '}
                      {note.partyLocation}
                    </>
                  ) : (
                    <span className="notes-list-no-location">No location</span>
                  )}
                </span>
                <div className="notes-list-meta">
                  <span className="notes-list-date">
                    <i className="fa-solid fa-clock" /> {formatDate(note.dateModified)}
                  </span>
                  {note.isPrivate && (
                    <span className="notes-list-private" title="Private note">
                      <i className="fa-solid fa-lock" />
                    </span>
                  )}
                </div>
              </div>
              <p className="notes-list-description">
                {truncateDescription(note.description, 150)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && formData && (
        <div className="ct-modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseModal();
        }}>
          <div className="ct-modal">
            <div className="ct-modal-header">
              <h3>{editingNote ? 'Edit Note' : 'New Note'}</h3>
              <button
                className="ct-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="ct-modal-body">
              {/* Description (largest input) */}
              <PreviewToggle
                id="note-description"
                value={formData.description}
                onChange={(value) => handleFormChange('description', value)}
                placeholder="Write your note here…"
                label="Description"
                minHeight="200px"
              />

              {/* Party Location */}
              <label htmlFor="note-location" className="ct-label">
                Party Location
              </label>
              <input
                id="note-location"
                type="text"
                className="ct-input"
                value={formData.partyLocation}
                onChange={(e) => handleFormChange('partyLocation', e.target.value)}
                placeholder="e.g., Skull Creek Cave"
              />

              {/* Party Level (auto-calculated, read-only) */}
              <div className="notes-field-group">
                <label className="ct-label">Party Level</label>
                <span className="notes-readonly">{partyLevel}</span>
              </div>

              {/* Date Created (auto-set, read-only) */}
              <div className="notes-field-group">
                <label className="ct-label">Date Created</label>
                <span className="notes-readonly">{formatDate(formData.dateCreated)}</span>
              </div>

              {/* Date Modified (auto-set, read-only) */}
              <div className="notes-field-group">
                <label className="ct-label">Date Modified</label>
                <span className="notes-readonly">{formatDate(formData.dateModified)}</span>
              </div>

              {/* Is Private (localhost only) */}
              {isLocalhost && (
                <div className="notes-checkbox-row">
                  <input
                    id="note-private"
                    type="checkbox"
                    className="notes-checkbox"
                    checked={formData.isPrivate}
                    onChange={(e) => handleFormChange('isPrivate', e.target.checked)}
                  />
                  <label htmlFor="note-private" className="notes-checkbox-label">
                    <i className="fa-solid fa-lock" /> Private Note
                  </label>
                </div>
              )}
            </div>

            <div className="ct-modal-footer">
              <div className="ct-modal-actions">
                {editingNote && (
                  <button
                    className="ct-btn ct-btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <i className="fa-solid fa-trash-can" />{' '}
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
              <div className="ct-modal-buttons">
                <button
                  className="ct-btn ct-btn-secondary"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="ct-btn ct-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !formData.description.trim()}
                >
                  <i className="fa-solid fa-floppy-disk" />{' '}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notes;
