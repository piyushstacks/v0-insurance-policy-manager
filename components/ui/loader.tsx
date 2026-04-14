'use client';

/**
 * Global Loader Component — Pure CSS, zero dependencies
 * Cycling words animation matching user's reference component
 */

interface LoaderProps {
  words?: string[];
  label?: string;
}

export function Loader({ words, label = 'loading' }: LoaderProps) {
  const cyclingWords = words ?? ['policies', 'customers', 'reports', 'vaults', 'policies'];

  return (
    <>
      <div className="pv-loader-card">
        <div className="pv-loader">
          <p>{label}</p>
          <div className="pv-words">
            {cyclingWords.map((word, i) => (
              <span key={i} className="pv-word">{word}</span>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        .pv-loader-card {
          --bg-color: #f8fafc;
          background-color: var(--bg-color);
          padding: 1rem 2rem;
          border-radius: 1.25rem;
        }
        .pv-loader {
          color: rgb(124, 124, 124);
          font-family: inherit;
          font-weight: 500;
          font-size: 25px;
          box-sizing: content-box;
          height: 40px;
          padding: 10px 10px;
          display: flex;
          border-radius: 8px;
        }
        .pv-words {
          overflow: hidden;
          position: relative;
        }
        .pv-words::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            var(--bg-color) 10%,
            transparent 30%,
            transparent 70%,
            var(--bg-color) 90%
          );
          z-index: 20;
        }
        .pv-word {
          display: block;
          height: 100%;
          padding-left: 6px;
          color: #3b82f6;
          animation: pv_spin 4s infinite;
        }
        @keyframes pv_spin {
          10% { transform: translateY(-102%); }
          25% { transform: translateY(-100%); }
          35% { transform: translateY(-202%); }
          50% { transform: translateY(-200%); }
          60% { transform: translateY(-302%); }
          75% { transform: translateY(-300%); }
          85% { transform: translateY(-402%); }
          100% { transform: translateY(-400%); }
        }
      `}</style>
    </>
  );
}

/** Full-page centered loader */
export function PageLoader({ words, label }: { words?: string[]; label?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
      <Loader words={words} label={label} />
    </div>
  );
}
