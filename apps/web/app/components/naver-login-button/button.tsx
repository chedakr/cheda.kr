"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import loginButtonImage from './btnG_official.png';

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

  if (query.isLoading) return null;

  if (query.data) {
    return (
      <Link onClick={() => {
        queryClient.invalidateQueries({ queryKey: ['auth'] });
      }} href={`http://localhost:8787/services/auth/v1/logout`}>
        로그아웃
      </Link>
    );
  }

  return (
    <Link href={`http://localhost:8787/services/auth/v1/login`}>
      <Image src={loginButtonImage} alt="Naver 로그인" width={230} height={50} unoptimized />
    </Link>
  );
}

