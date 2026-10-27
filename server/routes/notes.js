import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { publish } from '../utils/changeData.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

// Mirrors broadcastNPCsList (routes/npcs.js): every list mutation publishes a
// `notes-list-<campaign>` SSE event so other GM tabs re-fetch live.
const broadcastNotesList = (action, campaign, payload = {}) => {
  publish(`notes-list-${campaign}`, { action, ...payload }, campaign);
};

export default createJsonEntityRouter('notes', {
  pluralDisplayName: 'notes',
  singularDisplayName: 'Note',
  // 409 conflict copy labels rows by the same field the list renders as the
  // row title (Notes.jsx noteDisplayName); blank titles fall back to the id.
  displayField: 'partyLocation',
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
