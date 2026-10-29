import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { publish } from '../utils/changeData.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

// Mirrors Notes.jsx noteDisplayName (the row title the list renders and the
// delete/close confirms quote): party location, else a plain-text excerpt of
// the description. Used to label 409 conflict copy from the row it is given —
// the shared lane then names rows by the SENDER's loaded copy (see
// findConcurrentWrite), so a remote edit can never flip the banner identity.
const stripMarkdownSymbols = (text) => text
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`~#>]+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const noteRowLabel = (note) => {
  const location = (note.partyLocation || '').trim();
  if (location) return location;
  const plain = stripMarkdownSymbols(note.description || '');
  return plain.length > 40 ? plain.slice(0, 40) + '…' : plain;
};

// Mirrors broadcastNPCsList (routes/npcs.js): every list mutation publishes a
// `notes-list-<campaign>` SSE event so other GM tabs re-fetch live.
const broadcastNotesList = (action, campaign, payload = {}) => {
  publish(`notes-list-${campaign}`, { action, ...payload }, campaign);
};

export default createJsonEntityRouter('notes', {
  pluralDisplayName: 'notes',
  singularDisplayName: 'Note',
  // 409 conflict copy labels rows by the same recipe the list renders as the
  // row title (Notes.jsx noteDisplayName); blank labels fall back to the id.
  // The shared lane prefers the label derived from the sender's body copy
  // (what it loaded) over the current disk row — notes-conflict-banner-
  // identity-flip (2026-10-29-V).
  rowLabel: noteRowLabel,
  broadcast: broadcastNotesList,
  transformList: (entities, req) => {
    if (!isLocalhost(req)) {
      return entities.filter(note => !note.isPrivate);
    }
    return entities;
  },
  authorizeRead: (entity, req) => {
    if (!isLocalhost(req) && entity.isPrivate) {
      return false;
    }
    return true;
  },
  forbiddenMessage: 'Access denied: private note',
});
