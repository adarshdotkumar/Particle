import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ParticleField } from '../../../src/react.jsx';

/* Exercises the React binding the way a real app would, including the two
 * things that actually go wrong: repeated mount/unmount across route changes,
 * and config updates that must not rebuild the simulation.
 *
 * Wrapped in StrictMode on purpose — it double-invokes effects in development,
 * which is the fastest way to catch a missing cleanup. */

function App() {
  const [shown, setShown] = useState(true);
  const [mountCount, setMountCount] = useState(0);
  const [colA, setColA] = useState('#9d8cff');
  const [count, setCount] = useState(128);

  // A brand-new object literal every render: the binding must not treat that
  // as a change, or it would push config on every keystroke.
  const config = { shapeMode: 'text', shapeText: 'REACT', colA, count, size: 0.02 };

  return (
    <div className="wrap">
      <h1>React binding</h1>

      <div>
        <button id="toggle" onClick={() => { setShown((s) => !s); setMountCount((c) => c + 1); }}>
          {shown ? 'Unmount' : 'Mount'}
        </button>
        <button id="recolour" onClick={() => setColA('#ff5c8a')}>Recolour</button>
        <button id="recount" onClick={() => setCount(256)}>Change count</button>
        <span id="cycles">{mountCount}</span>
      </div>

      {shown && (
        <ParticleField className="hero" config={config}>
          <div className="overlay"><strong>host content on top</strong></div>
        </ParticleField>
      )}

      <div className="spacer" />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
