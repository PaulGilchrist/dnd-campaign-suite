import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

export default createJsonEntityRouter('notes', {
  pluralDisplayName: 'notes',
  singularDisplayName: 'note',
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
