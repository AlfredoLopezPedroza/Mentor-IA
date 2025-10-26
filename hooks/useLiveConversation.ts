import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audio';
import type { Message } from '../types';

let ai: GoogleGenAI | null = null;
const getAI = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const useLiveConversation = (systemInstruction: string) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const nextAudioStartTimeRef = useRef(0);
  const audioPlaybackSources = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const stopAudioPlayback = useCallback(() => {
    audioPlaybackSources.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if source already stopped
      }
    });
    audioPlaybackSources.current.clear();
    nextAudioStartTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);
  
  const startConversation = useCallback(async () => {
    if (isListening) return;

    try {
      const ai = getAI();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              
              for (let i = 0; i < l; i++) {
                // Clamp the value between -1 and 1 to prevent clipping issues.
                const s = Math.max(-1, Math.min(1, inputData[i]));
                // Convert to 16-bit integer, correctly handling the positive and negative ranges.
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }

              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                currentInputTranscriptionRef.current += text;
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.sender === 'user') {
                        return [...prev.slice(0, -1), { ...last, text: currentInputTranscriptionRef.current }];
                    }
                    return [...prev, { id: `user-${Date.now()}`, text: currentInputTranscriptionRef.current, sender: 'user', isFinal: false }];
                });
            }
            if(message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                currentOutputTranscriptionRef.current += text;
                 setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.sender === 'mentor') {
                        return [...prev.slice(0, -1), { ...last, text: currentOutputTranscriptionRef.current }];
                    }
                    return [...prev, { id: `mentor-${Date.now()}`, text: currentOutputTranscriptionRef.current, sender: 'mentor', isFinal: false }];
                });
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
                setIsSpeaking(true);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current!, 24000, 1);
                const source = outputAudioContextRef.current!.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContextRef.current!.destination);
                
                source.onended = () => {
                    audioPlaybackSources.current.delete(source);
                    if (audioPlaybackSources.current.size === 0) {
                        setIsSpeaking(false);
                    }
                };
                
                const currentTime = outputAudioContextRef.current!.currentTime;
                const startTime = Math.max(currentTime, nextAudioStartTimeRef.current);
                source.start(startTime);
                nextAudioStartTimeRef.current = startTime + audioBuffer.duration;
                audioPlaybackSources.current.add(source);
            }
            
            if(message.serverContent?.interrupted) {
                stopAudioPlayback();
            }

            if(message.serverContent?.turnComplete) {
                if (currentInputTranscriptionRef.current) {
                    setMessages(prev => prev.map(m => m.sender === 'user' && !m.isFinal ? { ...m, isFinal: true } : m));
                }
                if (currentOutputTranscriptionRef.current) {
                    setMessages(prev => prev.map(m => m.sender === 'mentor' && !m.isFinal ? { ...m, isFinal: true } : m));
                }
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setMessages(prev => [...prev, {id: `error-${Date.now()}`, text: "Hubo un error en la conexión. Intenta de nuevo.", sender: 'mentor', isFinal: true}]);
            stopConversation();
          },
          onclose: () => {
            console.log('Session closed');
          },
        },
      });

      setIsListening(true);
    } catch (error) {
      console.error('Failed to start conversation:', error);
       setMessages(prev => [...prev, {id: `error-${Date.now()}`, text: "No pude acceder a tu micrófono. Revisa los permisos y recarga la página.", sender: 'mentor', isFinal: true}]);
    }
  }, [isListening, systemInstruction, stopAudioPlayback]);

  const stopConversation = useCallback(() => {
    if (!isListening) return;

    sessionPromiseRef.current?.then((session) => session.close());
    sessionPromiseRef.current = null;
    
    stopAudioPlayback();

    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();

    setIsListening(false);
  }, [isListening, stopAudioPlayback]);

  return { isListening, isSpeaking, messages, startConversation, stopConversation, setMessages };
};