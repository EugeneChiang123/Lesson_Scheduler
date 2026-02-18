import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 24 }}>
      <SignUp fallbackRedirectUrl="/setup" signInUrl="/sign-in" />
    </div>
  );
}
