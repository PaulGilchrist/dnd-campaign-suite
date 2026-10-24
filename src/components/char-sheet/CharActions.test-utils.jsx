// Shared test kit for the CharActions.*.test.jsx family (rec :346, pass #265).
// Extracts the vi.mock('./modals/TacticalMasterModal.jsx') boilerplate that
// was copy-pasted identically across 11 of the 13 lanes that stub the modal.
// Naming follows the house pattern on disk (CharActionModals.test-utils.jsx);
// .jsx because the kit emits JSX (fix#320 naming lesson).
//
// Honest split (kit-serves-majority-not-all): the 11-lane majority cluster is
// byte-identical (`default: vi.fn(() => <div data-testid=...>)`). Two lanes
// (automation, recklessAttack) render null instead — a one-flag deviation of
// the same shape, expressed here as the documented `render: false` opt, so all
// 13 lanes adopt the kit with zero behavioural change.
//
// Lanes adopt via dynamic import inside their hoisted vi.mock factory
// (fix#320 pattern):
//   vi.mock('./modals/TacticalMasterModal.jsx', async () => {
//     const { createTacticalMasterModalMock } = await import('./CharActions.test-utils.jsx');
//     return createTacticalMasterModalMock();
//   });
//
// Per-lane capture via opts (fix#320 createStaticPickerModal opt-mapping):
//   const seenProps = vi.hoisted(() => ({ current: null }));
//   ... createTacticalMasterModalMock({ capture: seenProps })
//   // seenProps.current = latest props passed to the modal by CharActions.

// Produces the standard mocked-module shape for TacticalMasterModal:
// `{ default: vi.fn(...) }`. Opts map 1:1 to the DOM variants previously
// written out verbatim in the lanes.
export function createTacticalMasterModalMock(opts = {}) {
  const {
    render = true,                  // false => default renders null (no DOM)
    testId = 'tactical-master-modal', // data-testid of the placeholder div
    capture = null,                 // optional ref: capture.current = latest props
  } = opts;

  return {
    default: vi.fn((props) => {
      if (capture) capture.current = props;
      if (!render) return null;
      return <div data-testid={testId}>TacticalMasterModal</div>;
    }),
  };
}
