"use client";

import { useEffect } from 'react';
import Link from "next/link";

export default function Home() {
  useEffect(() => {
    window.location.href = "https://buffer.cheda.kr/news";
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Link href="https://buffer.cheda.kr/news">버퍼 : 치지직 확장 프로그램으로 이동</Link>
    </main>
  );
}
