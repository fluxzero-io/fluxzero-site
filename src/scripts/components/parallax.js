/**
 * Mouse move parallax effect
 */

import Parallax from 'parallax-js';

export default (() => {
  const elements = document.querySelectorAll('.parallax');

  for (let i = 0; i < elements.length; i++) {
    new Parallax(elements[i]);
  }
})()
