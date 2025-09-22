// Client-side vendor script imports
// These run only in the browser, not during SSR

// CSS imports
import 'boxicons/css/boxicons.min.css';
import 'swiper/css/bundle';
import 'swiper/css/pagination';

// JS imports - only run in browser
if (typeof window !== 'undefined') {
  // Dynamic imports to ensure they only run client-side
  import('bootstrap/dist/js/bootstrap.bundle.min.js');

  // Initialize Jarallax (if any .jarallax elements exist)
  import('jarallax/dist/jarallax.min.js').then(() => {
    if (typeof jarallax !== 'undefined') {
      jarallax(document.querySelectorAll('.jarallax'));
    }
  });
}