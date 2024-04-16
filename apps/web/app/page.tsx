"use client";

import Image from 'next/image';

import { useQuery } from '@tanstack/react-query';
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import NaverLoginButton from '@/components/naver-login-button/button';
import { cn } from '@/lib/utils';
import { blackHanSans } from './fonts';
import logoImage from './cheda-transparent.png';

export default function Home() {
  const { resolvedTheme: theme, setTheme } = useTheme();

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
    <>
      <header className="flex justify-between items-center w-full border-b py-3 px-7">
        <div className="flex flex-row justify-center items-center gap-1">
          <Image src={logoImage} alt="로고" width={22} height={24} unoptimized />
          <div className={cn(blackHanSans.className, 'text-2xl leading-7 h-[24px] text-amber-400')}>
            체다
          </div>
        </div>
        <div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </header>
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
    </>
  );
}
