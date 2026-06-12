import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NPCListItem from './NPCListItem.jsx';

vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
  npcHasStatBlock: vi.fn(),
}));

vi.mock('../../services/npcs/npcFormUtils.js', () => ({
  getAttitudeStyle: vi.fn((attitude) => {
    const colors = {
      'deep bonds': { backgroundColor: '#1a472a', color: '#90ee90', borderColor: '#2d6a4f' },
      positive: { backgroundColor: '#1b4332', color: '#b7e4c7', borderColor: '#40916c' },
      neutral: { backgroundColor: '#4a4a4a', color: '#e0e0e0', borderColor: '#6b6b6b' },
      negative: { backgroundColor: '#7b241c', color: '#f4a0a0', borderColor: '#a43330' },
      'extreme opposition': { backgroundColor: '#5c030e', color: '#ff6b6b', borderColor: '#8b0000' },
    };
    return colors[attitude] || colors.neutral;
  }),
}));

vi.mock('../common/AvatarImage.jsx', () => ({
  default: ({ name, imagePath, size }) => (
    <img
      data-testid="avatar-image"
      alt={`${name} avatar`}
      data-size={size}
      data-image={imagePath}
    />
  ),
}));

import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';

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
  };

  const renderListItem = (npcProps = {}) => {
    const npc = { ...baseNPC, ...npcProps };
    return render(
      <NPCListItem
        npc={npc}
        onEdit={mockOnEdit}
        onAddToInitiative={mockOnAddToInitiative}
      />
    );
  };

  const getListItemElement = () => document.querySelector('li[role="button"]');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic Rendering ───────────────────────────────────────────────

  it('should render NPC name', () => {
    renderListItem();
    expect(screen.getByText('Gandalf')).toBeInTheDocument();
  });

  it('should render as a list item with correct class', () => {
    renderListItem();
    const listItem = getListItemElement();
    expect(listItem.tagName).toBe('LI');
    expect(listItem.className).toContain('ct-list-item');
  });

  it('should have role="button" and tabIndex={0}', () => {
    renderListItem();
    const listItem = getListItemElement();
    expect(listItem.getAttribute('role')).toBe('button');
    expect(listItem.getAttribute('tabindex')).toBe('0');
  });

  it('should have correct aria-label', () => {
    renderListItem();
    const listItem = getListItemElement();
    expect(listItem.getAttribute('aria-label')).toBe('Edit NPC: Gandalf');
  });

  it('should render ct-list-item-header div', () => {
    renderListItem();
    expect(document.querySelector('.ct-list-item-header')).toBeInTheDocument();
    expect(document.querySelector('.ct-list-item-header')).toHaveClass('npcs-list-header');
  });

  it('should render ct-list-details div', () => {
    renderListItem();
    expect(document.querySelector('.ct-list-details')).toBeInTheDocument();
  });

  // ── Name Row ──────────────────────────────────────────────────────

  it('should render ct-list-name span with NPC name', () => {
    renderListItem();
    expect(document.querySelector('.ct-list-name')).toHaveTextContent('Gandalf');
  });

  it('should render with different NPC name', () => {
    renderListItem({ name: 'Legolas' });
    expect(screen.getByText('Legolas')).toBeInTheDocument();
    expect(document.querySelector('.ct-list-name')).toHaveTextContent('Legolas');
  });

  // ── Avatar Image ──────────────────────────────────────────────────

  it('should not render AvatarImage when no imagePath', () => {
    renderListItem();
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
  });

  it('should render AvatarImage when imagePath provided', () => {
    renderListItem({ imagePath: '/images/gandalf.png' });
    const avatar = screen.getByTestId('avatar-image');
    expect(avatar).toBeInTheDocument();
    expect(avatar.getAttribute('data-size')).toBe('36');
    expect(avatar.getAttribute('data-image')).toBe('/images/gandalf.png');
  });

  it('should pass NPC name to AvatarImage', () => {
    renderListItem({ name: 'Aragorn', imagePath: '/images/aragorn.png' });
    const avatar = screen.getByTestId('avatar-image');
    expect(avatar.getAttribute('alt')).toBe('Aragorn avatar');
  });

  // ── Stat Block Badge ──────────────────────────────────────────────

  it('should not render stat block badge when npc has no stat block', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(false);
    renderListItem();
    expect(document.querySelector('.npcs-stat-badge')).not.toBeInTheDocument();
  });

  it('should render stat block badge when npc has stat block', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const badge = document.querySelector('.npcs-stat-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'Has stat block');
  });

  it('should render shield icon in stat block badge', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const shield = document.querySelector('.npcs-stat-badge i.fa-shield');
    expect(shield).toBeInTheDocument();
  });

  // ── Attitude Badge ────────────────────────────────────────────────

  it('should not render attitude badge when attitude is empty', () => {
    renderListItem({ attitude: '' });
    expect(document.querySelector('.ct-list-attitude')).not.toBeInTheDocument();
  });

  it('should not render attitude badge when attitude is undefined', () => {
    const npc = { ...baseNPC };
    delete npc.attitude;
    render(
      <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    expect(document.querySelector('.ct-list-attitude')).not.toBeInTheDocument();
  });

  it('should render attitude badge when attitude is set', () => {
    renderListItem({ attitude: 'positive' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('positive');
  });

  it('should render attitude badge with correct title', () => {
    renderListItem({ attitude: 'deep bonds' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge).toHaveAttribute('title', 'deep bonds');
  });

  it('should apply attitude styles from getAttitudeStyle', () => {
    renderListItem({ attitude: 'positive' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge.style.backgroundColor).toBe('rgb(27, 67, 50)');
    expect(badge.style.color).toBe('rgb(183, 228, 199)');
    expect(badge.style.borderColor).toBe('rgb(64, 145, 108)');
  });

  it('should render neutral attitude with correct styles', () => {
    renderListItem({ attitude: 'neutral' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge.style.backgroundColor).toBe('rgb(74, 74, 74)');
    expect(badge.style.color).toBe('rgb(224, 224, 224)');
    expect(badge.style.borderColor).toBe('rgb(107, 107, 107)');
  });

  it('should render negative attitude with correct styles', () => {
    renderListItem({ attitude: 'negative' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge.style.backgroundColor).toBe('rgb(123, 36, 28)');
    expect(badge.style.color).toBe('rgb(244, 160, 160)');
    expect(badge.style.borderColor).toBe('rgb(164, 51, 48)');
  });

  it('should render extreme opposition attitude with correct styles', () => {
    renderListItem({ attitude: 'extreme opposition' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge.style.backgroundColor).toBe('rgb(92, 3, 14)');
    expect(badge.style.color).toBe('rgb(255, 107, 107)');
    expect(badge.style.borderColor).toBe('rgb(139, 0, 0)');
  });

  it('should render deep bonds attitude with correct styles', () => {
    renderListItem({ attitude: 'deep bonds' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge.style.backgroundColor).toBe('rgb(26, 71, 42)');
    expect(badge.style.color).toBe('rgb(144, 238, 144)');
    expect(badge.style.borderColor).toBe('rgb(45, 106, 79)');
  });

  it('should default to neutral styles for unknown attitude', () => {
    renderListItem({ attitude: 'unknown attitude' });
    const badge = document.querySelector('.ct-list-attitude');
    expect(badge.style.backgroundColor).toBe('rgb(74, 74, 74)');
  });

  // ── Subtitle (Race / ClassRole) ──────────────────────────────────

  it('should not render subtitle when race and classRole are empty', () => {
    renderListItem({ race: '', classRole: '' });
    expect(document.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
  });

  it('should not render subtitle when race and classRole are undefined', () => {
    const npc = { ...baseNPC };
    delete npc.race;
    delete npc.classRole;
    render(
      <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    expect(document.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
  });

  it('should render race only', () => {
    renderListItem({ race: 'Human', classRole: '' });
    const subtitle = document.querySelector('.npcs-list-subtitle');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent('Human');
  });

  it('should render classRole only', () => {
    renderListItem({ race: '', classRole: 'Wizard' });
    const subtitle = document.querySelector('.npcs-list-subtitle');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent('Wizard');
  });

  it('should render race and classRole together', () => {
    renderListItem({ race: 'Elf', classRole: 'Archer' });
    const subtitle = document.querySelector('.npcs-list-subtitle');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent('Elf');
    expect(subtitle).toHaveTextContent('Archer');
  });

  it('should render separator between race and classRole', () => {
    renderListItem({ race: 'Dwarf', classRole: 'Fighter' });
    const separator = document.querySelector('.npcs-list-separator');
    expect(separator).toBeInTheDocument();
  });

  // ── Tags ──────────────────────────────────────────────────────────

  it('should not render tags when tags is empty', () => {
    renderListItem({ tags: '' });
    expect(document.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
  });

  it('should not render tags when tags is undefined', () => {
    const npc = { ...baseNPC };
    delete npc.tags;
    render(
      <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    expect(document.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
  });

  it('should render tags with icon when tags provided', () => {
    renderListItem({ tags: 'ally, quest-giver' });
    const tagsEl = document.querySelector('.npcs-list-tags');
    expect(tagsEl).toBeInTheDocument();
    expect(tagsEl).toHaveTextContent('ally, quest-giver');
  });

  it('should render tags icon', () => {
    renderListItem({ tags: 'villain' });
    const tagsIcon = document.querySelector('.npcs-list-tags i.fa-tags');
    expect(tagsIcon).toBeInTheDocument();
  });

  // ── Add to Initiative Button ──────────────────────────────────────

  it('should not render Add to Initiative button when npc has no stat block', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(false);
    renderListItem();
    expect(document.querySelector('.npcs-init-btn')).not.toBeInTheDocument();
  });

  it('should render Add to Initiative button when npc has stat block', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const btn = document.querySelector('.npcs-init-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Add to Initiative');
  });

  it('should render shield-alt icon in Add to Initiative button', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const icon = document.querySelector('.npcs-init-btn i.fa-shield-alt');
    expect(icon).toBeInTheDocument();
  });

  it('should have correct title on Add to Initiative button', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const btn = document.querySelector('.npcs-init-btn');
    expect(btn).toHaveAttribute('title', 'Add to Initiative');
  });

  it('should call onAddToInitiative when Add to Initiative button clicked', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const btn = document.querySelector('.npcs-init-btn');
    fireEvent.click(btn);
    expect(mockOnAddToInitiative).toHaveBeenCalledWith({ ...baseNPC, armorClass: 15 });
  });

  it('should stop event propagation when Add to Initiative button clicked', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ armorClass: 15 });
    const btn = document.querySelector('.npcs-init-btn');
    const stopPropagationSpy = vi.fn();
    fireEvent.click(btn, { stopPropagation: stopPropagationSpy });
    expect(mockOnEdit).not.toHaveBeenCalled();
  });

  // ── Edit Callback ─────────────────────────────────────────────────

  it('should call onEdit when list item clicked', () => {
    renderListItem();
    const listItem = getListItemElement();
    fireEvent.click(listItem);
    expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
  });

  it('should call onEdit with the npc object', () => {
    const npc = { ...baseNPC, name: 'Legolas', race: 'Elf' };
    render(
      <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    const listItem = getListItemElement();
    fireEvent.click(listItem);
    expect(mockOnEdit).toHaveBeenCalledWith(npc);
  });

  // ── Keyboard Accessibility ────────────────────────────────────────

  it('should call onEdit on Enter key press', () => {
    renderListItem();
    const listItem = getListItemElement();
    fireEvent.keyDown(listItem, { key: 'Enter' });
    expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
  });

  it('should call onEdit on Space key press', () => {
    renderListItem();
    const listItem = getListItemElement();
    fireEvent.keyDown(listItem, { key: ' ' });
    expect(mockOnEdit).toHaveBeenCalledWith(baseNPC);
  });

  it('should not call onEdit on other key press', () => {
    renderListItem();
    const listItem = getListItemElement();
    fireEvent.keyDown(listItem, { key: 'Escape' });
    expect(mockOnEdit).not.toHaveBeenCalled();
  });

  it('should not call onEdit on other key press (arrow keys)', () => {
    renderListItem();
    const listItem = getListItemElement();
    fireEvent.keyDown(listItem, { key: 'ArrowRight' });
    expect(mockOnEdit).not.toHaveBeenCalled();
  });

  // ── Combined Features ─────────────────────────────────────────────

  it('should render full NPC with all fields populated', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    const fullNPC = {
      name: 'Gandalf',
      race: 'Human',
      classRole: 'Wizard',
      attitude: 'positive',
      tags: 'ally, quest-giver',
      imagePath: '/images/gandalf.png',
      armorClass: 15,
    };
    render(
      <NPCListItem npc={fullNPC} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    expect(screen.getByText('Gandalf')).toBeInTheDocument();
    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(document.querySelector('.npcs-list-subtitle')).toHaveTextContent('Human');
    expect(document.querySelector('.npcs-list-subtitle')).toHaveTextContent('Wizard');
    expect(document.querySelector('.npcs-list-tags')).toHaveTextContent('ally, quest-giver');
    expect(screen.getByText('Add to Initiative')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
  });

  it('should render NPC with stat block but no other optional fields', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    const minimalStatBlockNPC = {
      name: 'Goblin',
      armorClass: 12,
    };
    render(
      <NPCListItem npc={minimalStatBlockNPC} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(document.querySelector('.npcs-stat-badge')).toBeInTheDocument();
    expect(document.querySelector('.npcs-init-btn')).toBeInTheDocument();
    expect(document.querySelector('.npcs-list-subtitle')).not.toBeInTheDocument();
    expect(document.querySelector('.npcs-list-tags')).not.toBeInTheDocument();
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument();
  });

  it('should render NPC with attitude but no stat block', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(false);
    const npc = { ...baseNPC, attitude: 'negative', tags: 'enemy' };
    render(
      <NPCListItem npc={npc} onEdit={mockOnEdit} onAddToInitiative={mockOnAddToInitiative} />
    );
    expect(document.querySelector('.ct-list-attitude')).toBeInTheDocument();
    expect(document.querySelector('.npcs-stat-badge')).not.toBeInTheDocument();
    expect(document.querySelector('.npcs-init-btn')).not.toBeInTheDocument();
  });

  // ── Structure ─────────────────────────────────────────────────────

  it('should have npcs-list-actions-row div', () => {
    renderListItem();
    expect(document.querySelector('.npcs-list-actions-row')).toBeInTheDocument();
  });

  it('should have ct-list-meta div', () => {
    renderListItem();
    expect(document.querySelector('.ct-list-meta')).toBeInTheDocument();
  });

  it('should have npcs-list-name-row div', () => {
    renderListItem();
    expect(document.querySelector('.npcs-list-name-row')).toBeInTheDocument();
  });

  it('should render stat badge and attitude in ct-list-meta', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ attitude: 'positive' });
    const meta = document.querySelector('.ct-list-meta');
    expect(meta.querySelector('.npcs-stat-badge')).toBeInTheDocument();
    expect(meta.querySelector('.ct-list-attitude')).toBeInTheDocument();
  });

  it('should render tags and initiative button in npcs-list-actions-row', () => {
    vi.mocked(npcHasStatBlock).mockReturnValue(true);
    renderListItem({ tags: 'boss', armorClass: 20 });
    const actionsRow = document.querySelector('.npcs-list-actions-row');
    expect(actionsRow.querySelector('.npcs-list-tags')).toBeInTheDocument();
    expect(actionsRow.querySelector('.npcs-init-btn')).toBeInTheDocument();
  });
});
