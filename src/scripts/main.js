// Main JavaScript file for Fluxzero website
// Essential functionality for Bootstrap components and smooth interactions

// Initialize all tooltips
document.addEventListener('DOMContentLoaded', function() {
  // Page loading functionality
  const preloader = document.querySelector('.page-loading');
  if (preloader) {
    window.addEventListener('load', function() {
      preloader.classList.remove('active');
      setTimeout(function() {
        preloader.remove();
      }, 1000);
    });
  }

  // Smooth scroll for anchor links
  const scrollLinks = document.querySelectorAll('a[href^="#"]');
  scrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Back to top button functionality
  const backToTop = document.querySelector('.btn-scroll-top');
  if (backToTop) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 500) {
        backToTop.classList.add('show');
      } else {
        backToTop.classList.remove('show');
      }
    });

    backToTop.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // Initialize Swiper carousels
  if (typeof Swiper !== 'undefined') {
    const swipers = document.querySelectorAll('.swiper[data-swiper-options]');
    swipers.forEach(swiperEl => {
      const options = JSON.parse(swiperEl.getAttribute('data-swiper-options'));
      new Swiper(swiperEl, options);
    });
  }

  // Parallax functionality
  if (typeof Rellax !== 'undefined') {
    const parallaxElements = document.querySelectorAll('.parallax');
    parallaxElements.forEach(element => {
      new Rellax(element);
    });
  }
});

// Export for potential module usage
export default {
  init() {
    console.log('Fluxzero website initialized');
  }
};