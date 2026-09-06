import { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const THRESHOLD = 65;

  function handleTouchStart(e) {
    if (window.scrollY <= 5 && !refreshing) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }

  function handleTouchMove(e) {
    if (!isDragging.current || refreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;
    if (delta > 0 && window.scrollY <= 5) {
      const distance = Math.min(delta * 0.45, 100);
      setPullDistance(distance);
      setPulling(true);
    }
  }

  async function handleTouchEnd() {
    if (!isDragging.current || refreshing) return;
    isDragging.current = false;
    if (pullDistance >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setRefreshing(false);
          setPullDistance(0);
          setPulling(false);
        }, 400);
      }
    } else {
      setPullDistance(0);
      setPulling(false);
    }
  }

  return (
    <div
      className="pull-to-refresh-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pulling || refreshing) && (
        <div
          className="pull-to-refresh-indicator"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / THRESHOLD }}
        >
          <div className={`pull-to-refresh-spinner ${refreshing ? 'spinning' : ''}`}>
            <RefreshCw size={20} />
          </div>
          <span className="pull-to-refresh-text">
            {refreshing ? 'Refreshing...' : pullDistance >= THRESHOLD ? 'Release to refresh' : 'Pull down to refresh'}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
