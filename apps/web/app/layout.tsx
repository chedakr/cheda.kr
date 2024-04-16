import "./globals.css";
import type { Metadata } from "next";
import ReactQueryProvider from "@/components/react-query-provider";
import { ThemeProvider } from '@/components/theme-provider';
import Header from '@/components/header';
import { cn } from '@/lib/utils';
import { notoSans } from './fonts';

export const metadata: Metadata = {
  title: "체다",
  description: "스트리밍 플랫폼 치지직 이용자 모두의 오픈소스 커뮤니티",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={cn(notoSans.className, 'antialiased')}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            <div className="mx-auto max-w-6xl pt-3">
              <Header />
              <main className="flex flex-col items-center justify-center">
                {children}
              </main>
            </div>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
