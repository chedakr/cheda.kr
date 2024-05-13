'use client';

import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from '@/hooks/useAuth';

export default function LoginButton() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <Skeleton className="w-20 h-10" />;
  }

  if (!auth.data?.loggedIn) {
    return (
      <Button variant="outline" className="w-16" asChild>
        <Link href="/login">로그인</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage src={auth.data.user.userImage} alt={auth.data.user.userName} />
          <AvatarFallback>{auth.data.user.userName.substring(0, 1)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          {auth.data.user.userName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link
            href={`${process.env.NEXT_PUBLIC_API_ORIGIN}/services/auth/v1/logout`}
            className="w-full"
          >
            로그아웃
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
