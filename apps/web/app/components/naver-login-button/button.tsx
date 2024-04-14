import Link from 'next/link';
import Image from 'next/image';
import loginButtonImage from './btnG_official.png';

export default function NaverLoginButton() {
  return (
    <Link href={`http://localhost:8787/services/auth/v1/login`}>
      <Image src={loginButtonImage} alt="Naver 로그인" width={230} height={50} unoptimized />
    </Link>
  );
}

