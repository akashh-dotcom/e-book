import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BottomBar({ current, total, chapterTitle, onPrev, onNext }) {
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <div className="bottom-bar">
      <button onClick={onPrev} disabled={current <= 0} title="Previous chapter">
        <ChevronLeft size={18} />
      </button>

      <span className="chapter-info">
        {chapterTitle || `Chapter ${current + 1}`}
      </span>

      <span className="chapter-info">
        {current + 1} of {total}
      </span>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="chapter-info">
        {Math.round(progress)}%
      </span>

      <button onClick={onNext} disabled={current >= total - 1} title="Next chapter">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
