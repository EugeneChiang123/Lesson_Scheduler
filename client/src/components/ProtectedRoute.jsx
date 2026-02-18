import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Renders children only when signed in; otherwise redirects to /sign-in.
 * Used to protect /setup and professional-only pages.
 */
export default function ProtectedRoute({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return children;
}
