/**
 * Anchor smooth scrolling
 */

import SmoothScroll from 'smooth-scroll/dist/smooth-scroll.polyfills.min.js';

export default (() => {
  const selector = '[data-scroll]';
  const fixedHeader = '[data-scroll-header]';

  new SmoothScroll(selector, {
    speed: 800,
    speedAsDuration: true,
    offset: (anchor, toggle) => {
      return toggle.dataset.scrollOffset || 40;
    },
    header: fixedHeader,
    updateURL: false,
  });
})()
