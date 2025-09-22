// Client-side vendor script imports
// These run only in the browser, not during SSR

// CSS imports
import 'boxicons/css/boxicons.min.css';
import 'swiper/css/bundle';

// JS imports - only run in browser
if (typeof window !== 'undefined') {
  // Dynamic imports to ensure they only run client-side
  import('bootstrap/dist/js/bootstrap.bundle.min.js');

  // Initialize smooth scroll
  import('smooth-scroll/dist/smooth-scroll.polyfills.min.js').then(() => {
    if (typeof SmoothScroll !== 'undefined') {
      new SmoothScroll('a[data-scroll]', {
        speed: 600,
        speedAsDuration: true,
        offset: 80
      });
    }
  });

  import('jarallax/dist/jarallax.min.js');
  import('rellax/rellax.min.js');
  import('swiper/bundle');
  import('lightgallery');
  import('lightgallery/plugins/fullscreen');
  import('lightgallery/plugins/zoom');
  import('lightgallery/plugins/video');
}