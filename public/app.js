// Проверка на мобильное устройство
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         (window.innerWidth <= 768);
}

// Показываем предупреждение для десктопов
if (!isMobileDevice()) {
  document.getElementById('desktop-warning').classList.add('show');
}

// API URL
const API_URL = window.location.origin;

// Проверка аутентификации при загрузке
let currentUser = null;

// Helper функция для проверки ошибок авторизации перед парсингом JSON
function checkAuthError(response) {
  if (response.status === 401) {
    window.location.href = '/login.html';
    return true;
  }
  return false;
}

async function checkAuth() {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.authenticated) {
      currentUser = data;
      document.getElementById('username-display').textContent = data.username;
      // Загружаем данные
      loadRecentMoods();
      loadSupportArticles();
      loadJournalEntries();
    } else {
      // Не авторизован - перенаправляем на страницу входа
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('Ошибка проверки аутентификации:', error);
    window.location.href = '/login.html';
  }
}

// Выход
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (!confirm('Вы уверены, что хотите выйти?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      window.location.href = '/login.html';
    } else {
      alert('Ошибка при выходе');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Ошибка при выходе');
  }
});

// Управление вкладками
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    // Обновляем активные вкладки
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`${targetTab}-tab`).classList.add('active');
    
    // Загружаем данные при переключении
    if (targetTab === 'stats') {
      loadStats();
    } else if (targetTab === 'support') {
      loadSupportArticles();
    } else if (targetTab === 'journal') {
      loadJournalEntries();
    } else if (targetTab === 'mood') {
      loadRecentMoods();
    }
  });
});

// Трекер настроения
let selectedMood = null;

document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMood = parseInt(btn.dataset.mood);
  });
});

// Слайдер энергии
const energySlider = document.getElementById('energy-slider');
const energyValue = document.getElementById('energy-value');

energySlider.addEventListener('input', (e) => {
  energyValue.textContent = e.target.value;
});

