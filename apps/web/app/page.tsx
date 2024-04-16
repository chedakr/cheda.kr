import Image from 'next/image';
import Link from 'next/link';

import bufferLogoImage from './icon-resized.png';

export default function Home() {
  return (
    <section className="pt-24">
      <Link href="https://buffer.cheda.kr">
        <div className="flex flex-col items-center gap-3">
          <Image {...bufferLogoImage} width="114" height="114" alt="버퍼 확장 프로그램" unoptimized />
          <div className="text-2xl font-bold">버퍼</div>
        </div>
      </Link>
    </section>
  );
}
