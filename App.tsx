import React, { useState, useEffect } from 'react';
import { Layers, Rocket, PlayCircle, RefreshCw } from 'lucide-react';
import FileUpload from './components/FileUpload';
import JobDescriptionInput from './components/JobDescriptionInput';
import AgentStatus from './components/AgentStatus';
import ResultsDashboard from './components/ResultsDashboard';
import { FileWithId, AgentState } from './types';
import { distributeFiles, fileToBase64 } from './utils/helpers';
import { analyzeResume } from './services/geminiService';

const AGENT_NAMES = ["Agent Alpha", "Agent Beta", "Agent Gamma", "Agent Delta", "Agent Epsilon"];

function App() {
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
        const base64 = await fileToBase64(fileItem.file);
        // Default to pdf mime type for robustness in this demo environment, unless it's explicitly docx
        let mimeType = fileItem.file.type;
        if (!mimeType) mimeType = "application/pdf"; // Fallback
        
        // ARTIFICIAL DELAY to simulate "Reading" and avoid rate limits on Free Tier
        await new Promise(r => setTimeout(r, 1500)); 

        const result = await analyzeResume(base64, mimeType, jdText);

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
    if (files.length === 0 || !jdText.trim()) {
      alert("Please upload resumes and provide a Job Description.");
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-lg shadow-lg shadow-primary-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              ResumeAI <span className="text-slate-500 font-normal">Multi-Agent Screener</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {files.length > 0 && (
                <div className="px-3 py-1 bg-slate-900 rounded-full border border-slate-700 text-xs font-mono text-slate-400">
                  {files.length} Applicants
                </div>
             )}
            <button 
              onClick={reset}
              disabled={isProcessing}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
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
              disabled={files.length === 0 || !jdText}
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
