
const aspectOptions = [
    { name: 'Owl', description: 'You have Darkvision with a range of 60 feet. If you already have Darkvision, its range increases by 60 feet.', icon: 'eye' },
    { name: 'Panther', description: 'You have a Climb Speed equal to your Speed.', icon: 'paw' },
    { name: 'Salmon', description: 'You have a Swim Speed equal to your Speed.', icon: 'fish' },
];

function AspectOfTheWildsModal({ aspectOfTheWildsModal, handleAspectOfTheWildsConfirm, handleAspectOfTheWildsSkip }) {
    if (!aspectOfTheWildsModal) return null;
    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-paw"></i> Aspect of the Wilds
                </div>
                <div className="sp-body">
                    <p>Choose an animal aspect:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {aspectOptions.map((opt, i) => (
                            <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: 'transparent', border: '1px solid transparent' }}>
                                <input
                                    type="radio"
                                    name="aspectOption"
                                    onChange={() => handleAspectOfTheWildsConfirm(opt.name)}
                                    style={{ marginRight: '8px' }}
                                />
                                <i className={`fas fa-${opt.icon}`}></i> <strong>{opt.name}</strong> — {opt.description}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={handleAspectOfTheWildsSkip}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default AspectOfTheWildsModal;
