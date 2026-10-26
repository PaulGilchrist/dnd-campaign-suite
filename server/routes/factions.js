import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';
import { publish } from '../utils/changeData.js';

// Mirrors broadcastNPCsList (routes/npcs.js): every list mutation publishes a
// `factions-list-<campaign>` SSE event so other GM tabs re-fetch live.
const broadcastFactionsList = (action, campaign, payload = {}) => {
  publish(`factions-list-${campaign}`, { action, ...payload }, campaign);
};

export default createJsonEntityRouter('factions', {
  pluralDisplayName: 'Factions',
  singularDisplayName: 'Faction',
  broadcast: broadcastFactionsList,
  validateList: (factions) => findDuplicateNameError(factions, 'faction'),
});
