import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationStep, StudentProfile, Message } from './types';
import { useLiveConversation } from './hooks/useLiveConversation';
import { textToSpeech, generateImage } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audio';
import ChatBubble from './components/ChatBubble';
import MicButton from './components/MicButton';

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h12v12H6z"></path>
  </svg>
);

const HomeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
);


const App: React.FC = () => {
  const [step, setStep] = useState<ConversationStep>(ConversationStep.ONBOARDING);
  const [studentProfile, setStudentProfile] = useState<StudentProfile>({ name: '', grade: '1° de Secundaria', interests: '' });
  const [isMentorSpeaking, setIsMentorSpeaking] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState('Eres MentorIA, un tutor digital.');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const { isListening, isSpeaking, messages, startConversation, stopConversation, setMessages } = useLiveConversation(systemInstruction);
  
  const lastUserMessageText = messages.filter(m => m.sender === 'user' && m.isFinal).pop()?.text;

  const playMentorAudio = useCallback(async (text: string) => {
    try {
      setIsMentorSpeaking(true);
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      setMessages(prev => [...prev, { id: `mentor-${Date.now()}`, text: text, sender: 'mentor', isFinal: true }]);
      const audioB64 = await textToSpeech(text);
      const audioBytes = decode(audioB64);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
      source.onended = () => {
        setIsMentorSpeaking(false);
      };

    } catch (error) {
      console.error("Error playing mentor audio:", error);
      setIsMentorSpeaking(false);
      setMessages(prev => [...prev, { id: `error-${Date.now()}`, text: "Oops, tuve un problema con mi voz. Inténtalo de nuevo.", sender: 'mentor', isFinal: true }]);
    }
  }, [setMessages]);

  useEffect(() => {
    if (step === ConversationStep.TUTORING) {
      const newInstruction = `Eres MentorIA, un tutor digital amigable y paciente para ${studentProfile.name}, un estudiante de ${studentProfile.grade} de secundaria en México. Tu tono debe ser coloquial y entusiasta, usando jerga mexicana apropiada para un adolescente (ej. 'qué chido', 'qué onda', 'te late', 'un paro'). Tu misión es explicar conceptos académicos usando los intereses personales de ${studentProfile.name}, que son: ${studentProfile.interests}. NO des respuestas directas a las tareas. Guía a ${studentProfile.name} para que aprenda y descubra las respuestas por sí mismo. Fomenta su curiosidad. Usa analogías creativas basadas en sus intereses.`;
      setSystemInstruction(newInstruction);
      playMentorAudio(`¡Perfecto, ${studentProfile.name}! Ya con eso. Ahora sí, ¿en qué te puedo ayudar hoy? ¿Qué tema quieres que chequemos o para qué tarea necesitas un paro?`);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  
  useEffect(() => {
    if (lastUserMessageText && step === ConversationStep.TUTORING && !isListening) {
        startConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserMessageText]);

   useEffect(() => {
    // Start conversation automatically after the intro audio finishes
    if (messages.length === 1 && messages[0].sender === 'mentor' && !isMentorSpeaking && !isListening) {
      startConversation();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMentorSpeaking, messages, isListening]);
  
  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [messages]);

  const handleMicClick = () => {
    if (isListening) {
      stopConversation();
    } else if (!isMentorSpeaking) {
      startConversation();
    }
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentProfile.name && studentProfile.grade && studentProfile.interests) {
      setStep(ConversationStep.TUTORING);
    }
  };
  
  const handleEndTopic = useCallback(() => {
    stopConversation();
    playMentorAudio("¡Claro! Cuando estés listo para otro tema, solo presiona el micrófono.");
  }, [stopConversation, playMentorAudio]);

  const handleReset = useCallback(() => {
    stopConversation();
    setMessages([]);
    setStudentProfile({ name: '', grade: '1° de Secundaria', interests: '' });
    setStep(ConversationStep.ONBOARDING);
  }, [stopConversation, setMessages]);

  const handleGenerateImage = useCallback(async (messageId: string, prompt: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isGeneratingImage: true } : m));
    try {
        const imageUrl = await generateImage(prompt);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, imageUrl, isGeneratingImage: false } : m));
    } catch (error) {
        console.error("Failed to generate image:", error);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isGeneratingImage: false } : m));
        // Optionally, add an error message to the user
    }
  }, [setMessages]);


  const renderContent = () => {
    if (step === ConversationStep.ONBOARDING) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <div className="w-full max-w-lg">
            <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">¡Bienvenido a MentorIA!</h1>
            <p className="text-xl text-slate-300 mb-8">Soy tu tutor personal. Para empezar, necesito conocerte un poco.</p>
            
            <form onSubmit={handleOnboardingSubmit} className="space-y-6 text-left">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">Tu Nombre</label>
                <input 
                  type="text" 
                  id="name"
                  value={studentProfile.name}
                  onChange={(e) => setStudentProfile(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="grade" className="block text-sm font-medium text-slate-300 mb-2">Tu Grado (Secundaria)</label>
                <select 
                  id="grade"
                  value={studentProfile.grade}
                  onChange={(e) => setStudentProfile(p => ({ ...p, grade: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                >
                  <option>1° de Secundaria</option>
                  <option>2° de Secundaria</option>
                  <option>3° de Secundaria</option>
                </select>
              </div>

              <div>
                <label htmlFor="interests" className="block text-sm font-medium text-slate-300 mb-2">¿Qué te gusta? (Películas, series, videojuegos...)</label>
                <input 
                  type="text" 
                  id="interests"
                  value={studentProfile.interests}
                  onChange={(e) => setStudentProfile(p => ({ ...p, interests: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Ej: Avengers, Star Wars, Anime..."
                  required
                />
                 <p className="text-xs text-slate-500 mt-2">Así podré explicarte usando lo que más te late.</p>
              </div>

              <button 
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!studentProfile.name || !studentProfile.interests}
              >
                ¡Empezar a Aprender!
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <header className="p-4 border-b border-slate-700 text-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">MentorIA</h1>
        </header>
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} onGenerateImage={handleGenerateImage} />
          ))}
        </div>
        <footer className="p-4 flex justify-center items-center">
           <div className="relative flex items-center justify-center space-x-4">
            {isListening && (
              <button
                onClick={handleReset}
                className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-700 hover:bg-slate-600 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500"
                aria-label="Volver al inicio"
              >
                <HomeIcon className="w-8 h-8 text-white" />
              </button>
            )}
            <MicButton 
              isListening={isListening} 
              isSpeaking={isSpeaking || isMentorSpeaking}
              onClick={handleMicClick} 
            />
            {isListening && (
              <button
                onClick={handleEndTopic}
                className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-700 hover:bg-slate-600 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500"
                aria-label="Terminar tema actual"
              >
                <StopIcon className="w-8 h-8 text-white" />
              </button>
            )}
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-900 text-white">
      <div className="container mx-auto h-full max-w-4xl">
        {renderContent()}
      </div>
    </div>
  );
};

export default App;
