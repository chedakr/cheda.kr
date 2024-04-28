"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';

import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton"

// import loginButtonImage from './btnG_short.png';
// import logoutButtonImage from './btnG_logout.png';

import loginButtonImage from './btnG_official.png';
const logoutButtonImage = loginButtonImage;

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_API_ORIGIN: string;
    }
  }
}

export default function NaverLoginButton({ prevUrl }: { prevUrl?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_ORIGIN}/services/auth/v1/me`, {
        credentials: 'include',
      });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
  });

  if (query.isLoading) {
    return <Skeleton className="w-[230px] h-[50px]" />;
  }

  if (query.data) {
    return (
      <Link onClick={() => {
        queryClient.invalidateQueries({ queryKey: ['auth'] });
      }} href={`${process.env.NEXT_PUBLIC_API_ORIGIN}/services/auth/v1/logout`}>
        <Image src={logoutButtonImage} alt="Naver 로그아웃" width={230} height={50} unoptimized />
      </Link>
    );
  }

  return (
    <Link href={`${process.env.NEXT_PUBLIC_API_ORIGIN}/services/auth/v1/login${prevUrl ? `?prevUrl=${prevUrl}` : ''}`}>
      <Image src={loginButtonImage} alt="Naver 로그인" width={230} height={50} unoptimized />
    </Link>
  );
}
