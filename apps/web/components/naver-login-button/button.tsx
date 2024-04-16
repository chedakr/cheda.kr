"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';

import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton"

import loginButtonImage from './btnG_short.png';
import logoutButtonImage from './btnG_logout.png';

export default function NaverLoginButton() {
  const queryClient = useQueryClient();

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
    return <Skeleton className="w-[113px] h-[40px]" />;
  }

  if (query.data) {
    return (
      <Link onClick={() => {
        queryClient.invalidateQueries({ queryKey: ['auth'] });
      }} href={`http://localhost:8787/services/auth/v1/logout`}>
        <Image src={logoutButtonImage} alt="Naver 로그아웃" width={113} height={40} unoptimized />
      </Link>
    );
  }

  return (
    <Link href={`http://localhost:8787/services/auth/v1/login`}>
      <Image src={loginButtonImage} alt="Naver 로그인" width={113} height={40} unoptimized />
    </Link>
  );
}