// Сохранение настроения
document.getElementById('save-mood-btn').addEventListener('click', async () => {
  if (!selectedMood) {
    alert('Пожалуйста, выберите настроение');
    return;
  }
  
  const mood = selectedMood;
  const energy = parseInt(energySlider.value);
  const note = document.getElementById('mood-note').value.trim();
  
  try {
    const response = await fetch(`${API_URL}/api/moods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ mood, energy, note })
    });
    
    if (checkAuthError(response)) return;
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Настроение сохранено!');
      // Сброс формы
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      selectedMood = null;
      energySlider.value = 3;
      energyValue.textContent = '3';
      document.getElementById('mood-note').value = '';
      
      // Обновляем список
      loadRecentMoods();
    } else {
      alert('Ошибка: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось сохранить настроение');
  }
});

// Загрузка последних настроений
async function loadRecentMoods() {
  const container = document.getElementById('recent-moods');
  container.innerHTML = '<p class="loading">Загрузка...</p>';
  
  try {
    const response = await fetch(`${API_URL}/api/moods`, {
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const moods = await response.json();
    
    if (moods.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Пока нет записей</p></div>';
      return;
    }
    
    container.innerHTML = moods.map(mood => {
      const emojis = ['', '😢', '😔', '😐', '🙂', '😊'];
      const date = new Date(mood.created_at);
      const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return `
        <div class="mood-item" data-id="${mood.id}">
          <div class="mood-item-header">
            <div>
              <span class="mood-item-emoji">${emojis[mood.mood]}</span>
              <span>Энергия: ${mood.energy}/5</span>
            </div>
            <div class="mood-item-actions">
              <span class="mood-item-date">${dateStr}</span>
              <button class="icon-btn edit-btn" data-id="${mood.id}" title="Редактировать">✏️</button>
              <button class="icon-btn delete-btn" data-id="${mood.id}" title="Удалить">🗑️</button>
            </div>
          </div>
          ${mood.note ? `<div class="mood-item-note">${escapeHtml(mood.note)}</div>` : ''}
        </div>
      `;
    }).join('');
    
    // Добавляем обработчики для кнопок редактирования и удаления
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editMood(parseInt(btn.dataset.id)));
    });
    
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteMood(parseInt(btn.dataset.id)));
    });
  } catch (error) {
    console.error('Ошибка:', error);
    container.innerHTML = '<p class="loading">Ошибка загрузки данных</p>';
  }
}

// Редактирование записи настроения
async function editMood(id) {
  try {
    const response = await fetch(`${API_URL}/api/moods`, {
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const moods = await response.json();
    const mood = moods.find(m => m.id === id);
    
    if (!mood) {
      alert('Запись не найдена');
      return;
    }
    
    // Заполняем форму
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.emoji-btn[data-mood="${mood.mood}"]`).classList.add('selected');
    selectedMood = mood.mood;
    energySlider.value = mood.energy;
    energyValue.textContent = mood.energy;
    document.getElementById('mood-note').value = mood.note || '';
    
    // Прокручиваем к форме
    document.getElementById('mood-tab').scrollIntoView({ behavior: 'smooth' });
    
    // Сохраняем ID для обновления
    const saveBtn = document.getElementById('save-mood-btn');
    const originalText = saveBtn.textContent;
    const originalOnClick = saveBtn.onclick;
    
    saveBtn.dataset.editId = id;
    saveBtn.textContent = 'Обновить';
    
    // Временный обработчик
    saveBtn.onclick = async () => {
      if (!selectedMood) {
        alert('Пожалуйста, выберите настроение');
        return;
      }
      
      const moodValue = selectedMood;
      const energyVal = parseInt(energySlider.value);
      const note = document.getElementById('mood-note').value.trim();
      
      try {
        const response = await fetch(`${API_URL}/api/moods/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ mood: moodValue, energy: energyVal, note })
        });
        
        if (checkAuthError(response)) return;
        
        const data = await response.json();
        
        if (response.ok) {
          alert('Запись обновлена!');
          // Сброс
          saveBtn.removeAttribute('data-edit-id');
          saveBtn.textContent = originalText;
          saveBtn.onclick = originalOnClick;
          document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
          selectedMood = null;
          energySlider.value = 3;
          document.getElementById('energy-value').textContent = '3';
          document.getElementById('mood-note').value = '';
          loadRecentMoods();
        } else {
          alert('Ошибка: ' + data.error);
        }
      } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось обновить запись');
      }
    };
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось загрузить запись');
  }
}

// Удаление записи настроения
async function deleteMood(id) {
  if (!confirm('Вы уверены, что хотите удалить эту запись?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/moods/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const data = await response.json();
    
    if (response.ok) {
      loadRecentMoods();
    } else {
      alert('Ошибка: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось удалить запись');
  }
}

// Психологическая поддержка
let currentCategory = '';

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.category;
    loadSupportArticles();
  });
});

async function loadSupportArticles() {
  const container = document.getElementById('support-articles');
  container.innerHTML = '<p class="loading">Загрузка статей...</p>';
  
  try {
    const url = currentCategory 
      ? `${API_URL}/api/support?category=${encodeURIComponent(currentCategory)}`
      : `${API_URL}/api/support`;
    
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const articles = await response.json();
    
    if (articles.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>Статей не найдено</p></div>';
      return;
    }
    
    container.innerHTML = articles.map(article => `
      <div class="article-card">
        <h3>${escapeHtml(article.title)}</h3>
        ${article.category ? `<div class="article-category">${escapeHtml(article.category)}</div>` : ''}
        <div class="article-content">${escapeHtml(article.content)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Ошибка:', error);
    container.innerHTML = '<p class="loading">Ошибка загрузки статей</p>';
  }
}

// Дневник
document.getElementById('save-journal-btn').addEventListener('click', async () => {
  const title = document.getElementById('journal-title').value.trim();
  const content = document.getElementById('journal-content').value.trim();
  
  if (!content) {
    alert('Пожалуйста, введите текст записи');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ title, content })
    });
    
    if (checkAuthError(response)) return;
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Запись сохранена!');
      document.getElementById('journal-title').value = '';
      document.getElementById('journal-content').value = '';
      loadJournalEntries();
    } else {
      alert('Ошибка: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось сохранить запись');
  }
});

async function loadJournalEntries() {
  const container = document.getElementById('journal-entries');
  container.innerHTML = '<p class="loading">Загрузка...</p>';
  
  try {
    const response = await fetch(`${API_URL}/api/journal`, {
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const entries = await response.json();
    
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><p>Записей пока нет</p></div>';
      return;
    }
    
    container.innerHTML = entries.map(entry => {
      const date = new Date(entry.created_at);
      const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return `
        <div class="journal-entry" data-id="${entry.id}">
          <div class="journal-entry-header">
            ${entry.title ? `<div class="journal-entry-title">${escapeHtml(entry.title)}</div>` : ''}
            <div class="journal-entry-actions">
              <button class="icon-btn edit-journal-btn" data-id="${entry.id}" title="Редактировать">✏️</button>
              <button class="icon-btn delete-journal-btn" data-id="${entry.id}" title="Удалить">🗑️</button>
            </div>
          </div>
          <div class="journal-entry-content">${escapeHtml(entry.content)}</div>
          <div class="journal-entry-date">${dateStr}</div>
        </div>
      `;
    }).join('');
    
    // Добавляем обработчики для кнопок редактирования и удаления
    container.querySelectorAll('.edit-journal-btn').forEach(btn => {
      btn.addEventListener('click', () => editJournalEntry(parseInt(btn.dataset.id)));
    });
    
    container.querySelectorAll('.delete-journal-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteJournalEntry(parseInt(btn.dataset.id)));
    });
  } catch (error) {
    console.error('Ошибка:', error);
    container.innerHTML = '<p class="loading">Ошибка загрузки данных</p>';
  }
}

// Редактирование записи дневника
async function editJournalEntry(id) {
  try {
    const response = await fetch(`${API_URL}/api/journal`, {
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const entries = await response.json();
    const entry = entries.find(e => e.id === id);
    
    if (!entry) {
      alert('Запись не найдена');
      return;
    }
    
    // Заполняем форму
    document.getElementById('journal-title').value = entry.title || '';
    document.getElementById('journal-content').value = entry.content;
    
    // Прокручиваем к форме
    document.getElementById('journal-tab').scrollIntoView({ behavior: 'smooth' });
    
    // Сохраняем ID для обновления
    const saveBtn = document.getElementById('save-journal-btn');
    saveBtn.dataset.editId = id;
    saveBtn.textContent = 'Обновить запись';
    
    // Изменяем обработчик сохранения
    const oldHandler = saveBtn.onclick;
    saveBtn.onclick = async () => {
      const title = document.getElementById('journal-title').value.trim();
      const content = document.getElementById('journal-content').value.trim();
      
      if (!content) {
        alert('Пожалуйста, введите текст записи');
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/api/journal/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ title, content })
        });
        
        if (checkAuthError(response)) return;
        
        const data = await response.json();
        
        if (response.ok) {
          alert('Запись обновлена!');
          // Сброс
          saveBtn.removeAttribute('data-edit-id');
          saveBtn.textContent = 'Сохранить запись';
          saveBtn.onclick = oldHandler;
          document.getElementById('journal-title').value = '';
          document.getElementById('journal-content').value = '';
          loadJournalEntries();
        } else {
          alert('Ошибка: ' + data.error);
        }
      } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось обновить запись');
      }
    };
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось загрузить запись');
  }
}

