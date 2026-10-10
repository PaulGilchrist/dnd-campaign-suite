import { createJsonEntityRouter } from '../utils/jsonEntityCrud.js';
import { findDuplicateNameError } from '../utils/nameUniqueness.js';

export default createJsonEntityRouter('factions', {
  pluralDisplayName: 'Factions',
  singularDisplayName: 'Faction',
  validateList: (factions) => findDuplicateNameError(factions, 'faction'),
});
