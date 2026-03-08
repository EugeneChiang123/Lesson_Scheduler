import { SignIn } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';

export default function SignInPage() {
  const location = useLocation();
  const from = location.state?.from?.pathname || '/setup';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: theme.spacing[24],
        background: theme.background,
        color: theme.text,
      }}
    >
      <SignIn fallbackRedirectUrl={from} signUpUrl="/sign-up" />
    </div>
  );
}
