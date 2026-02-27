import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { theme } from './styles/theme';
import './index.css';

// Single source of truth: expose theme tokens as CSS variables so global CSS and components can use them.
const root = document.documentElement;
root.style.setProperty('--focus-ring', theme.focusRing);
root.style.setProperty('--focus-ring-offset', `${theme.focusRingOffset}px`);
root.style.setProperty('--primary-hover', theme.primaryHover);
root.style.setProperty('--secondary-hover', theme.secondaryHover);

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const hasKey = publishableKey && String(publishableKey).trim().length > 0;
const isTestEnv = import.meta.env.MODE === 'test';

if (!hasKey && !isTestEnv) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY; auth will not work.');
}

function Root() {
  if (!hasKey && !isTestEnv) {
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

  const clerkPublishableKey = hasKey ? publishableKey : '';

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/sign-in">
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
