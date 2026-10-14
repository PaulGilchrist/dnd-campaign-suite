import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';
import { TARGET_EFFECT_DEFINITIONS } from '../../services/combat/conditions/targetEffectDefinitions.js';

describe('EffectAdder - effects browsing', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Dragon' },
      ],
    };
  });

  it('should render a search input when switching to effects tab', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    expect(screen.getByPlaceholderText('Search effects…')).toBeInTheDocument();
  });

  it('should render all effects grouped by category', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    const groups = ['Attack', 'Defensive', 'Saves & Checks', 'Spells', 'Movement'];
    groups.forEach(group => {
      expect(screen.getByText(group)).toBeInTheDocument();
    });
  });

  it('should render each effect definition as a clickable badge with icon', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    TARGET_EFFECT_DEFINITIONS.forEach(def => {
      expect(screen.getByText(def.label)).toBeInTheDocument();
    });
  });

  it('should show effect badges with tooltip from description', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    const firstEffect = TARGET_EFFECT_DEFINITIONS[0];
    const badge = screen.getByText(firstEffect.label);
    expect(badge).toHaveAttribute('title', firstEffect.description);
  });

  it.each`
    searchQuery       | shouldContain          | shouldNotContain
    ${'Goad'}         | ${'Goad'}              | ${'Escape the Horde'}
    ${'Disadvantage on attack rolls'} | ${'Attack Disadv'} | ${'No effects match'}
    ${'Movement'}     | ${'Movement'}          | ${'Attack'}
    ${'goad'}         | ${'Goad'}              | ${'No effects match'}
    ${'GOAD'}         | ${'Goad'}              | ${'No effects match'}
  `('should filter effects by label, description, group, or key (search: "$searchQuery")', ({ searchQuery, shouldContain, shouldNotContain }) => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    const searchInput = screen.getByPlaceholderText('Search effects…');
    fireEvent.change(searchInput, { target: { value: searchQuery } });
    expect(screen.getByText(shouldContain)).toBeInTheDocument();
    expect(screen.queryByText(shouldNotContain)).not.toBeInTheDocument();
  });

  it('should show empty message when search matches nothing', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    const searchInput = screen.getByPlaceholderText('Search effects…');
    fireEvent.change(searchInput, { target: { value: 'zzzznotfound' } });
    expect(screen.getByText(/No effects match/)).toBeInTheDocument();
  });

  it('should clear selection when search input changes', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    fireEvent.click(screen.getByText('Goad'));
    expect(document.querySelector('.ea-config')).toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText('Search effects…');
    fireEvent.change(searchInput, { target: { value: 'a' } });
    expect(document.querySelector('.ea-config')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search effects…')).toBeInTheDocument();
  });

  it('should auto-focus the search input', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    const searchInput = screen.getByPlaceholderText('Search effects…');
    expect(searchInput).toHaveFocus();
  });

  it('should only show groups that have matching effects when searching', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    const searchInput = screen.getByPlaceholderText('Search effects…');
    fireEvent.change(searchInput, { target: { value: 'Speed' } });
    expect(screen.getByText('Movement')).toBeInTheDocument();
    expect(screen.queryByText('Attack')).not.toBeInTheDocument();
  });

  it('should navigate to config view when an effect is clicked', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    fireEvent.click(screen.getByText('Goad'));
    expect(document.querySelector('.ea-config')).toBeInTheDocument();
    expect(screen.getByText('Goad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('should render effects without fields without errors', () => {
    render(<EffectAdder {...props} initialTab='conditions' />);
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    fireEvent.click(screen.getByText('No Opportunity Attacks'));
    expect(document.querySelector('.ea-config')).toBeInTheDocument();
    expect(screen.getByText('No Opportunity Attacks')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Custom source name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Value:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Save DC:')).not.toBeInTheDocument();
  });
});
