"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NaverLoginButton from '@/components/naver-login-button/button';

export default function LoginPage() {
  return (
    <div>
      <Suspense>
        <LoginButton />
      </Suspense>
    </div>
  );
}

function LoginButton() {
  const searchParams = useSearchParams();

  return <NaverLoginButton prevUrl={decodeURIComponent(searchParams.get('prevUrl') ?? '')} />;
}
