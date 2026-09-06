import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function BottomSheet({ isOpen, onClose, title, children, maxHeight = '85vh' }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bottom-sheet"
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
        ref={sheetRef}
      >
        <div className="bottom-sheet-handle-bar">
          <div className="bottom-sheet-handle" />
        </div>

        {title && (
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">{title}</h3>
            <button
              type="button"
              className="bottom-sheet-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </div>
  );
}
