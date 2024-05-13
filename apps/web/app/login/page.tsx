"use client";

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import NaverLoginButton from '@/components/naver-login-button/button';
import useAuth from '@/hooks/useAuth';

export default function LoginPage() {
  return (
    <div className="flex flex-col space-y-5 justify-center items-center min-h-[calc(100vh-60px)]">
      <h2 className="text-3xl font-bold">
        체다 서비스에 로그인
      </h2>
      <Suspense>
        <LoginButton />
      </Suspense>
    </div>
  );
}

function LoginButton() {
  const auth = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  const prevUrl = decodeURIComponent(searchParams.get('prevUrl') ?? '');

  useEffect(() => {
    if (auth.data?.loggedIn) {
      router.push(prevUrl || '/');
    }
  }, [auth.data]);

  return <NaverLoginButton prevUrl={decodeURIComponent(prevUrl)} />;
}
