(() => {
  const hero = document.querySelector('.login-visual-photo');
  const parts = window.__SALAMAT_HERO_PARTS__;
  if (!hero || !Array.isArray(parts) || parts.length !== 6) return;

  const fallback = hero.src;
  const highResolutionSource = `data:image/avif;base64,${parts.join('')}`;
  const preloader = new Image();

  preloader.onload = () => {
    hero.src = highResolutionSource;
    hero.removeAttribute('data-pending');
    hero.classList.add('is-ready');
    delete window.__SALAMAT_HERO_PARTS__;
  };

  preloader.onerror = () => {
    hero.src = fallback;
    hero.removeAttribute('data-pending');
    delete window.__SALAMAT_HERO_PARTS__;
  };

  preloader.src = highResolutionSource;
})();
