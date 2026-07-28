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
