import { useEffect, useState } from 'react';

/**
 * Viewport breakpoints.
 *
 * The app is drawn phone-first, so rather than stretching a 430px column
 * across a monitor we change the *shape* of the chrome: bottom nav on touch
 * layouts, a left rail on desktop.
 */
export function useViewport() {
  const read = () => (typeof window === 'undefined' ? 1024 : window.innerWidth);
  const [width, setWidth] = useState(read);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  return {
    width,
    isPhone,
    isTablet,
    isDesktop,
    /* Phone runs edge to edge; larger screens get a deliberate, capped column. */
    frameWidth: isPhone ? null : isTablet ? 520 : 560,
    railWidth: 232,
  };
}
