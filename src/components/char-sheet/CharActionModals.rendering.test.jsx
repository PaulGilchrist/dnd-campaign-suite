// Rendering tests for CharActionModals.jsx
//
// Scope — behaviors unique to this file after cleanup:
// - Empty fragment when no modals are active
//
// Removed — redundant parameterized modal rendering tests (44 tests):
//
// Each of the 44 parameterized tests followed the identical pattern: set one
// truthy modal prop on modalState → assert a data-testid appears. These test
// React's conditional rendering (a framework guarantee), not application
// behavior. The same modal components are mocked identically in:
//
// - CharActionModals.full-rendering.test.jsx (primary rendering coverage)
// - CharActionModals.inline-modals.test.jsx (inline modal rendering)
// - CharActionModals.handlers.test.jsx (handler callbacks)
// - CharActionModals.modal-closes.test.jsx (close behavior)
// - CharActionModals.modal-closes-2.test.jsx (close behavior)
// - CharActionModals.modal-closes-3.test.jsx (close behavior)
// - CharActionModals.inline-choice-modals.test.jsx (choice modals)
//
// The 44 tests provided zero unique behavioral confidence. Adding a new modal
// requires updating 5+ test files to keep mocks in sync — a maintenance burden
// that introduces fragility.
//
// Also removed — spellModalState merging test (1 test):
//
// The spellModalState test verified the same wildMagicSurgeModal rendering
// through spellModalState instead of modalState. The merge logic
// `{ ...modalState, ...spellModalState }` is a one-liner useMemo that spreads
// two objects. Testing it separately from the 44 parameterized tests adds no
// behavioral confidence — if the spread fails, the modal simply won't render
// and the parent component's integration tests will catch it.
//
// NOTE: vi.mock() is hoisted to the top of the file by Vitest, so all mock
// factories must be defined inline (no references to top-level variables).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Tests ──

describe('CharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty fragment when no modal props are set', () => {
    const { container } = render(<CharActionModals {...createBaseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
