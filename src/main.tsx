import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import 'katex/dist/katex.min.css';
import './styles/global.css';
import App from './App';

// claude.ai артефакт ретінде жариялау: жол мекенжайсыз (MemoryRouter), service worker жоқ
const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === '1';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {IS_ARTIFACT ? (
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    ) : (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>,
);

if (import.meta.env.PROD && !IS_ARTIFACT && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
