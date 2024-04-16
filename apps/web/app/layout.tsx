import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ReactQueryProvider from "@/components/react-query-provider";
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ["latin"] });

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
        <body className={inter.className}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ReactQueryProvider>
              {children}
            </ReactQueryProvider>
          </ThemeProvider>
        </body>
      </html>
  );
}
