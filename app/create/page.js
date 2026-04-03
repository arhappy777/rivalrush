'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import Link from 'next/link';

export default function CreateRoom() {
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleCreate = () => {
    if (!nickname.trim()) return;
    setLoading(true);

    const socket = io(window.location.origin);
    socket.on('connect', () => {
      socket.emit('create-room', nickname.trim(), (response) => {
        setRoomId(response.roomId);
        setLoading(false);
        socket.disconnect();
      });
    });
  };

  const roomUrl = roomId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomId}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 px-8 flex items-center justify-between border-b border-border">
        <Link href="/" className="text-2xl font-bold">
          <span className="text-gold">Rival</span>
          <span className="text-purple">Rush</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="card max-w-md w-full">
          {!roomId ? (
            <>
              <h2 className="text-2xl font-bold mb-6 text-center">Создать дуэль</h2>
              <input
                type="text"
                placeholder="Ваш никнейм"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                maxLength={20}
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold mb-4"
              />
              <button
                onClick={handleCreate}
                disabled={!nickname.trim() || loading}
                className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создаём...' : 'Создать комнату'}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2 text-center text-gold">Комната создана!</h2>
              <p className="text-gray-400 text-center mb-6">Отправь ссылку сопернику</p>

              <div className="bg-bg border border-border rounded-lg p-4 mb-4 flex items-center justify-between gap-3">
                <code className="text-sm text-gray-300 truncate flex-1">{roomUrl}</code>
                <button
                  onClick={copyLink}
                  className="text-gold hover:text-yellow-300 text-sm font-semibold whitespace-nowrap"
                >
                  {copied ? '✓ Скопировано' : 'Копировать'}
                </button>
              </div>

              <Link
                href={`/room/${roomId}?nickname=${encodeURIComponent(nickname)}`}
                className="btn-gold w-full text-center block"
              >
                Войти в комнату
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
