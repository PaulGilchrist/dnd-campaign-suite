// @maintained-by-ai
/**
 * Contract tests for the ErrorBoundary view-outlet crash containment:
 *
 *  - Fallback contract: a throwing child renders the "reload the view" card
 *    (error icon + message + .error-boundary-reload-btn) instead of blanking.
 *  - Log contract: componentDidCatch console.errors the caught error.
 *  - Recovery contract: with the underlying error gone, clicking the reload
 *    button clears the fallback and renders healthy children (the child
 *    subtree never committed, so reset re-mounts it fresh).
 *  - resetKey contract: a view/map switch auto-clears a stale fallback so
 *    the next view renders instead of inheriting the card.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

let shouldThrow = false;

function ProbeView() {
  if (shouldThrow) throw new Error('QA boundary probe');
  return <div>view healthy</div>;
}

describe('ErrorBoundary', () => {
  let consoleSpy;

  beforeEach(() => {
    shouldThrow = false;
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the reload-the-view fallback when a child throws', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ProbeView />
      </ErrorBoundary>
    );
    expect(screen.getByText(/ran into an error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the view/i })).toBeInTheDocument();
    expect(document.querySelector('.error-boundary .ct-empty-state i')).toBeTruthy();
    expect(screen.queryByText('view healthy')).not.toBeInTheDocument();
  });

  it('logs the caught error via componentDidCatch', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ProbeView />
      </ErrorBoundary>
    );
    const logged = consoleSpy.mock.calls.flat();
    expect(logged.some(a => a instanceof Error && a.message === 'QA boundary probe')).toBe(true);
  });

  it('recovery button clears the fallback and renders healthy children once the error is gone', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ProbeView />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /reload the view/i }));
    // Error still present at re-mount → boundary re-fires (fallback stays).
    expect(screen.getByRole('button', { name: /reload the view/i })).toBeInTheDocument();
    // Underlying error removed, second click recovers with zero reload.
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /reload the view/i }));
    expect(screen.getByText('view healthy')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reload the view/i })).not.toBeInTheDocument();
  });

  it('resetKey change auto-clears a stale fallback for the next view', () => {
    shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary resetKey="npcs">
        <ProbeView />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /reload the view/i })).toBeInTheDocument();
    // Navigate away from the crashing view — the new view must render healthy.
    shouldThrow = false;
    rerender(
      <ErrorBoundary resetKey="notes">
        <ProbeView />
      </ErrorBoundary>
    );
    expect(screen.getByText('view healthy')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reload the view/i })).not.toBeInTheDocument();
  });
});
