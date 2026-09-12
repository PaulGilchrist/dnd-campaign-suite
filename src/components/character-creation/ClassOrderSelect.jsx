function ClassOrderSelect({ config, value, error, onChange }) {
  return (
    <div className="form-group">
      <label>{config.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'error' : ''}
      >
        <option value="">{config.placeholder}</option>
        {config.options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
}

export default ClassOrderSelect;
