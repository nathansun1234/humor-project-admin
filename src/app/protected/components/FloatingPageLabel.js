'use client';

import { useEffect, useState } from 'react';
import styles from '../protected.module.css';

const SCROLL_HIDE_THRESHOLD_PX = 8;
const SCROLL_HIDE_MEDIA_QUERY = '(max-width: 1023px)';

export default function FloatingPageLabel({ text }) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const shouldHideOnScroll = () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(SCROLL_HIDE_MEDIA_QUERY).matches;

    const handleScroll = () => {
      if (!shouldHideOnScroll()) {
        setIsHidden(false);
        return;
      }

      setIsHidden(window.scrollY > SCROLL_HIDE_THRESHOLD_PX);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <p
      className={`${styles.pageLabel} ${isHidden ? styles.pageLabelHidden : styles.pageLabelVisible}`}
    >
      {text}
    </p>
  );
}
