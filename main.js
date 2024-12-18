// Variables globales
const loginButton = document.querySelector('.login-btn');
const modalLogin = document.getElementById('login-modal');
const closeButtons = document.querySelectorAll('.close-btn');
const loginForm = document.getElementById('login-form');
const perfilLink = document.getElementById('perfil-link');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

let users = []; // Usuarios registrados

// Mostrar modal de inicio de sesión
loginButton.addEventListener('click', () => {
  modalLogin.style.display = 'block';
});

// Cerrar modales
closeButtons.forEach(button => {
  button.addEventListener('click', () => {
    button.closest('.modal').style.display = 'none';
  });
});

// Iniciar sesión
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const username = usernameInput.value;
  const password = passwordInput.value;

  const user = users.find((u) => u.username === username && u.password === password);

  if (user) {
    alert('Inicio de sesión exitoso');
    modalLogin.style.display = 'none';
    perfilLink.classList.remove('hidden');
    window.location.href = '#perfil'; // Redirigir a la sección de perfil
  } else {
    alert('Usuario o contraseña incorrectos');
  }
});
document.getElementById('perfil').classList.remove('hidden');
document.getElementById('perfil-link').classList.remove('hidden');
