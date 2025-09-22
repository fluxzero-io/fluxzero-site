/**
 * Swiper initialization
 */

import { Swiper } from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

export default (() => {
  // Initialize Swiper
  document.addEventListener('DOMContentLoaded', function () {
    const swiperElements = document.querySelectorAll('.swiper');

    swiperElements.forEach(swiperEl => {
      if (swiperEl) {
        const swiperOptions = JSON.parse(swiperEl.getAttribute('data-swiper-options') || '{}');
        new Swiper(swiperEl, {
          ...swiperOptions,
          modules: [Navigation, Pagination],
        });
      }
    });
  });
})()