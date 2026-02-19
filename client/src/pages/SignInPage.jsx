import { SignIn } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';

export default function SignInPage() {
  const location = useLocation();
  const from = location.state?.from?.pathname || '/setup';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 24 }}>
      <SignIn fallbackRedirectUrl={from} signUpUrl="/sign-up" />
    </div>
  );
}
