import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import mammoth from 'mammoth';
import { FileWithId, UserProfile } from '../types';
import { startChatWithResume } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';

interface CandidateChatModalProps {
  candidate: FileWithId | null;
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const CandidateChatModal: React.FC<CandidateChatModalProps> = ({ candidate, isOpen, onClose, user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // We use a ref to store the chat session instance so it persists between renders
  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize Chat when modal opens
  useEffect(() => {
    if (isOpen && candidate) {
      initChat();
    } else {
      setMessages([]);
      chatSessionRef.current = null;
    }
  }, [isOpen, candidate]);

  const initChat = async () => {
    if (!candidate) return;
    setIsInitializing(true);
    try {
      let content = "";
      let mime = candidate.file.type;
      let isText = false;

      // Extract Content (Logic similar to App.tsx)
      if (candidate.file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await candidate.file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        content = res.value;
        mime = "text/plain";
        isText = true;
      } else {
        content = await fileToBase64(candidate.file);
        if (!mime) mime = "application/pdf";
        isText = false;
      }

      // Initialize Gemini Chat
      const chat = await startChatWithResume(content, mime, isText, user?.apiKey);
      chatSessionRef.current = chat;
      
      setMessages([{ role: 'model', text: `Hi! I've analyzed ${candidate.file.name}. What would you like to know about this candidate?` }]);

    } catch (error) {
      console.error(error);
      setMessages([{ role: 'model', text: "Error: Could not read resume content. Please try again." }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage(userMsg);
      const responseText = result.response.text();
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try asking again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-[600px] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Chat with Candidate</h3>
              <p className="text-xs text-slate-400">{candidate.result?.candidateName || "Unknown Candidate"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/30">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              <p>Reading Resume & Initializing AI...</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary-400" />
                  </div>
                )}
                <div className={`p-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-primary-600 text-white rounded-br-none' 
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}>
                  {m.text}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
             <div className="flex gap-3 justify-start">
               <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-400" />
               </div>
               <div className="bg-slate-800 p-3 rounded-2xl rounded-bl-none border border-slate-700">
                 <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about experience, gaps, or skills..."
              disabled={isLoading || isInitializing}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder-slate-600"
            />
            <button
              type="submit"
              disabled={isLoading || isInitializing || !input.trim()}
              className="px-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default CandidateChatModal;
