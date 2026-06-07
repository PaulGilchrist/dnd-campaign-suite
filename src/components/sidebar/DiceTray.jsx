import { useEffect } from 'react';
import { rollDie } from '../../services/dice/diceRoller.js';
import './DiceTray.css';

function D4Icon() {
    return (
          <svg viewBox="0 0 36 36" className="dice-svg">
              <polygon points="18,4 32,32 4,32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <text x="18" y="27" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="10" fontWeight="bold">4</text>
          </svg>
      );
}

function D8Icon() {
    return (
          <svg viewBox="0 0 36 36" className="dice-svg">
              <polygon points="18,2 34,18 18,34 2,18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <text x="18" y="19" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="9" fontWeight="bold">8</text>
          </svg>
      );
}

function D10Icon() {
    return (
          <svg viewBox="0 0 36 36" className="dice-svg">
              <polygon points="18,2 32,12 28,34 8,34 4,12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <text x="18" y="20" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="7.5" fontWeight="bold">10</text>
          </svg>
      );
}

function D12Icon() {
    return (
          <svg viewBox="0 0 36 36" className="dice-svg">
              <polygon points="18,2 32,9 32,27 18,34 4,27 4,9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <text x="18" y="19" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="7" fontWeight="bold">12</text>
          </svg>
      );
}

function DicePopup({ result, onClose }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
         };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
       }, [onClose]);

    const getResultIcon = (label) => {
        switch (label) {
            case 'd4': return <D4Icon />;
            case 'd8': return <D8Icon />;
            case 'd10': return <D10Icon />;
            case 'd12': return <D12Icon />;
            case 'd6': return <i className="fa-solid fa-dice-d6"></i>;
            case 'd20': return <i className="fa-solid fa-dice-d20"></i>;
            case 'd100': return (
                   <svg viewBox="0 0 48 48" className="dice-svg dice-result-svg">
                       <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2.5" />
                       <circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
                       <text x="24" y="25" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="9" fontWeight="bold">%</text>
                   </svg>
               );
            default: return null;
          }
      };

    return (
           <div className="dice-tray-popup-overlay" onClick={onClose}>
               <div className="dice-tray-popup-modal" onClick={(e) => e.stopPropagation()}>
                   <div className="dice-tray-result">
                       <div className="dice-tray-result-icon">{getResultIcon(result.label)}</div>
                       <div className="dice-tray-result-value">{result.value}</div>
                       <div className="dice-tray-result-label">{result.label}</div>
                       <div className="dice-tray-result-dismiss">click anywhere to dismiss</div>
                   </div>
               </div>
           </div>
       );
}

function DiceTray({ onRoll }) {
    const dice = [
          { label: 'd4', sides: 4 },
          { label: 'd6', sides: 6 },
          { label: 'd8', sides: 8 },
          { label: 'd10', sides: 10 },
          { label: 'd12', sides: 12 },
          { label: 'd20', sides: 20 },
          { label: 'd100', sides: 100 }
      ];

    const getIcon = (label) => {
        switch (label) {
            case 'd4': return <D4Icon />;
            case 'd8': return <D8Icon />;
            case 'd10': return <D10Icon />;
            case 'd12': return <D12Icon />;
            case 'd6': return <i className="fa-solid fa-dice-d6"></i>;
            case 'd20': return <i className="fa-solid fa-dice-d20"></i>;
            case 'd100': return (
                  <svg viewBox="0 0 36 36" className="dice-svg">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="11" fill="none" stroke="currentColor" strokeWidth="1" />
                      <text x="18" y="19" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="7" fontWeight="bold">%</text>
                  </svg>
              );
            default: return null;
         }
     };

    const handleRoll = (die) => {
        onRoll({ label: die.label, value: rollDie(die.sides) });
      };

    return (
          <div className="dice-tray">
              {dice.map((die) => (
                  <button
                     key={die.label}
                     className="dice-btn"
                     onClick={() => handleRoll(die)}
                     title={`Roll ${die.label}`}
                  >
                      {getIcon(die.label)}
                      <span className="dice-label">{die.label}</span>
                  </button>
              ))}
          </div>
      );
}

export { DicePopup, DiceTray };
export default DiceTray;
