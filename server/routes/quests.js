import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

export default createJsonEntityRouter('quests', {
  pluralDisplayName: 'quests',
  singularDisplayName: 'quest',
  validateList: (quests) => findDuplicateNameError(quests, 'quest'),
  transformList: (entities, req) => {
    if (!isLocalhost(req)) return [];
    return entities;
  },
  authorizeRead: (entity, req) => {
    if (!isLocalhost(req)) return false;
    return true;
  },
  forbiddenMessage: 'Access denied: GM-only feature',
});
