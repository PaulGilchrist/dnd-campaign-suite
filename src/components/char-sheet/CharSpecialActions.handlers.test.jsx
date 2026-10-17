// @maintained-by-ai
// Shared mocks must be imported BEFORE the component so every vi.mock
// registration wins the module graph (mocks-first ordering law).
import './CharSpecialActions.modalMocks.jsx';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { confirmBolsteringPerformance } from '../../services/automation/handlers/buffs/tempHpBuffHandler.js';
import { skipEncouragingSong } from '../../services/automation/handlers/buffs/encouragingSongHandler.js';
import { addEntry } from '../../services/ui/logService.js';

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

// Captures setPopupHtml calls so tests can assert popup content.
function capturePopup() {
  const captured = { html: null };
  vi.mocked(useDiceRollPopup).mockReturnValue({
    setPopupHtml: (html) => { captured.html = html; },
  });
  return captured;
}

const aspectOfTheWildsAction = {
  name: 'Aspect of the Wilds',
  description: 'Choose an animal aspect.',
  automation: { type: 'animal_aspect' },
};

describe('CharSpecialActions - interactive automation handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
  });

  describe('Aspect of the Wilds', () => {
    const aspectTestData = [
      { aspect: 'Owl', effect: 'darkvision_aspect', popupText: 'Darkvision 60 ft.' },
      { aspect: 'Panther', effect: 'climb_speed_aspect', popupText: 'Climb speed equal to walking speed' },
      { aspect: 'Salmon', effect: 'swim_speed_aspect', popupText: 'Swim speed equal to walking speed' },
    ];

    it.each(aspectTestData)(
      'confirming $aspect stamps its $effect buff, marks the feature used, logs the choice, shows a popup, and closes the modal',
      async ({ aspect, effect, popupText }) => {
        const popup = capturePopup();
        mockRuntimeStore.aspectOfTheWildsUsedThisRest = false;

        const playerStats = createPlayerStats({ specialActions: [aspectOfTheWildsAction] });
        render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

        fireEvent.click(screen.getByText('Aspect of the Wilds:'));

        await waitFor(() => {
          expect(screen.getByText('Choose an animal aspect:')).toBeInTheDocument();
          expect(screen.getByText(aspect)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(aspect));

        await waitFor(() => {
          expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([
            { name: 'Aspect of the Wilds', effect, duration: 'infinite', optionName: aspect },
          ]), 'test');
          expect(screen.queryByText('Choose an animal aspect:')).not.toBeInTheDocument();
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'aspectOfTheWildsOption', aspect, 'test');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'aspectOfTheWildsUsedThisRest', true, 'test');

        expect(addEntry).toHaveBeenCalledWith('test', {
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: 'Aspect of the Wilds',
          description: `Chose ${aspect} aspect`,
        });

        expect(popup.html).toContain(aspect);
        expect(popup.html).toContain(popupText);
      },
    );

    it('replaces an existing Aspect of the Wilds buff instead of stacking a second one', async () => {
      capturePopup();
      mockRuntimeStore.aspectOfTheWildsUsedThisRest = false;
      mockRuntimeStore.activeBuffs = [
        { name: 'Aspect of the Wilds', effect: 'darkvision_aspect', duration: 'infinite', optionName: 'Owl' },
        { name: 'Unrelated Buff', effect: 'other', duration: 'infinite' },
      ];

      const playerStats = createPlayerStats({ specialActions: [aspectOfTheWildsAction] });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText('Aspect of the Wilds:'));
      await waitFor(() => {
        expect(screen.getByText('Choose an animal aspect:')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Panther'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', [
          { name: 'Aspect of the Wilds', effect: 'climb_speed_aspect', duration: 'infinite', optionName: 'Panther' },
          { name: 'Unrelated Buff', effect: 'other', duration: 'infinite' },
        ], 'test');
      });
    });

    it('cancelling closes the aspect modal without writing any runtime state or logging', async () => {
      const popup = capturePopup();
      mockRuntimeStore.aspectOfTheWildsUsedThisRest = false;

      const playerStats = createPlayerStats({ specialActions: [aspectOfTheWildsAction] });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText('Aspect of the Wilds:'));
      await waitFor(() => {
        expect(screen.getByText('Choose an animal aspect:')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Choose an animal aspect:')).not.toBeInTheDocument();
      });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(popup.html).toBeNull();
    });
  });

  describe('Bolstering Performance / Encouraging Song target modals', () => {
    it('confirming Bolstering Performance passes the chosen allies and temp HP to the handler, shows the result popup, and closes the modal', async () => {
      const popup = capturePopup();
      const playerStats = createPlayerStats();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'bolsteringPerformanceTarget',
        payload: {
          action: { name: 'Bolstering Performance' },
          playerStats,
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }],
          maxTargets: 6,
          tempHp: 5,
        },
      });

      render(
        <CharSpecialActions
          playerStats={createPlayerStats({
            specialActions: [
              { name: 'Bolstering Performance', description: 'Inspire allies.', automation: { type: 'temp_hp_buff' } },
            ],
          })}
          campaignName="test"
        />
      );

      fireEvent.click(screen.getByText('Bolstering Performance:'));
      await waitFor(() => {
        expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Inspire'));

      await waitFor(() => {
        expect(confirmBolsteringPerformance).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Bolstering Performance' }),
          playerStats,
          'test',
          ['Ally1'],
          5
        );
      });

      expect(popup.html).toContain('Bolstering Performance');
      expect(popup.html).toContain('Allies inspired.');
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });

    it('skipping Encouraging Song invokes skipEncouragingSong (not confirm), shows the result popup, and closes the modal', async () => {
      const popup = capturePopup();
      const playerStats = createPlayerStats();

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'encouragingSongTarget',
        payload: {
          action: { name: 'Encouraging Song' },
          playerStats,
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }],
          maxTargets: 2,
        },
      });

      render(
        <CharSpecialActions
          playerStats={createPlayerStats({
            specialActions: [
              { name: 'Encouraging Song', description: 'Sing to allies.', automation: { type: 'heroic_inspiration_buff' } },
            ],
          })}
          campaignName="test"
        />
      );

      fireEvent.click(screen.getByText('Encouraging Song:'));
      await waitFor(() => {
        expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));

      await waitFor(() => {
        expect(skipEncouragingSong).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Encouraging Song' }),
          playerStats,
          'test'
        );
      });
      expect(confirmBolsteringPerformance).not.toHaveBeenCalled();

      expect(popup.html).toContain('Encouraging Song');
      expect(popup.html).toContain('Skipped.');
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });
  });
});
