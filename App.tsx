import React, { useState } from 'react';
import { Layers, Rocket, PlayCircle, RefreshCw, Settings, LogOut, User as UserIcon } from 'lucide-react';
import mammoth from 'mammoth'; // Import for Word Doc extraction
import FileUpload from './components/FileUpload';
import JobDescriptionInput from './components/JobDescriptionInput';
import AgentStatus from './components/AgentStatus';
import ResultsDashboard from './components/ResultsDashboard';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { FileWithId, AgentState, UserProfile } from './types';
import { distributeFiles, fileToBase64 } from './utils/helpers';
import { analyzeResume } from './services/geminiService';

const AGENT_NAMES = ["Agent Alpha", "Agent Beta", "Agent Gamma", "Agent Delta", "Agent Epsilon"];

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [jdText, setJdText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [agents, setAgents] = useState<AgentState[]>(
    AGENT_NAMES.map((name, i) => ({
      id: i,
      name,
      status: 'idle',
      progress: 0,
      totalAssigned: 0,
      processedCount: 0,
      candidatesFound: 0
    }))
  );

  const processBatch = async (agentIndex: number, batch: FileWithId[]) => {
    // Update Agent Initialization
    setAgents(prev => prev.map(a => 
      a.id === agentIndex 
        ? { ...a, status: 'working', totalAssigned: batch.length, processedCount: 0, progress: 0 } 
        : a
    ));

    for (let i = 0; i < batch.length; i++) {
      const fileItem = batch[i];
      
      // Update Agent status: working on specific file
      setAgents(prev => prev.map(a => 
        a.id === agentIndex ? { ...a, currentFileName: fileItem.file.name } : a
      ));

      // Mark file as processing
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing' } : f));

      try {
        let finalContent = "";
        let finalMime = "";
        let isText = false;

        // 1. Check for Word Document (.docx) to extract text
        if (fileItem.file.name.toLowerCase().endsWith('.docx')) {
           const arrayBuffer = await fileItem.file.arrayBuffer();
           const result = await mammoth.extractRawText({ arrayBuffer });
           finalContent = result.value; // Extracted plain text
           finalMime = "text/plain";
           isText = true;
        } 
        // 2. Standard PDF / Image Handling
        else {
           finalContent = await fileToBase64(fileItem.file);
           
           // Determine MIME
           let mimeType = fileItem.file.type;
           const lowerName = fileItem.file.name.toLowerCase();
           if (!mimeType || mimeType === '') {
              if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
              else mimeType = 'application/pdf'; // Default fallback
           }
           finalMime = mimeType;
           isText = false;
        }
        
        // 3. Rate Limit Protection (Wait 1s between calls per agent)
        await new Promise(r => setTimeout(r, 1000)); 

        // 4. Call API with new isPlainText flag
        // Note: You must have updated geminiService.ts as well!
        const result = await analyzeResume(finalContent, finalMime, jdText, user?.apiKey, isText);

        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'completed', result } : f
        ));

        // Update Stats
        setAgents(prev => prev.map(a => {
          if (a.id !== agentIndex) return a;
          return {
            ...a,
            processedCount: a.processedCount + 1,
            progress: ((a.processedCount + 1) / a.totalAssigned) * 100,
            candidatesFound: result.matchStatus ? a.candidatesFound + 1 : a.candidatesFound
          };
        }));

      } catch (err) {
        console.error(`Agent ${agentIndex} failed on file ${fileItem.id}`, err);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error' } : f));
      }
    }

    // Agent Complete
    setAgents(prev => prev.map(a => 
      a.id === agentIndex ? { ...a, status: 'completed', currentFileName: undefined } : a
    ));
  };

  const startAnalysis = async () => {
    if (files.length === 0) {
      alert("Please upload at least one resume.");
      return;
    }

    if (!jdText.trim()) {
      alert("Please enter a Job Description.");
      return;
    }

    setIsProcessing(true);

    // 1. Distribute files
    const batches = distributeFiles(files, 5);

    // 2. Launch Agents in Parallel
    const agentPromises = batches.map((batch, index) => {
      if (batch.length === 0) {
        // Mark agent as completed immediately if no files
        setAgents(prev => prev.map(a => a.id === index ? { ...a, status: 'completed', progress: 100 } : a));
        return Promise.resolve();
      }
      return processBatch(index, batch);
    });

    await Promise.all(agentPromises);
    setIsProcessing(false);
  };

  const reset = () => {
    setFiles([]);
    setJdText('');
    setAgents(AGENT_NAMES.map((name, i) => ({
      id: i, name, status: 'idle', progress: 0, totalAssigned: 0, processedCount: 0, candidatesFound: 0
    })));
  };

  const handleLogout = () => {
    setUser(null);
    setFiles([]);
    setJdText('');
  };

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        user={user}
        onUpdateUser={setUser}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-lg shadow-lg shadow-primary-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden md:block">
              ResumeAI <span className="text-slate-500 font-normal">Multi-Agent Screener</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             {files.length > 0 && (
                <div className="px-3 py-1 bg-slate-900 rounded-full border border-slate-700 text-xs font-mono text-slate-400 hidden sm:block">
                  {files.length} Applicants
                </div>
             )}
            
            <div className="h-6 w-px bg-slate-800 mx-1"></div>

            <div className="flex items-center gap-3">
              <button 
                onClick={reset}
                disabled={isProcessing}
                className="text-slate-400 hover:text-white transition-colors disabled:opacity-50 p-2 hover:bg-slate-900 rounded-lg"
                title="Reset All"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <div className="relative group">
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-1 pr-3 rounded-full hover:bg-slate-900 border border-transparent hover:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-slate-500" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{user.name}</span>
                </button>
              </div>

              <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-slate-900 rounded-lg"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Agent Status Bar */}
        <AgentStatus agents={agents} />

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-5 h-[500px]">
            <FileUpload files={files} setFiles={setFiles} isProcessing={isProcessing} />
          </div>
          <div className="lg:col-span-7 h-[500px]">
            <JobDescriptionInput jdText={jdText} setJdText={setJdText} isProcessing={isProcessing} />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center mb-12">
          {!isProcessing ? (
             <button
              onClick={startAnalysis}
              disabled={files.length === 0}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Rocket className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              <span>Deploy 5 AI Agents</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 px-8 py-4 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
              <PlayCircle className="w-5 h-5 animate-spin text-primary-500" />
              <span className="font-medium">Agents are processing parallel tasks...</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        <ResultsDashboard files={files} />
        
      </main>
    </div>
  );
}

export default App;
