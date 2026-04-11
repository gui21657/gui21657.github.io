document.addEventListener('DOMContentLoaded', function () {

  /* ========================
     HEADER: transparente → oscuro al scroll
     ======================== */
  const header = document.getElementById('mainHeader');

  const handleScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // estado inicial


  /* ========================
     MODAL DE VIDEO
     ======================== */
  const modal       = document.getElementById('videoModal');
  const videoPlayer = document.getElementById('videoPlayer');
  const closeBtn    = document.getElementById('closeModal');
  const backdrop    = modal.querySelector('.modal-backdrop');

  function openModal(src) {
    videoPlayer.src = src;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    videoPlayer.src = '';
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });


  /* ========================
     CLICK EN CARDS DE PELÍCULAS
     ======================== */
  document.querySelectorAll('.movie').forEach(card => {
    card.addEventListener('click', () => {
      const link = card.dataset.link;
      if (link) openModal(link);
    });

    // Alt text SEO
    const img = card.querySelector('img');
    if (img) img.alt = `Película: ${card.dataset.title || ''}`;
  });


  /* ========================
     BOTÓN REPRODUCIR DEL BANNER
     ======================== */
  const bannerPlayBtn = document.querySelector('.btn-play');
  if (bannerPlayBtn) {
    bannerPlayBtn.addEventListener('click', () => {
      const link = bannerPlayBtn.dataset.link;
      if (link) openModal(link);
    });
  }
  /* ========================
     CARRUSEL CON FLECHAS + BARRA DE PROGRESO (ESTILO NETFLIX)
     ======================== */
  function initCarousels() {
    document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
      const list       = wrapper.querySelector('.movies');
      const btnLeft    = wrapper.querySelector('.scroll-left');
      const btnRight   = wrapper.querySelector('.scroll-right');
      
      if (!list || !btnLeft || !btnRight) return;

      // Crear barra de progreso si no existe
      let progressContainer = wrapper.querySelector('.carousel-progress');
      if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'carousel-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressContainer.appendChild(progressBar);
        wrapper.appendChild(progressContainer);
      }
      const progressBar = progressContainer.querySelector('.progress-bar');

      // Calcular cantidad de desplazamiento (6 tarjetas)
      const getScrollAmount = () => {
        const firstCard = list.querySelector('.movie');
        if (!firstCard) return 600;
        const cardWidth = firstCard.offsetWidth;
        const gap = parseInt(getComputedStyle(list).gap) || 8;
        return (cardWidth + gap) * 6;
      };

      // Actualizar visibilidad de botones y barra de progreso
      const updateUI = () => {
        if (!btnLeft || !btnRight) return;
        
        const canScrollLeft = list.scrollLeft > 0;
        const canScrollRight = list.scrollLeft < list.scrollWidth - list.clientWidth - 1;
        
        btnLeft.style.display = canScrollLeft ? '' : 'none';
        btnRight.style.display = canScrollRight ? '' : 'none';
        
        // Actualizar barra de progreso
        if (progressBar) {
          const scrollPercent = (list.scrollLeft / (list.scrollWidth - list.clientWidth)) * 100;
          progressBar.style.width = Math.min(scrollPercent, 100) + '%';
        }
      };

      // Eventos de clic
      btnLeft.addEventListener('click', () => {
        list.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
      });
      btnRight.addEventListener('click', () => {
        list.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
      });

      // Observar cambios de tamaño
      const resizeObserver = new ResizeObserver(() => updateUI());
      resizeObserver.observe(list);
      
      // Actualizar al hacer scroll
      list.addEventListener('scroll', updateUI, { passive: true });
      
      // Actualizar al redimensionar ventana
      window.addEventListener('resize', updateUI);
      
      // Llamada inicial
      updateUI();
    });
  }

  initCarousels();
  /* ========================
   BUSCADOR
   ======================== */
  const searchBar   = document.getElementById('searchBar');
  const emptyMsg    = document.getElementById('searchEmpty');
  const searchTerm  = document.getElementById('searchTerm');
  const allCards    = document.querySelectorAll('.movie');
  const allSections = document.querySelectorAll('.carousel-section');
  const banner      = document.getElementById('mainBanner');
  const contentArea = document.querySelector('.content-area');

  let searchTimer;

  searchBar.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = this.value.trim().toLowerCase();

      if (!query) {
        allCards.forEach(c => c.classList.remove('hidden'));
        allSections.forEach(s => s.style.display = '');
        banner.style.display = '';
        contentArea.style.paddingTop = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        emptyMsg.style.display = 'none';
        return;
      }

      banner.style.display = 'none';
      contentArea.style.paddingTop = 'calc(var(--header-h) + 16px)';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      let totalVisible = 0;

      allSections.forEach(section => {
        const cards   = section.querySelectorAll('.movie');
        let sectionHits = 0;

        cards.forEach(card => {
          const title = (card.dataset.title || '').toLowerCase();
          const genre = (card.dataset.genre || '').toLowerCase();
          const match = title.includes(query) || genre.includes(query);
          card.classList.toggle('hidden', !match);
          if (match) sectionHits++;
        });

        section.style.display = sectionHits === 0 ? 'none' : '';
        totalVisible += sectionHits;
      });

      if (totalVisible === 0) {
        searchTerm.textContent = this.value.trim();
        emptyMsg.style.display = 'block';
        setTimeout(() => { emptyMsg.style.display = 'none'; }, 3000);
      } else {
        emptyMsg.style.display = 'none';
      }
    }, 200);
  });

});
