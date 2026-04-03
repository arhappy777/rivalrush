const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3010;

const rooms = new Map();

const passages = [
  'Байкал — самое глубокое озеро на планете, его максимальная глубина достигает 1642 метров. В нём содержится около двадцати процентов мировых запасов пресной воды. Вода настолько чистая, что камни на дне видны на глубине до сорока метров.',
  'Северное сияние возникает, когда заряженные частицы солнечного ветра сталкиваются с атомами в верхних слоях атмосферы. Это явление чаще всего наблюдается вблизи магнитных полюсов Земли и может длиться от нескольких минут до нескольких часов.',
  'Первый искусственный спутник Земли был запущен четвёртого октября тысяча девятьсот пятьдесят седьмого года. Он весил чуть больше восьмидесяти килограммов и совершал один оборот вокруг планеты примерно за полтора часа, подавая радиосигналы.',
  'Тайга занимает огромную территорию России, простираясь от Урала до Тихого океана. Здесь растут ели, сосны, лиственницы и кедры. Зимой температура может опускаться до минус пятидесяти градусов, а лето короткое но тёплое.',
  'Шахматы появились в Индии примерно в шестом веке нашей эры. Игра быстро распространилась по всему миру и стала символом интеллектуального соревнования. Сегодня в шахматы играют миллионы людей на всех континентах планеты.',
  'Человеческий мозг потребляет около двадцати процентов всей энергии организма, хотя составляет лишь два процента массы тела. Он содержит примерно восемьдесят шесть миллиардов нейронов, каждый из которых связан с тысячами других.',
  'Транссибирская магистраль — самая длинная железная дорога в мире, протянувшаяся на девять тысяч двести восемьдесят восемь километров. Поезд проходит весь путь от Москвы до Владивостока примерно за шесть с половиной суток.',
  'Дождевые леса Амазонки производят около двадцати процентов кислорода на Земле. В этих лесах обитает десять процентов всех известных видов животных. Каждый год здесь открывают сотни новых видов растений и насекомых.',
  'Великая Китайская стена строилась на протяжении более двух тысяч лет. Её общая длина с учётом всех ответвлений превышает двадцать одну тысячу километров. Стена была возведена для защиты от набегов кочевых племён с севера.',
  'Периодическая таблица химических элементов была создана Дмитрием Менделеевым в тысяча восемьсот шестьдесят девятом году. Он расположил элементы по возрастанию атомной массы и предсказал существование нескольких ещё не открытых элементов.',
];

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRandomPassage() {
  return passages[Math.floor(Math.random() * passages.length)];
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: { origin: '*' },
  });

  // REST-style room creation via query
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create-room', (nickname, callback) => {
      const roomId = generateRoomId();
      const room = {
        id: roomId,
        passage: getRandomPassage(),
        players: [],
        started: false,
        startTime: null,
        createdAt: Date.now(),
      };
      rooms.set(roomId, room);
      callback({ roomId });
      console.log(`Room ${roomId} created by ${nickname}`);
    });

    socket.on('join-room', (roomId, nickname, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        callback({ error: 'Комната не найдена' });
        return;
      }
      if (room.players.length >= 2) {
        callback({ error: 'Комната заполнена' });
        return;
      }
      if (room.started) {
        callback({ error: 'Игра уже началась' });
        return;
      }

      room.players.push({ id: socket.id, nickname, progress: 0, wpm: 0, finished: false });
      socket.join(roomId);
      callback({ success: true, passage: room.passage });

      // Notify both players
      io.to(roomId).emit('player-joined', {
        players: room.players.map((p) => ({ nickname: p.nickname, id: p.id })),
      });

      // Start countdown if 2 players
      if (room.players.length === 2) {
        let count = 3;
        io.to(roomId).emit('countdown', { count, passage: room.passage });
        const interval = setInterval(() => {
          count--;
          if (count > 0) {
            io.to(roomId).emit('countdown', { count });
          } else {
            clearInterval(interval);
            room.started = true;
            room.startTime = Date.now();
            io.to(roomId).emit('game-start', { passage: room.passage, startTime: room.startTime });
          }
        }, 1000);
      }
    });

    socket.on('typing-progress', (roomId, data) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      player.progress = data.progress;
      player.wpm = data.wpm;

      socket.to(roomId).emit('opponent-progress', {
        progress: data.progress,
        wpm: data.wpm,
      });
    });

    socket.on('game-finish', (roomId, data) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player || player.finished) return;

      player.finished = true;
      player.wpm = data.wpm;
      player.accuracy = data.accuracy;
      player.time = data.time;

      const allFinished = room.players.every((p) => p.finished);
      if (allFinished) {
        const results = room.players.map((p) => ({
          nickname: p.nickname,
          wpm: p.wpm,
          accuracy: p.accuracy,
          time: p.time,
          id: p.id,
        }));
        const winner = results.reduce((a, b) => (a.wpm > b.wpm ? a : b));
        io.to(roomId).emit('game-results', { results, winnerId: winner.id });
      } else {
        // First to finish — notify them to wait
        socket.emit('waiting-for-opponent');
        socket.to(roomId).emit('opponent-finished', {
          nickname: player.nickname,
          wpm: player.wpm,
        });
      }
    });

    socket.on('rematch-request', (roomId) => {
      socket.to(roomId).emit('rematch-request');
    });

    socket.on('rematch-accepted', (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.rematchPending) return;
      room.rematchPending = true;

      room.passage = getRandomPassage();
      room.started = false;
      room.startTime = null;
      room.players.forEach((p) => {
        p.progress = 0;
        p.wpm = 0;
        p.finished = false;
        p.accuracy = undefined;
        p.time = undefined;
      });

      // Start countdown again
      let count = 3;
      io.to(roomId).emit('countdown', { count, passage: room.passage });
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          io.to(roomId).emit('countdown', { count });
        } else {
          clearInterval(interval);
          room.started = true;
          room.startTime = Date.now();
          room.rematchPending = false;
          io.to(roomId).emit('game-start', { passage: room.passage, startTime: room.startTime });
        }
      }, 1000);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      for (const [roomId, room] of rooms) {
        const idx = room.players.findIndex((p) => p.id === socket.id);
        if (idx !== -1) {
          const nickname = room.players[idx].nickname;
          room.players.splice(idx, 1);
          io.to(roomId).emit('player-left', { nickname });
          if (room.players.length === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty)`);
          }
        }
      }
    });
  });

  // Cleanup abandoned rooms every 60 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms) {
      if (room.players.length === 0 && now - room.createdAt > 10 * 60 * 1000) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} cleaned up (abandoned)`);
      }
    }
  }, 60000);

  server.listen(PORT, () => {
    console.log(`> RivalRush ready on http://localhost:${PORT}`);
  });
});
