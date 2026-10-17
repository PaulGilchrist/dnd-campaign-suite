// @maintained-by-ai
// Branch-coverage lane for CharSpecialActions — pins ONLY the branches no
// other CharSpecialActions.* test reaches:
//   1. buildUniqueSpecialActions cross-list collision guards: name filtering
//      against actions / bonusActions / reactions / characterAdvancement,
//      unique-name preservation, and Map dedup keep-last semantics. Handed
//      off to this file by CharSpecialActions.test.jsx's header ("cross-list
//      action filtering lives in uncovered.edge-cases.test.jsx"). Positive
//      controls ("Control Action:") pin real filtering, not whole-list loss.
//   2. useEffect cancelled-guard: unmount while loadFightingStyles is pending
//      (ownership pointed here by CharSpecialActions.test.jsx header).
//      React ignores post-unmount setState, so the guard is not DOM-observable
//      — kept as a crash-guard with a precondition pin (the loader must have
//      been called). mockReturnValueOnce scopes the deferred promise to THIS
//      mount so it can never poison later renders in this file.
//   3. Portent event display label (getEventDisplayLabel): all six label
//      branches (attack with/without targetName, ability with/without
//      checkName, save with/without saveType). Asserted nowhere else —
//      combatHandlers/modalsInline open the same modal but pin only the
//      die-choice handler and roll math, never the label text. Migrated
//      here from CharSpecialActions.uncovered.feature-modals.test.jsx
//      (deleted; that file had shrunk to this one test, and its own header
//      recommended the merge). Labels are pinned inside the portent-modal
//      container so a stray match elsewhere on the sheet cannot satisfy them.
//
// Owned elsewhere (do not re-pin here):
//   - Row/section composition, fighting-style append, fighting-style
//     shadow-guard, featuresToIgnore + 'Level 1 Spell [Instance' exclusion,
//     Shape-Shift runtime row → CharSpecialActions.test.jsx
//   - executeHandler popup-result rendering incl. fallback name (the popup
//     branch never opens modals — no-modal negatives live there too) →
//     CharSpecialActions.automationClickHandlers.test.jsx
//   - modalName routing → CharSpecialActions.modals.test.jsx; close/dismiss
//     inertness → CharSpecialActions.modalOnClose.* quartet
//   - Confirm/skip handler paths incl. creature-selection flows → .handlers,
//     .modalsInline, .combatHandlers, .craftingHandlers, .uncovered.handlers
//
// Removed in this pass:
//   - "does not render creature selection when $name handler returns popup"
//     (Bolstering Performance / Encouraging Song): both automation types fall
//     through to the identical handleAutomationClick popup branch already
//     pinned by automationClickHandlers.test.jsx; the type choice was not a
//     distinct branch and the no-modal assertion was vacuous there.
//   - Standalone "unique names" test: folded into the collision table's
//     positive controls plus a kept-all test with all four lists populated.
//
// Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { loadFightingStyles } from '../../services/ui/dataLoader.js';
import { executeHandler } from '../../services/automation/index.js';

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 2,
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

// Rows render their name as the exact "<Name>:" label — use it for
// role-free exact-match queries (family pattern, per CharSpecialActions.test.jsx).
const CONTROL_ACTION = { name: 'Control Action', description: 'Stays visible.' };

describe('CharSpecialActions - useEffect cancelled guard', () => {
  it('survives loadFightingStyles resolving after unmount', async () => {
    let resolveLoad;
    const loadPromise = new Promise((resolve) => { resolveLoad = resolve; });
    // once-semantics: this mount consumes the deferred loader promise; every
    // later mount in this file falls back to the shared mock's immediate value.
    vi.mocked(loadFightingStyles).mockReturnValueOnce(loadPromise);

    const { unmount } = render(
      <CharSpecialActions
        playerStats={createPlayerStats({ class: { fightingStyles: ['Great Weapon Fighting'] } })}
        campaignName="test"
      />
    );
    // Precondition: without this call the "guard survived" conclusion is vacuous.
    expect(loadFightingStyles).toHaveBeenCalledTimes(1);

    // Unmount before the promise resolves so the cleanup flag flips.
    unmount();

    // Resolving after unmount must not throw (cancelled guard skips
    // setFightingStylesMap; DOM is gone either way — crash-guard, see header).
    await act(async () => {
      resolveLoad([{ name: 'Great Weapon Fighting', description: 'Raging swinging.' }]);
    });

    expect(screen.queryByText('Great Weapon Fighting:')).not.toBeInTheDocument();
  });
});

