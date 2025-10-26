import React from 'react';
import type { Message } from '../types';

interface ChatBubbleProps {
  message: Message;
  onGenerateImage: (messageId: string, text: string) => void;
}

const ImageIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </svg>
);

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onGenerateImage }) => {
  const isUser = message.sender === 'user';
  const bubbleClasses = isUser
    ? 'bg-cyan-600 self-end rounded-br-none'
    : 'bg-slate-700 self-start rounded-bl-none';

  const containerClasses = isUser ? 'justify-end' : 'justify-start';

  return (
    <div className={`w-full flex ${containerClasses} my-2`}>
      <div
        className={`relative max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl shadow-md transition-opacity duration-300 ${bubbleClasses} ${!message.isFinal ? 'opacity-70' : 'opacity-100'}`}
      >
        <p className="text-white text-base break-words">{message.text}</p>
        
        {message.sender === 'mentor' && !message.imageUrl && !message.isGeneratingImage && (
             <button 
                onClick={() => onGenerateImage(message.id, message.text)}
                className="absolute top-1 right-1 translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-fuchsia-500 rounded-full flex items-center justify-center hover:bg-fuchsia-600 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
                aria-label="Generar imagen para esta explicación"
            >
                <ImageIcon className="w-4 h-4 text-white" />
            </button>
        )}
        
        {message.isGeneratingImage && (
            <div className="mt-2 text-xs text-slate-400 italic">Generando imagen...</div>
        )}

        {message.imageUrl && (
            <div className="mt-3">
                <img src={message.imageUrl} alt="Visualización del concepto" className="rounded-lg w-full" />
            </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
