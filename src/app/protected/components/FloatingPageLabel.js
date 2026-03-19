'use client';

import { useEffect, useState } from 'react';
import styles from '../protected.module.css';

const SCROLL_HIDE_THRESHOLD_PX = 8;

export default function FloatingPageLabel({ text }) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsHidden(window.scrollY > SCROLL_HIDE_THRESHOLD_PX);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
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
