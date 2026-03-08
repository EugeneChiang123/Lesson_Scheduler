import { SignUp } from '@clerk/clerk-react';
import { theme } from '../styles/theme';

export default function SignUpPage() {
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
      <SignUp fallbackRedirectUrl="/setup" signInUrl="/sign-in" />
    </div>
  );
}
