import './NatFlourish.css';

/**
 * Full-screen critical flourish (learnability/engagement plan Phase 6).
 * The card-level floaters stay exactly as they are; this is the across-the-
 * room celebration for the two moments the whole table reacts to — a natural
 * 20 hit and a natural 1 fumble. Pure presentation: pointer-events none,
 * aria-hidden (the dice popup and log already announce it), and it removes
 * ITSELF on animation end — no timers, per the turn-based policy.
 */
export default function NatFlourish({ kind, onDone }) {
  const label = kind === 'crit' ? 'CRITICAL HIT!' : 'CRITICAL MISS!';
  return (
    <div
      className={`nat-flourish nat-flourish-${kind}`}
      onAnimationEnd={onDone}
      aria-hidden="true"
    >
      <span className="nat-flourish-text">{label}</span>
    </div>
  );
}
