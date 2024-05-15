import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import bufferLogoImage from './icon-resized.png';

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)] break-keep">
      <main className="flex-1">
        <section className="w-full py-6 md:py-12 lg:py-16 xl:py-24">
          <div className="container grid gap-4 px-4 text-center md:px-6 xl:gap-10">
            <div className="space-y-4">
              <div className="inline-block rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">
                Say cheese!
              </div>
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl">다같이 만드는 스트리밍 경험 향상</h1>
              <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                체다에서는 스트리밍 플랫폼 치지직의 스트리머와 시청자 모두에게 도움이 될 수 있는 서비스들을 만듭니다
              </p>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-18">
          <div className="container grid gap-6 px-4 text-center md:px-6 lg:grid-cols-1 lg:gap-10">
            <div className="flex flex-col items-center space-y-2">
              <Image src={bufferLogoImage} width="57" height="57" alt="버퍼 로고" unoptimized />
              <div className="space-y-1">
                <h3 className="text-lg font-bold">버퍼 확장 프로그램</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">스트리밍 플랫폼 치지직 기능 확장</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="https://buffer.cheda.kr">
                  이동 &rarr;
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
