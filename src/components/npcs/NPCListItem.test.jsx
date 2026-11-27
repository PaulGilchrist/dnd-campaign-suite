// @maintained-by-ai 2026-11-26
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

// Row contract only. Lanes covered elsewhere and NOT re-pinned here:
// - npcHasStatBlock/npcHasAttacks guard matrix → src/services/encounters/npcStatBlockUtils.test.js
// - campaign-scoped avatar src prefixing → common/AvatarImage.test.jsx + avatarSrc.test.js
// - Print Card button (ungated, swallows row click) → NPCListItem.print.test.jsx
describe('NPCListItem', () => {
  const mockOnEdit = vi.fn();
  const mockOnAddToInitiative = vi.fn();

  const baseNPC = {
    name: 'Gandalf',
    race: '',
    classRole: '',
    attitude: '',
    tags: '',
    armorClass: undefined,
    hitPoints: null,
    actions: [],
  };

  const combatReady = {
    armorClass: 15,
    hitPoints: '30',
    actions: [{ name: 'Mace', attack_bonus: '+4' }],
  };

  const renderListItem = (npcProps = {}, extraProps = {}) => {
    const npc = { ...baseNPC, ...npcProps };
    return {
      npc,
      ...render(
        <NPCListItem
          npc={npc}
          onEdit={mockOnEdit}
          onAddToInitiative={mockOnAddToInitiative}
          campaignName="test-campaign"
          {...extraProps}
        />
      ),
    };
  };

  const listItemFor = (name = 'Gandalf') =>
    screen.getByRole('button', { name: `Edit NPC: ${name}` });

  const enabledChip = (name = 'Gandalf') =>
    screen.getByRole('button', { name: `Add ${name} to Initiative` });

  const gatedChip = (name = 'Gandalf') =>
    screen.getByRole('button', {
      name: `Fill in ${name}'s AC and HP (Stats tab) before adding to Initiative`,
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a focusable row button labelled for editing that shows the NPC name', () => {
    renderListItem({ name: 'Aragorn' });
    const button = listItemFor('Aragorn');
    expect(button).toHaveAttribute('aria-label', 'Edit NPC: Aragorn');
    expect(button).toHaveAttribute('tabIndex', '0');
    expect(button).toHaveTextContent('Aragorn');
  });

  it('renders an avatar image only when imagePath is set (no initials disc otherwise)', () => {
    const { container: withImage, unmount } = renderListItem({
      name: 'Aragorn',
      imagePath: 'images/aragorn.png',
    });
    const img = withImage.querySelector('.avatar-wrapper img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Aragorn');
    unmount();

    // NPCListItem hides the avatar entirely for imageless rows — stronger than
    // AvatarImage's own initials-disc fallback, so it is the row's contract.
    const { container: withoutImage } = renderListItem();
    expect(withoutImage.querySelector('.avatar-wrapper')).not.toBeInTheDocument();
  });

  it('gates a combat-less row: disabled chip naming the cause beside it, no stat badge', () => {
    const { container } = renderListItem();
    const chip = gatedChip();
    expect(chip).toBeDisabled();
    expect(chip.getAttribute('title')).toBe(chip.getAttribute('aria-label'));
    expect(screen.queryByTitle('Has stat block')).not.toBeInTheDocument();
    expect(screen.queryByText('No attacks')).not.toBeInTheDocument();
    const cause = container.querySelector('.npcs-init-cause');
    expect(cause).not.toBeNull();
    expect(cause).toHaveTextContent('Fill in AC and HP (Stats tab) first');
  });

  it('unlocks a combat-ready row: stat badge, single enabled chip, no cause text', () => {
    const { container } = renderListItem(combatReady);
    expect(screen.getByTitle('Has stat block')).toBeInTheDocument();
    const chip = enabledChip();
    expect(chip).toBeEnabled();
    expect(chip.getAttribute('title')).toBe(chip.getAttribute('aria-label'));
    expect(screen.getAllByRole('button', { name: 'Add Gandalf to Initiative' })).toHaveLength(1);
    expect(screen.queryByText('No attacks')).not.toBeInTheDocument();
    expect(container.querySelector('.npcs-init-cause')).toBeNull();
  });

  it('warns with a no-attacks badge when stats are ready but no usable attack exists', () => {
    renderListItem({ ...combatReady, actions: [] });
    expect(screen.getByTitle(/Unarmed Strike/)).toHaveTextContent('No attacks');
  });

  it('calls onAddToInitiative with the npc without triggering onEdit', () => {
    const { npc } = renderListItem(combatReady);
    fireEvent.click(enabledChip());
    expect(mockOnAddToInitiative).toHaveBeenCalledWith(npc);
    expect(mockOnEdit).not.toHaveBeenCalled();
  });

  it('badges AI-draft rows and leaves approved rows clean', () => {
    const { container: drafted, unmount } = renderListItem({ draft: true });
    expect(drafted.querySelector('.ct-draft-flag')).toHaveTextContent('draft');
    unmount();
    const { container: live } = renderListItem();
    expect(live.querySelector('.ct-draft-flag')).toBeNull();
  });

  it('omits attitude, subtitle, and tags when their fields are empty', () => {
    const { container } = renderListItem();
    expect(container.querySelector('.ct-list-attitude')).not.toBeInTheDocument();
    expect(container.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
    expect(container.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
  });

  it('renders the attitude badge, race/classRole subtitle, and tags when set', () => {
    const { container } = renderListItem({
      attitude: 'positive',
      race: 'Elf',
      classRole: 'Archer',
      tags: 'ally, quest-giver',
    });
    const badge = container.querySelector('.ct-list-attitude');
    expect(badge).toHaveTextContent('positive');
    expect(badge).toHaveAttribute('title', 'positive');
    const subtitle = container.querySelector('.npcs-list-subtitle');
    expect(subtitle).toHaveTextContent('Elf');
    expect(subtitle).toHaveTextContent('Archer');
    expect(subtitle.querySelector('.npcs-list-separator')).toBeInTheDocument();
    const tagsEl = container.querySelector('.npcs-list-tags');
    expect(tagsEl).toHaveTextContent('ally, quest-giver');
    expect(tagsEl.querySelector('i.fa-tags')).toBeInTheDocument();
  });

  it.each([
    [{ race: 'Human', classRole: '' }, 'Human'],
    [{ race: '', classRole: 'Wizard' }, 'Wizard'],
  ])('omits the subtitle separator when only one of race/classRole is set', (partial, expected) => {
    const { container } = renderListItem(partial);
    const subtitle = container.querySelector('.npcs-list-subtitle');
    expect(subtitle).toHaveTextContent(expected);
    expect(subtitle.querySelector('.npcs-list-separator')).not.toBeInTheDocument();
  });

  it('calls onEdit when the row is clicked', () => {
    const { npc } = renderListItem();
    fireEvent.click(listItemFor());
    expect(mockOnEdit).toHaveBeenCalledWith(npc);
  });

  it.each(['Enter', ' '])('calls onEdit on %s key press', (key) => {
    const { npc } = renderListItem();
    fireEvent.keyDown(listItemFor(), { key });
    expect(mockOnEdit).toHaveBeenCalledWith(npc);
  });

  it('does not call onEdit for other keys', () => {
    renderListItem();
    fireEvent.keyDown(listItemFor(), { key: 'Escape' });
    expect(mockOnEdit).not.toHaveBeenCalled();
  });
});
