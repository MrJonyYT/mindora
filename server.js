const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Конфигурация сессий
app.use(session({
  secret: 'mindora-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // В продакшене с HTTPS должно быть true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}));

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Инициализация базы данных
const db = new sqlite3.Database('mindora.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Подключено к базе данных SQLite');
    initDatabase();
  }
});

// Создание таблиц
function initDatabase() {
  db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица настроений (добавлен user_id)
    db.run(`CREATE TABLE IF NOT EXISTS moods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      note TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Таблица записей дневника (добавлен user_id)
    db.run(`CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      mood_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (mood_id) REFERENCES moods(id)
    )`);

    // Таблица статей поддержки (общие для всех)
    db.run(`CREATE TABLE IF NOT EXISTS support_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      // Добавляем начальные статьи, если их нет
      db.get('SELECT COUNT(*) as count FROM support_articles', (err, row) => {
        if (!err && row.count === 0) {
          insertDefaultArticles();
        }
      });
    });
  });
}

// Добавление начальных статей поддержки
function insertDefaultArticles() {
  const articles = [
    {
      title: 'Техники глубокого дыхания',
      content: 'Глубокое дыхание помогает снизить стресс и тревогу. Попробуйте технику 4-7-8: вдохните на 4 счета, задержите дыхание на 7 счетов, выдохните на 8 счетов. Повторите 4-5 раз.',
      category: 'Техники релаксации'
    },
    {
      title: 'Практика благодарности',
      content: 'Каждый день записывайте 3 вещи, за которые вы благодарны. Это помогает переключить внимание на позитивные аспекты жизни и улучшает общее настроение.',
      category: 'Позитивное мышление'
    },
    {
      title: 'Управление тревогой',
      content: 'Когда чувствуете тревогу, попробуйте технику "5-4-3-2-1": назовите 5 вещей, которые видите, 4 которых можете потрогать, 3 звука, 2 запаха и 1 вкус. Это поможет вернуться в настоящий момент.',
      category: 'Управление тревогой'
    },
    {
      title: 'Важность сна',
      content: 'Качественный сон - основа психического здоровья. Старайтесь спать 7-9 часов в сутки, соблюдайте режим сна и создайте расслабляющий ритуал перед сном.',
      category: 'Здоровый образ жизни'
    },
    {
      title: 'Медитация для начинающих',
      content: 'Начните с 5 минут в день. Сядьте удобно, закройте глаза и сосредоточьтесь на дыхании. Когда мысли отвлекают, мягко верните внимание к дыханию. Используйте приложения для медитации.',
      category: 'Техники релаксации'
    }
  ];

  const stmt = db.prepare(`INSERT INTO support_articles (title, content, category) VALUES (?, ?, ?)`);
  articles.forEach(article => {
    stmt.run(article.title, article.content, article.category);
  });
  stmt.finalize();
  console.log('Добавлены начальные статьи поддержки');
}

// Middleware для проверки аутентификации
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Требуется аутентификация' });
  }
}

// API: Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    res.status(400).json({ error: 'Все поля обязательны' });
    return;
  }
  
  if (password.length < 6) {
    res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    return;
  }
  
  try {
    // Проверка существования пользователя
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (row) {
        res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
        return;
      }
      
      // Хеширование пароля
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Создание пользователя
      db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, passwordHash],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // Создание сессии
          req.session.userId = this.lastID;
          req.session.username = username;
          
          res.json({ 
            id: this.lastID,
            username: username,
            message: 'Регистрация успешна' 
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
});

// API: Вход
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    return;
  }
  
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!user) {
      res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      return;
    }
    
    try {
      const match = await bcrypt.compare(password, user.password_hash);
      
      if (match) {
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ 
          id: user.id,
          username: user.username,
          message: 'Вход выполнен успешно' 
        });
      } else {
        res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Ошибка при проверке пароля' });
    }
  });
});

// API: Выход
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка при выходе' });
      return;
    }
    res.json({ message: 'Выход выполнен успешно' });
  });
});

