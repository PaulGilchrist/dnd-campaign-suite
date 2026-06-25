
const OVERLAY_CONFIG = {
  clear: null,
  cloudy: { className: 'weather-cloudy', particles: 'cloud' },
  rain: { className: 'weather-rain', particles: 'rain' },
  storm: { className: 'weather-storm', particles: 'rain' },
  fog: { className: 'weather-fog', particles: 'fog' },
  mist: { className: 'weather-mist', particles: 'fog' },
  snow: { className: 'weather-snow', particles: 'snow' },
  wind: { className: 'weather-wind', particles: 'wind' },
  extreme: { className: 'weather-extreme', particles: null },
};

function WeatherOverlay({ weather }) {
  if (!weather) return null;
  const config = OVERLAY_CONFIG[weather.condition];
  if (!config) return null;

  return (
    <div className={`weather-overlay ${config.className}`}>
      {config.particles === 'rain' && <RainEffect />}
      {config.particles === 'snow' && <SnowEffect />}
      {config.particles === 'wind' && <WindEffect />}
      {config.particles === 'fog' && <FogEffect />}
      {config.particles === 'cloud' && <CloudEffect />}
      {weather.condition === 'storm' && <LightningEffect />}
    </div>
  );
}

function RainEffect() {
  const drops = Array.from({ length: 300 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${0.5 + Math.random() * 0.4}s`,
    height: `${14 + Math.random() * 18}px`,
    opacity: 0.3 + Math.random() * 0.3,
  }));

  return (
    <div className="weather-particles" aria-hidden="true">
      {drops.map(d => (
        <div
          key={d.id}
          className="rain-drop"
          style={{
            left: d.left,
            animationDelay: d.delay,
            animationDuration: d.duration,
            height: d.height,
            opacity: d.opacity,
          }}
        />
      ))}
    </div>
  );
}

function SnowEffect() {
  const flakes = Array.from({ length: 150 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 5}s`,
    duration: `${5 + Math.random() * 4}s`,
    size: `${4 + Math.random() * 6}px`,
    opacity: 0.5 + Math.random() * 0.4,
    drift: `${-20 + Math.random() * 40}px`,
  }));

  return (
    <div className="weather-particles" aria-hidden="true">
      {flakes.map(f => (
        <div
          key={f.id}
          className="snow-flake"
          style={{
            left: f.left,
            animationDelay: f.delay,
            animationDuration: f.duration,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            '--drift': f.drift,
          }}
        />
      ))}
    </div>
  );
}

function WindEffect() {
  const lines = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 3}s`,
    duration: `${1.5 + Math.random() * 2}s`,
    width: `${80 + Math.random() * 140}px`,
    opacity: 0.2 + Math.random() * 0.3,
  }));

  return (
    <div className="weather-particles" aria-hidden="true">
      {lines.map(l => (
        <div
          key={l.id}
          className="wind-line"
          style={{
            top: l.top,
            animationDelay: l.delay,
            animationDuration: l.duration,
            width: l.width,
            opacity: l.opacity,
          }}
        />
      ))}
    </div>
  );
}

function FogEffect() {
  const patches = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    top: `${10 + Math.random() * 50}%`,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${15 + Math.random() * 15}s`,
    size: `${200 + Math.random() * 400}px`,
    opacity: 0.25 + Math.random() * 0.35,
  }));

  return (
    <div className="weather-particles" aria-hidden="true">
      {patches.map(p => (
        <div
          key={p.id}
          className="fog-patch"
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}

function CloudEffect() {
  const shadows = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    top: `${Math.random() * 60}%`,
    delay: `${Math.random() * 10}s`,
    duration: `${25 + Math.random() * 20}s`,
    size: `${300 + Math.random() * 500}px`,
    opacity: 0.08 + Math.random() * 0.1,
  }));

  return (
    <div className="weather-particles" aria-hidden="true">
      {shadows.map(s => (
        <div
          key={s.id}
          className="cloud-shadow"
          style={{
            top: s.top,
            animationDelay: s.delay,
            animationDuration: s.duration,
            width: s.size,
            height: `${s.size * 0.4}px`,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}

function LightningEffect() {
  const flashes = [
    { delay: '1.5s', duration: '8s' },
    { delay: '5s', duration: '12s' },
    { delay: '10s', duration: '15s' },
    { delay: '3.5s', duration: '10s' },
    { delay: '13s', duration: '18s' },
  ];

  return (
    <div className="lightning-flashes" aria-hidden="true">
      {flashes.map((f, i) => (
        <div
          key={i}
          className="lightning-flash"
          style={{ animationDelay: f.delay, animationDuration: f.duration }}
        />
      ))}
    </div>
  );
}

export default WeatherOverlay;
