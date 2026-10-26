import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';
import { publish } from '../utils/changeData.js';

const isLocalhost = (req) => req.hostname === 'localhost' || req.hostname === '127.0.0.1';

// Mirrors broadcastNPCsList (routes/npcs.js): every list mutation publishes a
// `quests-list-<campaign>` SSE event so other GM tabs re-fetch live.
const broadcastQuestsList = (action, campaign, payload = {}) => {
  publish(`quests-list-${campaign}`, { action, ...payload }, campaign);
};

export default createJsonEntityRouter('quests', {
  pluralDisplayName: 'quests',
  singularDisplayName: 'quest',
  broadcast: broadcastQuestsList,
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
