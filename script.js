document.addEventListener('DOMContentLoaded', function () {
  // **Cambio de color del header al hacer scroll**
  const header = document.querySelector('.header');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) { // Si el scroll supera 50px
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // **Funcionalidad de películas y modal**
  const movies = document.querySelectorAll('.movie');
  const bannerTitle = document.querySelector('.banner h1');
  const bannerDescription = document.querySelector('.banner p');
  const bannerImage = document.querySelector('.banner');
  const modal = document.getElementById("videoModal");
  const videoPlayer = document.getElementById("videoPlayer");
  const closeModal = document.querySelector(".close");

  const playButton = document.querySelector('.btn-play');

    // Función para activar el video en pantalla completa
    function requestFullScreen(elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) { // Firefox
        elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) { // Chrome, Safari and Opera
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { // IE/Edge
        elem.msRequestFullscreen();
      }
    }

    // Mostrar el video y ponerlo en pantalla completa
    movies.forEach(movie => {
      movie.addEventListener("click", () => {
        const videoLink = movie.getAttribute("data-link");
        videoPlayer.src = videoLink; // Asigna el enlace al iframe
        modal.style.display = "flex"; // Muestra el modal

        // Solicitar pantalla completa
        requestFullScreen(videoPlayer);
      });
    });

  // Mostrar el modal cuando se haga clic en el botón "Reproducir"
  playButton.addEventListener('click', function () {
    const videoLink = playButton.getAttribute('data-link');
    if (videoLink) {
      videoPlayer.src = videoLink;
      modal.style.display = "block";
    }
  });

  // Cuando el usuario hace clic en el botón de cerrar, se cierra el modal
  closeModal.onclick = function () {
    modal.style.display = "none";
    videoPlayer.src = ""; // Detener el video
  };

  // Cuando el usuario haga clic fuera del modal, también se cierra
  window.onclick = function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
      videoPlayer.src = ""; // Detener el video
    }
  };
});
