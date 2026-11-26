
import { Fragment, useState } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasTokenStatusIndicators } from '../../services/combat/conditions/tokenStatus.js';
import {
    TOKEN_COSMETICS_KEY,
    getTokenRingClass,
    normalizeTokenCosmetics,
} from '../../config/tokenCosmetics.js';

// Item 5 token face on the HEX surface: the hex board carries ONE shared
// party marker ("P"), not per-character tokens — the marching-order avatar
// row is therefore a character's token face on this map family. It honours
// all three cosmetics read-only from the SAME canonical home as the indoor
// board (the character runtime bucket, config/tokenCosmetics.js): the
// personal ring color (CSS class, never inline styles), label visibility,
// and the uniform dashed condition ring driven by the one shared predicate
// (hasTokenStatusIndicators — chips detail stays the indoor lane; here the
// uniform treatment is all the surface has). Render-only: zero writes here;
// the editing UI is the indoor token context menu (PlayerContextMenu), on
// both origins under the same ownership law.
function MarchingOrderIdentity({ name, char, campaignName }) {
    const cosmetics = normalizeTokenCosmetics(
        useRuntimeValue(name, TOKEN_COSMETICS_KEY, campaignName),
    );
    const activeConditions = useRuntimeValue(name, 'activeConditions', campaignName);
    const targetEffects = useRuntimeValue('campaign', 'targetEffects', campaignName);
    const ringClass = getTokenRingClass(cosmetics.ringColor);
    const statusClass = hasTokenStatusIndicators(name, activeConditions, targetEffects)
        ? ' token-condition-ring'
        : '';
    return (
        <>
            <div className={`marching-order-avatar${ringClass ? ` ${ringClass}` : ''}${statusClass}`}>
                {char?.imagePath ? (
                    <img src={char.imagePath.startsWith('http') ? char.imagePath : (campaignName ? `campaigns/${campaignName}/${char.imagePath}` : char.imagePath)} alt={name} className="marching-order-img" />
                ) : (
                    <span className="marching-order-initial">{name.charAt(0).toUpperCase()}</span>
                )}
            </div>
            {!cosmetics.hideLabel && <span className="marching-order-name">{name}</span>}
        </>
    );
}

function MarchingOrderPanel({ marchingOrder, setMarchingOrder, characters, onClose, campaignName }) {
    // Which row (0-based) currently shows its inline "insert before" picker (null = closed).
    const [insertAt, setInsertAt] = useState(null);

    const moveUp = (index) => {
        if (index === 0) return;
        setInsertAt(null);
        const next = [...marchingOrder];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        setMarchingOrder(next);
    };

    const moveDown = (index) => {
        if (index === marchingOrder.length - 1) return;
        setInsertAt(null);
        const next = [...marchingOrder];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        setMarchingOrder(next);
    };

    const removeFromOrder = (name) => {
        setInsertAt(null);
        setMarchingOrder(prev => prev.filter(n => n !== name));
    };

    const addToOrder = (name) => {
        if (marchingOrder.includes(name)) return;
        setMarchingOrder(prev => [...prev, name]);
    };

    // Splice name in so it becomes the (index+1)-th entry; everything at
    // index..N shifts one back. Ranks re-render contiguous from the prop.
    const insertAtSlot = (index, name) => {
        if (marchingOrder.includes(name)) return;
        const next = [...marchingOrder];
        next.splice(index, 0, name);
        setMarchingOrder(next);
        setInsertAt(null);
    };

    const notInOrder = characters.filter(c => !marchingOrder.includes(c.name));

    const insertPicker = (
        <div className="marching-order-insert-list">
            {notInOrder.map(char => (
                <button
                    key={char.name}
                    className="marching-order-insert-btn"
                    onClick={() => insertAtSlot(insertAt, char.name)}
                >
                    + {char.name}
                </button>
            ))}
        </div>
    );

    return (
        <div className="marching-order-panel">
            <div className="marching-order-header">
                <span className="marching-order-title">Marching Order</span>
                <button className="marching-order-close" onClick={onClose} aria-label="Close marching order">
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>

            <div className="marching-order-list">
                {marchingOrder.length === 0 && (
                    <div className="marching-order-empty">No characters assigned to march order.</div>
                )}
                {marchingOrder.map((name, i) => {
                    const char = characters.find(c => c.name === name);
                    return (
                        <Fragment key={name}>
                            {insertAt === i && notInOrder.length > 0 && insertPicker}
                            <div className={`marching-order-row ${i === 0 ? 'marching-order-leader' : ''}`}>
                                <span className="marching-order-rank">{i + 1}</span>
                                <MarchingOrderIdentity
                                    name={name}
                                    char={char}
                                    campaignName={campaignName}
                                />
                                <div className="marching-order-controls">
                                    {notInOrder.length > 0 && (
                                        <button
                                            onClick={() => setInsertAt(insertAt === i ? null : i)}
                                            title="Insert before"
                                            className={insertAt === i ? 'marching-order-insert-active' : undefined}
                                        >
                                            <i className="fa-solid fa-arrow-down-to-line"></i>
                                        </button>
                                    )}
                                    <button onClick={() => moveUp(i)} disabled={i === 0} title="Move up">
                                        <i className="fa-solid fa-chevron-up"></i>
                                    </button>
                                    <button onClick={() => moveDown(i)} disabled={i === marchingOrder.length - 1} title="Move down">
                                        <i className="fa-solid fa-chevron-down"></i>
                                    </button>
                                    <button onClick={() => removeFromOrder(name)} title="Remove from order" className="marching-order-remove">
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                        </Fragment>
                    );
                })}
            </div>

            {notInOrder.length > 0 && (
                <div className="marching-order-add-section">
                    <div className="marching-order-add-label">Add character:</div>
                    {notInOrder.map(char => (
                        <button
                            key={char.name}
                            className="marching-order-add-btn"
                            onClick={() => addToOrder(char.name)}
                        >
                            + {char.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MarchingOrderPanel;
