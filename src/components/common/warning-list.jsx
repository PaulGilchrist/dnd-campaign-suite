/* eslint-disable react/prop-types */

function WarningList({ warnings, showIcons = false }) {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  const iconMap = { warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };

  return (
    <div className="warning-container">
      {warnings.map((warning, index) => (
        <div key={index} className={`warning-message ${warning.type}`}>
          {showIcons && iconMap[warning.type]} {warning.message}
        </div>
      ))}
    </div>
  );
}

export default WarningList;
