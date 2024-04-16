"use client";

import Image from 'next/image';

import { useQuery } from '@tanstack/react-query';

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import NaverLoginButton from '@/components/naver-login-button/button';
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-5">
      <Card className="min-w-[270px]">
        <CardContent className="flex flex-col items-center justify-center gap-5 p-5">
          <Image src={logoImage} alt="Cheda Logo" width={132} height={147} unoptimized />
          {query.isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="w-[32px] h-[32px]" />
            </div>
          ) : query.data ? (
            <div className="flex items-center gap-3">
              <span>{query.data.name}</span>
              <Image src={query.data.image} alt="User Image" width={32} height={32} unoptimized />
            </div>
          ) : (
            <div className="flex items-center gap-3"></div>
          )}
          <NaverLoginButton />
        </CardContent>
      </Card>
    </main>
  );
}
