import { useEffect } from 'react';
import './MetamagicPopup.css';

export default function TargetPopupBase({
  icon, title, spell, school = 'Abjuration', defaultLevel = 1, spellSubtitle,
  description, children,
  confirmDisabled = true, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onSkip,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  const subtitle = spellSubtitle != null
    ? spellSubtitle
    : `\u2014 Level ${spell?.level ?? defaultLevel} ${school}`;

  return (
    <div className="popup-overlay" onClick={onSkip}>
      <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
        <div className="metamagic-popup-inner">
          <h3><i className={icon}></i> {title}</h3>
          <p className="metamagic-spell-name">
            <strong>{spell?.name || 'Spell'}</strong> {subtitle}
          </p>
          {description != null && <p>{description}</p>}
          {children}
          <div className="metamagic-actions">
            <button className="btn btn-secondary" onClick={onSkip}>
              {cancelLabel}
            </button>
            <button className="btn" onClick={onConfirm} disabled={confirmDisabled}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