// Удаление записи дневника
async function deleteJournalEntry(id) {
  if (!confirm('Вы уверены, что хотите удалить эту запись?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/journal/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const data = await response.json();
    
    if (response.ok) {
      loadJournalEntries();
    } else {
      alert('Ошибка: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось удалить запись');
  }
}

// Статистика
let currentPeriod = 7;

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = parseInt(btn.dataset.period);
    loadStats();
  });
});

async function loadStats() {
  const infoContainer = document.getElementById('stats-info');
  infoContainer.innerHTML = '<p class="loading">Загрузка статистики...</p>';
  
  try {
    const response = await fetch(`${API_URL}/api/moods/stats?period=${currentPeriod}`, {
      credentials: 'include'
    });
    
    if (checkAuthError(response)) return;
    
    const stats = await response.json();
    
    if (stats.length === 0) {
      infoContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><p>Недостаточно данных для статистики</p></div>';
      return;
    }
    
    // Рисуем простой график
    drawChart(stats);
    
    // Вычисляем средние значения
    const avgMood = stats.reduce((sum, s) => sum + s.avg_mood, 0) / stats.length;
    const avgEnergy = stats.reduce((sum, s) => sum + s.avg_energy, 0) / stats.length;
    const totalEntries = stats.reduce((sum, s) => sum + parseInt(s.count), 0);
    
    infoContainer.innerHTML = `
      <div class="stat-item">
        <span>Среднее настроение:</span>
        <strong>${avgMood.toFixed(1)}/5</strong>
      </div>
      <div class="stat-item">
        <span>Средняя энергия:</span>
        <strong>${avgEnergy.toFixed(1)}/5</strong>
      </div>
      <div class="stat-item">
        <span>Всего записей:</span>
        <strong>${totalEntries}</strong>
      </div>
      <div class="stat-item">
        <span>Дней отслеживания:</span>
        <strong>${stats.length}</strong>
      </div>
    `;
  } catch (error) {
    console.error('Ошибка:', error);
    infoContainer.innerHTML = '<p class="loading">Ошибка загрузки статистики</p>';
  }
}

function drawChart(data) {
  const canvas = document.getElementById('mood-chart');
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 200;
  
  ctx.clearRect(0, 0, width, height);
  
  if (data.length === 0) return;
  
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  // Масштабирование
  const maxMood = 5;
  const minMood = 1;
  const moodRange = maxMood - minMood;
  
  // Рисуем оси
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  
  // Горизонтальная линия
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();
  
  // Вертикальная линия
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();
  
  // Рисуем график настроения
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = height - padding - ((point.avg_mood - minMood) / moodRange) * chartHeight;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  
  // Рисуем точки
  ctx.fillStyle = '#6366f1';
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = height - padding - ((point.avg_mood - minMood) / moodRange) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Подписи
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  
  data.forEach((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const date = new Date(point.date);
    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    
    if (index % Math.ceil(data.length / 5) === 0 || index === data.length - 1) {
      ctx.fillText(dateStr, x, height - padding + 15);
    }
  });
}

// Утилита для экранирования HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Управление темой
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

// Экспорт данных
async function exportData() {
  try {
    const [moodsRes, journalRes] = await Promise.all([
      fetch(`${API_URL}/api/moods`, { credentials: 'include' }),
      fetch(`${API_URL}/api/journal`, { credentials: 'include' })
    ]);
    
    if (checkAuthError(moodsRes) || checkAuthError(journalRes)) return;
    
    const moods = await moodsRes.json();
    const journal = await journalRes.json();
    
    const data = {
      exportDate: new Date().toISOString(),
      user: currentUser?.username || 'unknown',
      moods: moods,
      journal: journal
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindora-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Данные экспортированы!');
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось экспортировать данные');
  }
}

// Загрузка данных при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuth();
  
  // Экспорт данных
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }
});

