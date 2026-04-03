'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-6 px-8 flex items-center justify-between border-b border-border">
        <h1 className="text-2xl font-bold">
          <span className="text-gold">Rival</span>
          <span className="text-purple">Rush</span>
        </h1>
        <div className="text-gray-400 text-sm">Дуэли на скорость печати</div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Докажи кто быстрее.{' '}
            <span className="text-gold">Поставь на себя.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            Вызови друга на дуэль по скорости печати. Кто быстрее наберёт текст — тот победил.
          </p>
          <Link href="/create" className="btn-gold text-xl inline-block">
            Создать дуэль
          </Link>
          <div className="mt-8 text-gray-500">
            <span className="text-gold font-semibold">1,247</span> дуэлей сыграно сегодня
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20 max-w-4xl mx-auto w-full">
          <h3 className="text-center text-2xl font-bold mb-10 text-gray-300">Как это работает</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card text-center">
              <div className="text-4xl mb-4">🎯</div>
              <div className="text-gold font-bold text-lg mb-2">1. Создай комнату</div>
              <p className="text-gray-400 text-sm">Введи никнейм и получи ссылку на дуэль</p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🔗</div>
              <div className="text-purple font-bold text-lg mb-2">2. Отправь другу</div>
              <p className="text-gray-400 text-sm">Поделись ссылкой — соперник подключится</p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">⚡</div>
              <div className="text-gold font-bold text-lg mb-2">3. Печатай!</div>
              <p className="text-gray-400 text-sm">Набирай текст быстрее соперника и победи</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-600 text-sm border-t border-border">
        RivalRush &copy; 2026
      </footer>
    </div>
  );
}
