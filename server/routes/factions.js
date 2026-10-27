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
  // 409 conflict copy labels rows by the same field the list renders as the
  // row title (Factions.jsx row name); blank names fall back to the id.
  displayField: 'name',
  broadcast: broadcastFactionsList,
  validateList: (factions) => findDuplicateNameError(factions, 'faction'),
});
