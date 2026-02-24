import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const hasKey = publishableKey && String(publishableKey).trim().length > 0;
if (!hasKey && import.meta.env.MODE !== 'test') {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY; auth will not work.');
}

function Root() {
  if (!hasKey) {
    return (
      <div style={{
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 420,
        margin: '40px auto',
        lineHeight: 1.5,
      }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Lesson Scheduler</h1>
        <p style={{ color: '#666', margin: 0 }}>
          <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> is not set. Add it in your deployment environment (e.g. Vercel → Project → Settings → Environment Variables), then redeploy.
        </p>
      </div>
    );
  }
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/sign-in">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
