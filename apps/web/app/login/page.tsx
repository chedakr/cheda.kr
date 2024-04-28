"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import NaverLoginButton from '@/components/naver-login-button/button';

export default function LoginPage() {
  const searchParams = useSearchParams();

  return (
    <div>
      <NaverLoginButton prevUrl={decodeURIComponent(searchParams.get('prevUrl') ?? '')} />
    </div>
  );
}