describe('CharSpecialActions - cross-list action filtering', () => {
  // One case per independent guard clause in buildUniqueSpecialActions.
  it.each([
    { listKey: 'actions' },
    { listKey: 'bonusActions' },
    { listKey: 'reactions' },
    { listKey: 'characterAdvancement' },
  ])('filters out a special action whose name collides with the $listKey list', ({ listKey }) => {
    const dup = { name: 'Duplicated Name', description: 'Shown elsewhere.' };
    render(
      <CharSpecialActions
        playerStats={createPlayerStats({
          specialActions: [dup, CONTROL_ACTION],
          [listKey]: [dup],
        })}
        campaignName="test"
      />
    );

    // Positive control: only the colliding row was dropped, the section still renders.
    expect(screen.getByText('Control Action:')).toBeInTheDocument();
    expect(screen.getByText('Stays visible.')).toBeInTheDocument();
    expect(screen.queryByText('Duplicated Name:')).not.toBeInTheDocument();
    expect(screen.queryByText('Shown elsewhere.')).not.toBeInTheDocument();
  });

  it('keeps every special action when no name collides across the four populated lists', () => {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta'];
    render(
      <CharSpecialActions
        playerStats={createPlayerStats({
          specialActions: names.map(n => ({ name: n, description: `${n} detail.` })),
          actions: [{ name: 'Attack', description: 'Make an attack.' }],
          bonusActions: [{ name: 'Second Wind', description: 'Regain hit points.' }],
          reactions: [{ name: 'Reaction Attack', description: 'Attack as a reaction.' }],
          characterAdvancement: [{ name: 'Feat', description: 'Take a feat.' }],
        })}
        campaignName="test"
      />
    );

    for (const name of names) {
      expect(screen.getByText(`${name}:`)).toBeInTheDocument();
    }
  });

  it('deduplicates same-name specialActions keeping the LAST definition (Map semantics)', () => {
    render(
      <CharSpecialActions
        playerStats={createPlayerStats({
          specialActions: [
            { name: 'Attack', description: 'First definition.' },
            { name: 'Attack', description: 'Second definition.' },
          ],
        })}
        campaignName="test"
      />
    );

    expect(screen.getAllByText('Attack:')).toHaveLength(1);
    // Keep-last pin: one row alone cannot distinguish first- vs last-wins.
    expect(screen.getByText('Second definition.')).toBeInTheDocument();
    expect(screen.queryByText('First definition.')).not.toBeInTheDocument();
  });
});

describe('CharSpecialActions - Portent event display label', () => {
  // Opens the real (unmocked) inline PortentBlock via the interactive
  // 'portent' automation lane; getEventDisplayLabel picks one of six label
  // strings from eventType + eventData — each row pins one branch exactly.
  async function openPortentModal(eventType, eventData) {
    // mockResolvedValue (not Once): overwritten per case, so a failed test
    // can never leave a stale Once queued for the next one.
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'portentDiceChoice',
      payload: {
        targetName: 'Goblin',
        eventType,
        eventData,
        diceOptions: [3, 7],
      },
    });
    render(
      <CharSpecialActions
        playerStats={createPlayerStats({
          specialActions: [
            { name: 'Portent', description: 'Replace a roll.', automation: { type: 'portent' } },
          ],
        })}
        campaignName="test"
      />
    );
    fireEvent.click(screen.getAllByText(/Portent/)[0]);
    return screen.findByTestId('portent-modal');
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      case: 'attack with targetName',
      eventType: 'attack',
      eventData: { d20: 15, bonus: 3, targetName: 'Orc', hit: true },
      label: 'Attack vs AC Orc',
    },
    {
      case: 'attack without targetName',
      eventType: 'attack',
      eventData: { d20: 15, bonus: 3, hit: false },
      label: 'Attack vs AC unknown',
    },
    {
      case: 'ability with checkName',
      eventType: 'ability',
      eventData: { d20: 12, bonus: 5, checkName: 'Sleight of Hand' },
      label: 'Sleight of Hand',
    },
    {
      case: 'ability without checkName',
      eventType: 'ability',
      eventData: { d20: 12, bonus: 5 },
      label: 'Ability check',
    },
    {
      // Original migrated pin: lowercase payload saveType must render upper.
      case: 'save with saveType',
      eventType: 'save',
      eventData: { d20: 10, bonus: 3, saveType: 'dexterity' },
      label: 'DEXTERITY',
    },
    {
      case: 'save without saveType',
      eventType: 'save',
      eventData: { d20: 10, bonus: 3 },
      label: 'Save',
    },
  ])('shows "$label" in the Portent modal for a $case event', async ({ eventType, eventData, label }) => {
    const modal = await openPortentModal(eventType, eventData);

    expect(within(modal).getByText(label)).toBeInTheDocument();
    // Rendered ONCE: no duplicate raw/lowercase variant of the label.
    expect(within(modal).getAllByText(label)).toHaveLength(1);
    if (label !== 'Save') {
      expect(within(modal).queryByText('Save')).not.toBeInTheDocument();
    }
    // Modal fully mounted (not a stray text fragment mid-render).
    expect(within(modal).getByText('Choose a foretelling roll:')).toBeInTheDocument();
  });
});
