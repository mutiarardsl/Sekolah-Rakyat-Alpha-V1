/**
 * SR MVP — useBreakpoint
 * Hook terpusat untuk deteksi ukuran layar.
 * Dipakai di seluruh View agar perilaku responsif konsisten.
 *
 * Breakpoints:
 *   mobile  : < 480px
 *   tablet  : 480–767px
 *   desktop : >= 768px
 */
import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const getState = () => {
    const w = window.innerWidth;
    return {
      isMobile:  w < 480,
      isTablet:  w >= 480 && w < 768,
      isDesktop: w >= 768,
      width: w,
    };
  };

  const [bp, setBp] = useState(getState);

  useEffect(() => {
    let raf;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBp(getState()));
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return bp;
}
