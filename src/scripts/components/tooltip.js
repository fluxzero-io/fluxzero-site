/**
 * Tooltip
 */

import { Tooltip } from 'bootstrap';

export default (() => {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );

  const tooltipList = tooltipTriggerList.map(
    (tooltipTriggerEl) =>
      new Tooltip(tooltipTriggerEl, { trigger: 'hover' })
  );
})()
