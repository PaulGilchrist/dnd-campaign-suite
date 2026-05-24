
function ShortRestButton({ onClick }) {
    return (
        <button className="char-btn" onClick={onClick} title="Short Rest: spend Hit Dice and restore short-rest resources">
            <i className="fa-solid fa-bed"></i> Short Rest
        </button>
    );
}

export default ShortRestButton
