'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';
import Link from 'next/link';

const STATES = {
  NICKNAME: 'nickname',
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

export default function GameRoom() {
  const { id: roomId } = useParams();
  const searchParams = useSearchParams();
  const initialNickname = searchParams.get('nickname') || '';

  const [gameState, setGameState] = useState(initialNickname ? STATES.WAITING : STATES.NICKNAME);
  const [nickname, setNickname] = useState(initialNickname);
  const [nicknameInput, setNicknameInput] = useState('');
  const [players, setPlayers] = useState([]);
  const [passage, setPassage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [myProgress, setMyProgress] = useState(0);
  const [myWpm, setMyWpm] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentWpm, setOpponentWpm] = useState(0);
  const [timer, setTimer] = useState(0);
  const [results, setResults] = useState(null);
  const [winnerId, setWinnerId] = useState(null);
  const [error, setError] = useState('');
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchIncoming, setRematchIncoming] = useState(false);
  const [playerLeft, setPlayerLeft] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const socketRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const inputRef = useRef(null);

  // Connect socket
  useEffect(() => {
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('player-joined', ({ players: ps }) => {
      setPlayers(ps);
    });

    socket.on('countdown', ({ count, passage: p }) => {
      setGameState(STATES.COUNTDOWN);
      setCountdown(count);
      if (p) setPassage(p);
    });

    socket.on('game-start', ({ passage: p, startTime }) => {
      setPassage(p);
      setGameState(STATES.PLAYING);
      setTypedText('');
      setMyProgress(0);
      setMyWpm(0);
      setOpponentProgress(0);
      setOpponentWpm(0);
      setTimer(0);
      setResults(null);
      setWinnerId(null);
      setRematchRequested(false);
      setRematchIncoming(false);
      setWaitingForOpponent(false);
      setPlayerLeft(false);
      startTimeRef.current = startTime;

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
    });

    socket.on('opponent-progress', ({ progress, wpm }) => {
      setOpponentProgress(progress);
      setOpponentWpm(wpm);
    });

    socket.on('waiting-for-opponent', () => {
      setWaitingForOpponent(true);
    });

    socket.on('opponent-finished', () => {
      // opponent finished first — no action needed, results will come when we finish
    });

    socket.on('game-results', ({ results: r, winnerId: w }) => {
      setResults(r);
      setWinnerId(w);
      setGameState(STATES.FINISHED);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    });

    socket.on('rematch-request', () => {
      setRematchIncoming(true);
    });

    socket.on('player-left', ({ nickname: n }) => {
      setPlayerLeft(true);
    });

    // If coming with nickname from create page, auto-join
    if (initialNickname) {
      socket.on('connect', () => {
        socket.emit('join-room', roomId, initialNickname, (response) => {
          if (response.error) {
            setError(response.error);
          }
        });
      });
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      socket.disconnect();
    };
  }, [roomId, initialNickname]);

  // Focus input when playing
  useEffect(() => {
    if (gameState === STATES.PLAYING && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState]);

  const joinRoom = () => {
    const name = nicknameInput.trim();
    if (!name) return;
    setNickname(name);
    setGameState(STATES.WAITING);

    socketRef.current.emit('join-room', roomId, name, (response) => {
      if (response.error) {
        setError(response.error);
        setGameState(STATES.NICKNAME);
      }
    });
  };

  const calculateWpm = useCallback(
    (typed) => {
      if (!startTimeRef.current) return 0;
      const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60; // minutes
      if (elapsed <= 0) return 0;
      const words = typed.length / 5;
      return Math.round(words / elapsed);
    },
    []
  );

  const calculateAccuracy = useCallback(
    (typed) => {
      if (typed.length === 0) return 100;
      let correct = 0;
      for (let i = 0; i < typed.length; i++) {
        if (typed[i] === passage[i]) correct++;
      }
      return Math.round((correct / typed.length) * 100);
    },
    [passage]
  );

  const handleTyping = (e) => {
    if (gameState !== STATES.PLAYING) return;

    const value = e.target.value;
    // Don't allow typing beyond passage length
    if (value.length > passage.length) return;

    setTypedText(value);

    const progress = Math.round((value.length / passage.length) * 100);
    const wpm = calculateWpm(value);

    setMyProgress(progress);
    setMyWpm(wpm);

    socketRef.current.emit('typing-progress', roomId, { progress, wpm });

    // Check if finished
    if (value.length === passage.length) {
      const accuracy = calculateAccuracy(value);
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);

      socketRef.current.emit('game-finish', roomId, {
        wpm,
        accuracy,
        time: elapsed,
      });
    }
  };

  const requestRematch = () => {
    if (rematchIncoming) {
      // Accept rematch
      socketRef.current.emit('rematch-accepted', roomId);
      setRematchIncoming(false);
    } else {
      socketRef.current.emit('rematch-request', roomId);
      setRematchRequested(true);
    }
  };

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const renderPassage = () => {
    return passage.split('').map((char, i) => {
      let className = 'char-pending';
      if (i < typedText.length) {
        className = typedText[i] === char ? 'char-correct' : 'char-incorrect';
      } else if (i === typedText.length) {
        className = 'char-current';
      }
      return (
        <span key={i} className={className}>
          {char}
        </span>
      );
    });
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link href="/create" className="btn-gold inline-block">
            Создать новую дуэль
          </Link>
        </div>
      </div>
    );
  }

  if (playerLeft) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-yellow-400 text-xl mb-4">Соперник покинул комнату</div>
          <Link href="/create" className="btn-gold inline-block">
            Создать новую дуэль
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="py-4 px-8 flex items-center justify-between border-b border-border">
        <Link href="/" className="text-xl font-bold">
          <span className="text-gold">Rival</span>
          <span className="text-purple">Rush</span>
        </Link>
        <div className="text-gray-400 text-sm">
          Комната: <span className="text-gold font-mono">{roomId}</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {/* Nickname entry */}
        {gameState === STATES.NICKNAME && (
          <div className="card max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-center">Присоединиться к дуэли</h2>
            <input
              type="text"
              placeholder="Ваш никнейм"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              maxLength={20}
              className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold mb-4"
              autoFocus
            />
            <button
              onClick={joinRoom}
              disabled={!nicknameInput.trim()}
              className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Войти
            </button>
          </div>
        )}

        {/* Waiting for opponent */}
        {gameState === STATES.WAITING && (
          <div className="card max-w-md w-full text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-xl font-bold mb-2">
              Ожидаем соперника<span className="animated-dots"></span>
            </h2>
            <p className="text-gray-400 mb-6">Отправь ссылку другу:</p>
            <div className="bg-bg border border-border rounded-lg p-3 mb-4">
              <code className="text-sm text-gray-300 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : ''}
              </code>
            </div>
            {players.length > 0 && (
              <div className="text-gray-500 text-sm">
                Игроков: {players.length}/2
              </div>
            )}
          </div>
        )}

        {/* Countdown */}
        {gameState === STATES.COUNTDOWN && (
          <div className="text-center">
            <div className="text-8xl font-bold text-gold countdown-number" key={countdown}>
              {countdown}
            </div>
            <p className="text-gray-400 mt-4 text-lg">Приготовьтесь...</p>
          </div>
        )}

        {/* Playing */}
        {gameState === STATES.PLAYING && (
          <div className="max-w-3xl w-full space-y-6">
            {/* Stats bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-gray-400 text-sm">Время</span>
                  <div className="text-gold font-mono text-xl">{formatTime(timer)}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">WPM</span>
                  <div className="text-white font-mono text-xl">{myWpm}</div>
                </div>
              </div>
              <div className="text-gray-400 text-sm">
                {nickname} vs {players.find((p) => p.nickname !== nickname)?.nickname || '...'}
              </div>
            </div>

            {/* Progress bars */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gold">{nickname}</span>
                  <span className="text-gray-400">{myProgress}%</span>
                </div>
                <div className="h-3 bg-bg rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${myProgress}%`,
                      background: 'linear-gradient(90deg, #f5c518, #e0a800)',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-purple">
                    {players.find((p) => p.nickname !== nickname)?.nickname || 'Соперник'}
                  </span>
                  <span className="text-gray-400">{opponentProgress}%</span>
                </div>
                <div className="h-3 bg-bg rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-purple rounded-full transition-all duration-200"
                    style={{ width: `${opponentProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Text passage */}
            <div className="card">
              <div className="text-lg leading-relaxed font-mono select-none" style={{ wordBreak: 'break-word' }}>
                {renderPassage()}
              </div>
            </div>

            {/* Hidden input for typing */}
            {waitingForOpponent ? (
              <div className="card text-center text-gold font-bold text-lg">
                Готово! Ожидаем соперника<span className="animated-dots"></span>
              </div>
            ) : (
              <textarea
                ref={inputRef}
                value={typedText}
                onChange={handleTyping}
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-white font-mono focus:outline-none focus:border-gold resize-none"
                placeholder="Начинай печатать здесь..."
                rows={3}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            )}
          </div>
        )}

        {/* Results */}
        {gameState === STATES.FINISHED && results && (
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold mb-2">
                {winnerId === socketRef.current?.id ? (
                  <span className="text-gold">Победа! 🏆</span>
                ) : (
                  <span className="text-gray-400">Поражение</span>
                )}
              </h2>
            </div>

            <div className="space-y-4">
              {[...results]
                .sort((a, b) => b.wpm - a.wpm)
                .map((r, i) => (
                  <div
                    key={r.id}
                    className={`card flex items-center justify-between ${
                      r.id === winnerId ? 'border-gold' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-gold text-lg">👑</span>}
                        <span className={`font-bold text-lg ${i === 0 ? 'text-gold' : 'text-gray-300'}`}>
                          {r.nickname}
                        </span>
                        {r.id === socketRef.current?.id && (
                          <span className="text-gray-500 text-sm">(вы)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <div className="text-gray-400 text-xs">WPM</div>
                        <div className="text-white font-mono font-bold">{r.wpm}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Точность</div>
                        <div className="text-white font-mono">{r.accuracy}%</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Время</div>
                        <div className="text-white font-mono">{formatTime(r.time)}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={requestRematch}
                disabled={rematchRequested}
                className="btn-gold disabled:opacity-50"
              >
                {rematchIncoming
                  ? 'Принять реванш'
                  : rematchRequested
                  ? 'Ожидаем соперника...'
                  : 'Реванш'}
              </button>
              <Link
                href="/create"
                className="py-3 px-8 rounded-lg border border-border text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
              >
                Новая дуэль
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
