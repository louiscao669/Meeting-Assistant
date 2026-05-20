// main.jsx or index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import SpeechRecognition from 'react-speech-recognition';
import App from './App';

const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);
if (SpeechRecognitionAPI) {
  SpeechRecognition.applyPolyfill(SpeechRecognitionAPI);
}
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <App />
  </ThemeProvider>
);
