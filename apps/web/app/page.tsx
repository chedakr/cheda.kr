import Image from 'next/image';
import NaverLoginButton from './components/naver-login-button/button';
import logoImage from './cheda-transparent.png';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-5">
      <Image src={logoImage} alt="Cheda Logo" width={132} height={147} unoptimized />

      <NaverLoginButton />
    </main>
  );
}
