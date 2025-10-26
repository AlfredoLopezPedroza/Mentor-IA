import React from 'react';

interface MicButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  onClick: () => void;
}

const MicIcon: React.FC<{className?: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
    <path d="M17 11h-1c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92z"></path>
  </svg>
);


const MicButton: React.FC<MicButtonProps> = ({ isListening, isSpeaking, onClick }) => {
  const getButtonClasses = () => {
    let base = "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900";
    if (isListening) {
      return `${base} bg-red-600 hover:bg-red-700 focus:ring-red-500`;
    }
    return `${base} bg-cyan-500 hover:bg-cyan-600 focus:ring-cyan-400`;
  };
  
  const getPulseClasses = () => {
    let base = "absolute inset-0 rounded-full";
    if (isSpeaking) {
      return `${base} bg-blue-500/50 animate-pulse`;
    }
    if (isListening) {
      return `${base} bg-red-500/50 animate-pulse`;
    }
    return "";
  };


  return (
    <button onClick={onClick} className={getButtonClasses()}>
      <div className={getPulseClasses()} style={{ animationDuration: '1.5s' }}></div>
      <MicIcon className="w-8 h-8 text-white z-10" />
    </button>
  );
};

export default MicButton;