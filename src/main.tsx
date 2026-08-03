import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootMsal } from './auth/msalBoot';

async function start() {
  // Processa ?code= / #code= do Entra ANTES de montar o React
  try {
    await bootMsal();
  } catch (err) {
    console.error('MSAL boot falhou:', err);
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

void start();
