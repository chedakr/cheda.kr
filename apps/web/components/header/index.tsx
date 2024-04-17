import Image from 'next/image';
import Link from 'next/link';

import { Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/theme-toggle";
import { blackHanSans } from '@/app/fonts';
import { cn } from '@/lib/utils';
import logoImage from './cheda-transparent.png';

export default function Header() {
  return (
    <header className="px-4 lg:px-6 h-14 flex items-center">
      <Link href="/">
        <div className="flex flex-row justify-center items-center gap-1">
          <Image src={logoImage} alt="로고" width={22} height={24} unoptimized />
          <div className={cn(blackHanSans.className, 'text-3xl leading-8 h-[28px] text-amber-500 dark:text-amber-400')}>
            체다
          </div>
        </div>
      </Link>
      <nav className="ml-auto flex gap-3">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild>
          <Link href="https://github.com/chedakr" target="_blank">
            <Github className="h-[1.2rem] w-[1.2rem]" />
          </Link>
        </Button>
      </nav>
    </header>
  );
}

