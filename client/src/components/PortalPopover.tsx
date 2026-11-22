import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PortalPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose?: () => void;
  align?: 'left' | 'right';
  placement?: 'top' | 'bottom';
  className?: string;
  children: React.ReactNode;
}

/**
 * Renders any dropdown/popover directly into document.body at z-[9999]
 * clamped to the viewport so it is NEVER blocked or clipped by overflow-hidden panels.
 */
export const PortalPopover: React.FC<PortalPopoverProps> = ({
  anchorRef,
  isOpen,
  align = 'left',
  placement = 'bottom',
  className = '',
  children,
}) => {
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({
    top: 0,
    left: 0,
    ready: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const estWidth = 260;
      let left = align === 'right' ? rect.right - estWidth : rect.left;
      left = Math.max(8, Math.min(left, vw - estWidth - 8));
      let top = placement === 'top' ? rect.top - 8 : rect.bottom + 6;
      top = Math.max(8, Math.min(top, vh - 16));
      setPos({ top, left, ready: true });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, anchorRef, align, placement]);

  if (!isOpen || !pos.ready) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: placement === 'top' ? 'translateY(-100%)' : undefined,
        zIndex: 9999,
      }}
      className={className}
    >
      {children}
    </div>,
    document.body
  );
};