// API: Проверка текущей сессии
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      id: req.session.userId,
      username: req.session.username,
      authenticated: true 
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// API: Получить все записи настроения
app.get('/api/moods', requireAuth, (req, res) => {
  const userId = req.session.userId;
  
  db.all(
    'SELECT * FROM moods WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    [userId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// API: Добавить запись настроения
app.post('/api/moods', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { mood, energy, note, tags } = req.body;
  
  if (!mood || !energy) {
    res.status(400).json({ error: 'Mood и energy обязательны' });
    return;
  }

  db.run(
    'INSERT INTO moods (user_id, mood, energy, note, tags) VALUES (?, ?, ?, ?, ?)',
    [userId, mood, energy, note || null, tags ? JSON.stringify(tags) : null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Запись настроения добавлена' });
    }
  );
});

// API: Обновить запись настроения
app.put('/api/moods/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const { mood, energy, note, tags } = req.body;
  
  if (!mood || !energy) {
    res.status(400).json({ error: 'Mood и energy обязательны' });
    return;
  }

  // Проверяем, что запись принадлежит пользователю
  db.get('SELECT id FROM moods WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    
    db.run(
      'UPDATE moods SET mood = ?, energy = ?, note = ?, tags = ? WHERE id = ? AND user_id = ?',
      [mood, energy, note || null, tags ? JSON.stringify(tags) : null, id, userId],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Запись настроения обновлена' });
      }
    );
  });
});

// API: Удалить запись настроения
app.delete('/api/moods/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  // Проверяем, что запись принадлежит пользователю
  db.get('SELECT id FROM moods WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    
    db.run('DELETE FROM moods WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Запись настроения удалена' });
    });
  });
});

// API: Получить статистику настроения
app.get('/api/moods/stats', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { period = '7' } = req.query;
  const days = parseInt(period);
  
  db.all(
    `SELECT 
      DATE(created_at) as date,
      AVG(mood) as avg_mood,
      AVG(energy) as avg_energy,
      COUNT(*) as count
    FROM moods 
    WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC`,
    [userId, days],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// API: Получить записи дневника
app.get('/api/journal', requireAuth, (req, res) => {
  const userId = req.session.userId;
  
  db.all(
    'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// API: Добавить запись в дневник
app.post('/api/journal', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { title, content, mood_id } = req.body;
  
  if (!content) {
    res.status(400).json({ error: 'Content обязателен' });
    return;
  }

  db.run(
    'INSERT INTO journal_entries (user_id, title, content, mood_id) VALUES (?, ?, ?, ?)',
    [userId, title || null, content, mood_id || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Запись дневника добавлена' });
    }
  );
});

// API: Обновить запись дневника
app.put('/api/journal/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;
  const { title, content, mood_id } = req.body;
  
  if (!content) {
    res.status(400).json({ error: 'Content обязателен' });
    return;
  }

  // Проверяем, что запись принадлежит пользователю
  db.get('SELECT id FROM journal_entries WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    
    db.run(
      'UPDATE journal_entries SET title = ?, content = ?, mood_id = ? WHERE id = ? AND user_id = ?',
      [title || null, content, mood_id || null, id, userId],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Запись дневника обновлена' });
      }
    );
  });
});

// API: Удалить запись дневника
app.delete('/api/journal/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { id } = req.params;

  // Проверяем, что запись принадлежит пользователю
  db.get('SELECT id FROM journal_entries WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    
    db.run('DELETE FROM journal_entries WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Запись дневника удалена' });
    });
  });
});

// API: Получить статьи поддержки
app.get('/api/support', (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM support_articles';
  const params = [];
  
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// API: Получить категории статей
app.get('/api/support/categories', (req, res) => {
  db.all('SELECT DISTINCT category FROM support_articles WHERE category IS NOT NULL', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => row.category));
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница входа
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log('Откройте приложение на мобильном устройстве или используйте DevTools для эмуляции мобильного устройства');
});

// Закрытие базы данных при завершении
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Соединение с базой данных закрыто');
    process.exit(0);
  });
});

