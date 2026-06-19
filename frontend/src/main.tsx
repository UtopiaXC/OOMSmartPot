import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app/App';

// Sensors, camera and pump all hit the live OOMSmartPot API — nothing is mocked
// in the browser anymore (MSW is used only in tests, via mocks/server.ts).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
