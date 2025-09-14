import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
  projectTitle?: string;
}

export default function LoadingScreen({ onComplete, projectTitle }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simple progress animation over 2 seconds
    const duration = 2000;
    const interval = 50;
    const steps = duration / interval;
    const increment = 100 / steps;

    let currentProgress = 0;
    const timer = setInterval(() => {
      currentProgress += increment;
      setProgress(Math.min(currentProgress, 100));
      
      if (currentProgress >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          onComplete();
        }, 200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50">
      <div className="text-center max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="mb-8">
          <img src="/logo.png" alt="Video Editor Logo" className="h-12 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-white">Video Copilot</h1>
          {projectTitle && (
            <p className="text-zinc-400 text-sm mt-1">Loading {projectTitle}</p>
          )}
        </div>

        {/* Simple Progress Bar */}
        <div className="w-full bg-zinc-800 rounded-full h-1 mb-4">
          <div 
            className="bg-cyan-500 h-1 rounded-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Simple Loading Text */}
        <div className="text-zinc-400 text-sm">
          Opening editor...
        </div>
      </div>
    </div>
  );
}
