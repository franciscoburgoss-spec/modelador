import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { createTauriProjectRuntime } from './adapters/tauriProjectRuntime.js';
import './index.css';

const projectRuntime = createTauriProjectRuntime();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App projectRuntime={projectRuntime} />
  </StrictMode>
);

requestAnimationFrame(() => {
  if (!document.querySelector('[data-modelador-ready="true"]')) return;
  const completeBoot = globalThis.__MODELADOR_COMPLETE_BOOT__;
  if (typeof completeBoot === 'function') completeBoot();
});
