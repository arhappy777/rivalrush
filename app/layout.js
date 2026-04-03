import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['cyrillic', 'latin'] });

export const metadata = {
  title: 'RivalRush — Дуэли на скорость печати',
  description: 'Соревнуйся в скорости печати 1 на 1. Докажи кто быстрее!',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={`${inter.className} min-h-screen font-sans antialiased`}>{children}</body>
    </html>
  );
}
