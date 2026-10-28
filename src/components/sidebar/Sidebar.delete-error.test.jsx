// @maintained-by-ai
// Component lane of the failed-delete inline roster error: Sidebar must render
// a dismissible role=alert line naming the character (with "still in the
// roster" semantics) when deleteErrorName is set, keep the roster link
// present/clickable, and route the aria-labelled dismiss button to the
// caller-provided handler. Nothing renders while no delete has failed.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

function renderSidebar(overrides = {}) {
  const props = {
    campaignName: 'test-campaign',
    characters: [{ name: 'AasimarTest' }],
    activeCharacter: null,
    isLocalhost: true,
    activeView: 'charSheet',
    onBackToCampaigns: vi.fn(),
    onAddCharacter: vi.fn(),
    onCharacterClick: vi.fn(),
    onDismissDeleteError: vi.fn(),
    deleteErrorName: null,
    ...overrides,
  };
  return { props, ...render(<Sidebar {...props} />) };
}

describe('Sidebar failed-delete inline roster error', () => {
  it('renders nothing when no delete has failed', () => {
    renderSidebar();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Delete failed/)).toBeNull();
  });

  it('names the character and states it is still in the roster', () => {
    renderSidebar({ deleteErrorName: 'AasimarTest' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Delete failed: AasimarTest');
    expect(alert.textContent).toMatch(/still in the roster/i);
  });

  it('keeps the undeleted roster link present and clickable', () => {
    const { props } = renderSidebar({ deleteErrorName: 'AasimarTest' });
    const link = screen.getByRole('button', { name: 'AasimarTest' });
    fireEvent.click(link);
    expect(props.onCharacterClick).toHaveBeenCalledWith({ name: 'AasimarTest' });
  });

  it('dismiss button is aria-labelled and calls the handler', () => {
    const { props } = renderSidebar({ deleteErrorName: 'QA Space Cadet' });
    const dismiss = screen.getByRole('button', {
      name: 'Dismiss delete error for "QA Space Cadet"',
    });
    fireEvent.click(dismiss);
    expect(props.onDismissDeleteError).toHaveBeenCalledTimes(1);
  });

  it('clears when the parent stops passing the error (success leg)', () => {
    const handlers = {
      onBackToCampaigns: vi.fn(),
      onAddCharacter: vi.fn(),
      onCharacterClick: vi.fn(),
      onDismissDeleteError: vi.fn(),
    };
    const sidebarProps = {
      campaignName: 'test-campaign',
      characters: [{ name: 'AasimarTest' }],
      activeCharacter: null,
      isLocalhost: true,
      activeView: 'charSheet',
      ...handlers,
    };
    const { rerender } = render(
      <Sidebar {...sidebarProps} deleteErrorName="AasimarTest" />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<Sidebar {...sidebarProps} deleteErrorName={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
