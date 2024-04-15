"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

import { useQuery } from '@tanstack/react-query';

import NaverLoginButton from './components/naver-login-button/button';
import logoImage from './cheda-transparent.png';

export default function Home() {
  const query = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await fetch('http://localhost:8787/services/auth/v1/me', {
        credentials: 'include',
      });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
  });

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-24 gap-5">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-5">
      <Image src={logoImage} alt="Cheda Logo" width={132} height={147} unoptimized />
      {query.data && (
        <>
          <div className="flex items-center gap-3">
            {query.data.name}
            <Image src={query.data.image} alt="User Image" width={32} height={32} unoptimized />
          </div>
        </>
      )}
      <NaverLoginButton />
    </main>
  );
}
