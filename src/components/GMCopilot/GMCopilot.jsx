import { useGmCopilot } from '../../hooks/management/useGmCopilot.js';
import { COPILOT_TIPS } from './copilotTips.js';
import './GMCopilot.css';

/**
 * One-time GM guidance card (learnability plan Phase 1). Purely additive:
 * it points, it never blocks. `when` is the mount-site trigger condition;
 * the card self-hides once its tip is settled — dismissed forever via ×, or
 * settled by taking (or natively experiencing) the guided step via onAction.
 *
 * Styling mirrors the FirstSessionChecklist card (same card/border tokens,
 * same dismiss idiom) so guidance reads as one family across the app.
 */
function GMCopilot({ campaignName, tipId, when = true, onAction, actionLabel, vars = {} }) {
  const { isSettled, dismiss, markSeen } = useGmCopilot(campaignName);
  const tip = COPILOT_TIPS[tipId];
  if (!tip || !when || isSettled(tipId)) return null;
  const flag = tip.flag || 'GM tip';
  const body = typeof tip.body === 'function' ? tip.body(vars) : tip.body;

  const handleAction = () => {
    // Copilot tips: taking the guided step IS the lesson — settle it, then act.
    // "Try next" invitations: navigating alone settles nothing — the card
    // returns until the invitation is genuinely lived (its condition turns
    // false) or the GM dismisses it with ×.
    if (tip.flag !== 'Try next') markSeen(tipId);
    if (onAction) onAction();
  };

  return (
    <div className="gm-copilot-card" role="note" aria-label={`${flag}: ${tip.title}`}>
      <div className="gm-copilot-head">
        <h4>
          <i className={`fa-solid ${tip.icon}`} aria-hidden="true"></i> {tip.title}
          <span className="gm-copilot-flag">{flag}</span>
        </h4>
        <button
          className="gm-copilot-dismiss"
          onClick={() => dismiss(tipId)}
          title="Dismiss this tip for good"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <p className="gm-copilot-body">{body}</p>
      {onAction && actionLabel && (
        <button className="gm-copilot-action" onClick={handleAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default GMCopilot;
