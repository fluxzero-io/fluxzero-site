/**
 * Gallery like styled lightbox component for presenting various types of media
 */

import lightGallery from 'lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import lgFullscreen from 'lightgallery/plugins/fullscreen';
import lgVideo from 'lightgallery/plugins/video';
import lgThumbnail from 'lightgallery/plugins/thumbnail';

export default (() => {
  const gallery = document.querySelectorAll('.gallery');

  if (gallery.length) {
    for (let i = 0; i < gallery.length; i++) {
      const thumbnails = gallery[i].dataset.thumbnails ? true : false;
      const video = gallery[i].dataset.video ? true : false;
      const defaultPlugins = [lgZoom, lgFullscreen];
      const videoPlugin = video ? [lgVideo] : [];
      const thumbnailPlugin = thumbnails ? [lgThumbnail] : [];
      const plugins = [...defaultPlugins, ...videoPlugin, ...thumbnailPlugin];

      lightGallery(gallery[i], {
        selector: '.gallery-item',
        plugins: plugins,
        licenseKey: 'D4194FDD-48924833-A54AECA3-D6F8E646',
        download: false,
        autoplayVideoOnSlide: true,
        zoomFromOrigin: false,
        youtubePlayerParams: {
          modestbranding: 1,
          showinfo: 0,
          rel: 0,
        },
        vimeoPlayerParams: {
          byline: 0,
          portrait: 0,
          color: '6366f1',
        },
      });
    }
  }
})()
