// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import * as baseCombatActions from './baseCombatActions.js';

// Lane: golden census of authored combat constants — exact bytes, whole export
// surface (SUT unmocked). Sole consumer anchor: CharReactions.jsx,
// useLoggedDiceRollSaves.js, opportunityTrigger.js, bonusActionAttackHandler.js,
// reactionDamageHandler.js, soulOfVengeanceHandler.js — every consumer test
// vi.mock's this module with pinned copies of these bytes, so this census is
// the anchor those fakes must not drift from. Adding, removing, or editing any
// export fails here toEqual on both keys and values.
describe('baseCombatActions', () => {
  it('exports the full authored constant roster, byte-exact', () => {
    expect({ ...baseCombatActions }).toEqual({
      OPPORTUNITY_ATTACK: {
        name: 'Opportunity Attack',
        description: 'Can attack creature that moves out of your reach',
      },
      MELEE_REACH_FEET: 5,
    });
  });
});
