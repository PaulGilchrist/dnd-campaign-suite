import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';

export default createJsonEntityRouter('factions', {
  pluralDisplayName: 'Factions',
  singularDisplayName: 'Faction',
});
