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

// Управление вкладками
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    
    // Обновляем активные вкладки
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`${targetTab}-form`).classList.add('active');
    
    // Очищаем ошибки
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-error').classList.remove('show');
    document.getElementById('register-error').textContent = '';
    document.getElementById('register-error').classList.remove('show');
  });
});

// Форма входа
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const errorDiv = document.getElementById('login-error');
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');
  
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    errorDiv.textContent = 'Заполните все поля';
    errorDiv.classList.add('show');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Успешный вход - перенаправляем на главную страницу
      window.location.href = '/';
    } else {
      errorDiv.textContent = data.error || 'Ошибка входа';
      errorDiv.classList.add('show');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    errorDiv.textContent = 'Не удалось подключиться к серверу';
    errorDiv.classList.add('show');
  }
});

// Форма регистрации
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const errorDiv = document.getElementById('register-error');
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');
  
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;
  
  // Валидация
  if (!username || !email || !password || !passwordConfirm) {
    errorDiv.textContent = 'Заполните все поля';
    errorDiv.classList.add('show');
    return;
  }
  
  if (username.length < 3) {
    errorDiv.textContent = 'Имя пользователя должно содержать минимум 3 символа';
    errorDiv.classList.add('show');
    return;
  }
  
  if (password.length < 6) {
    errorDiv.textContent = 'Пароль должен содержать минимум 6 символов';
    errorDiv.classList.add('show');
    return;
  }
  
  if (password !== passwordConfirm) {
    errorDiv.textContent = 'Пароли не совпадают';
    errorDiv.classList.add('show');
    return;
  }
  
  // Проверка email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorDiv.textContent = 'Введите корректный email';
    errorDiv.classList.add('show');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Успешная регистрация - перенаправляем на главную страницу
      window.location.href = '/';
    } else {
      errorDiv.textContent = data.error || 'Ошибка регистрации';
      errorDiv.classList.add('show');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    errorDiv.textContent = 'Не удалось подключиться к серверу';
    errorDiv.classList.add('show');
  }
});


