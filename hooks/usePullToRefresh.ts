import { useState, useCallback, useEffect } from 'react';

interface UsePullToRefreshProps {
    onRefresh: () => Promise<void>;
    pullThreshold?: number;
}

export const usePullToRefresh = ({ onRefresh, pullThreshold = 80 }: UsePullToRefreshProps) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [startY, setStartY] = useState(0);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        // Only trigger if at the top of the page
        if (window.scrollY === 0) {
            setStartY(e.touches[0].pageY);
        } else {
            setStartY(0);
        }
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (startY === 0 || isRefreshing) return;

        const currentY = e.touches[0].pageY;
        const diff = currentY - startY;

        if (diff > 0) {
            // Resistance effect
            const distance = Math.min(diff * 0.4, pullThreshold + 20);
            setPullDistance(distance);

            // Prevent scrolling when pulling
            if (diff > 10) {
                // We can't actually preventDefault on passive listeners easily in React
                // but for this implementation we just track the distance
            }
        }
    }, [startY, isRefreshing, pullThreshold]);

    const handleTouchEnd = useCallback(async () => {
        if (pullDistance >= pullThreshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(pullThreshold);
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
        setStartY(0);
    }, [pullDistance, pullThreshold, isRefreshing, onRefresh]);

    useEffect(() => {
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return { pullDistance, isRefreshing };
};
