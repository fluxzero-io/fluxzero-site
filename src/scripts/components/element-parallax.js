/**
 * Element parallax effect
 */

import Rellax from 'rellax';

export default (() => {
  const el = document.querySelector('.rellax');

  if (el === null) return;

  new Rellax('.rellax', {
    horizontal: true,
  });
})()
