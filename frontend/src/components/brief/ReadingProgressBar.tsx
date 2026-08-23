import { useEffect, useState } from "react";

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);

  useEffect(() => {
    const updateProgress = () => {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const canScroll = scrollableHeight > 0;

      setHasScrollableContent(canScroll);

      if (!canScroll) {
        setProgress(0);
        return;
      }

      setProgress(
        Math.min(100, Math.max(0, (window.scrollY / scrollableHeight) * 100)),
      );
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  if (!hasScrollableContent) {
    return null;
  }

  return (
    <div
      className="fixed left-0 top-0 z-50 h-[3px] w-full bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
