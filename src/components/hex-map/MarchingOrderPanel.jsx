
function MarchingOrderPanel({ marchingOrder, setMarchingOrder, characters, onClose, campaignName }) {
    const moveUp = (index) => {
        if (index === 0) return;
        const next = [...marchingOrder];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        setMarchingOrder(next);
    };

    const moveDown = (index) => {
        if (index === marchingOrder.length - 1) return;
        const next = [...marchingOrder];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        setMarchingOrder(next);
    };

    const removeFromOrder = (name) => {
        setMarchingOrder(prev => prev.filter(n => n !== name));
    };

    const addToOrder = (name) => {
        if (marchingOrder.includes(name)) return;
        setMarchingOrder(prev => [...prev, name]);
    };

    const notInOrder = characters.filter(c => !marchingOrder.includes(c.name));

    return (
        <div className="marching-order-panel">
            <div className="marching-order-header">
                <span className="marching-order-title">Marching Order</span>
                <button className="marching-order-close" onClick={onClose}>
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
                        <div key={name} className={`marching-order-row ${i === 0 ? 'marching-order-leader' : ''}`}>
                            <span className="marching-order-rank">{i + 1}</span>
                            <div className="marching-order-avatar">
                                {char?.imagePath ? (
                                    <img src={campaignName ? `campaigns/${campaignName}/${char.imagePath}` : char.imagePath} alt={name} className="marching-order-img" />
                                ) : (
                                    <span className="marching-order-initial">{name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="marching-order-name">{name}</span>
                            <div className="marching-order-controls">
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
