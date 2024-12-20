document.addEventListener('DOMContentLoaded', function () {
  // Seleccionamos todos los elementos de película
  const movies = document.querySelectorAll('.movie');
  
  // Seleccionamos el banner donde se actualizará la información
  const bannerTitle = document.querySelector('.banner h1');
  const bannerDescription = document.querySelector('.banner p');
  const bannerImage = document.querySelector('.banner');
  const modal = document.getElementById("videoModal");
  const videoPlayer = document.getElementById("videoPlayer");
  const closeModal = document.querySelector(".close");

  // Botones dentro del banner
  const playButton = document.querySelector('.btn-play');

  // Añadimos un evento de clic a cada película para actualizar el banner
  movies.forEach(movie => {
    movie.addEventListener('click', function () {
      // Obtenemos los datos de la película seleccionada
      const title = movie.getAttribute('data-title');
      const description = movie.getAttribute('data-description');
      const bannerImg = movie.getAttribute('data-banner-img');
      const videoLink = movie.getAttribute('data-link');

      // Actualizamos el contenido del banner
      bannerTitle.textContent = title;
      bannerDescription.textContent = description;
      bannerImage.style.backgroundImage = `url(${bannerImg})`;

      // Actualizamos el link del botón de "Reproducir"
      playButton.setAttribute('data-link', videoLink);

      // Ocultar episodios de otras series
      const allSeasons = document.querySelectorAll('.season-list');
      allSeasons.forEach(season => {
        season.classList.remove('active');
      });

      // Mostrar episodios de la serie seleccionada
      const seriesElement = movie.closest('.series');
      const seasonList = seriesElement.querySelector('.season-list');
      seasonList.classList.add('active');
    });
  });

  // Mostrar el modal cuando se haga clic en el botón "Reproducir"
  playButton.addEventListener('click', function () {
    const videoLink = playButton.getAttribute('data-link');
    if (videoLink) {
      videoPlayer.src = videoLink; // Cargar el video en el iframe
      modal.style.display = "block"; // Mostrar el modal
    }
  });

  // Cuando el usuario hace clic en el botón de cerrar, se cierra el modal
  closeModal.onclick = function () {
    modal.style.display = "none";
    videoPlayer.src = ""; // Detener el video
  };

  // Función para alternar la visibilidad de las temporadas
  function toggleSeasons(seriesElement) {
    const seasonList = seriesElement.querySelector('.season-list');
    seasonList.classList.toggle('active'); // Muestra u oculta la lista de temporadas
  }

  // Función para alternar la visibilidad de los episodios
  function toggleEpisodes(seasonElement) {
    const episodeList = seasonElement.querySelector('.episode-list');
    episodeList.classList.toggle('active'); // Muestra u oculta los episodios
  }

  // Función para abrir el modal del episodio
  function openModal(url) {
    window.open(url, '_blank'); // Abre el episodio en una nueva ventana o pestaña
  }

  // Cuando el usuario haga clic fuera del modal, también se cierra
  window.onclick = function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
      videoPlayer.src = ""; // Detener el video
    }
  };
});
