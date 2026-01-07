import React, { useState } from 'react';
import { Layers, Rocket, PlayCircle, RefreshCw, Settings, LogOut, User as UserIcon, Clock, Save } from 'lucide-react';
import mammoth from 'mammoth';
import FileUpload from './components/FileUpload';
import JobDescriptionInput from './components/JobDescriptionInput';
import AgentStatus from './components/AgentStatus';
import ResultsDashboard from './components/ResultsDashboard';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import HistoryModal from './components/HistoryModal';
import { FileWithId, AgentState, UserProfile } from './types';
import { distributeFiles, fileToBase64 } from './utils/helpers';
import { analyzeResume } from './services/geminiService';

const AGENT_NAMES = ["Agent Alpha", "Agent Beta", "Agent Gamma", "Agent Delta", "Agent Epsilon"];

function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [jdText, setJdText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [agents, setAgents] = useState<AgentState[]>(
    AGENT_NAMES.map((name, i) => ({
      id: i, name, status: 'idle', progress: 0, totalAssigned: 0, processedCount: 0, candidatesFound: 0
    }))
  );

  const processBatch = async (agentIndex: number, batch: FileWithId[]) => {
    console.log(`[Agent ${agentIndex}] Starting batch processing with ${batch.length} resumes`);
    
    setAgents(prev => prev.map(a => a.id === agentIndex ? { ...a, status: 'working', totalAssigned: batch.length, processedCount: 0, progress: 0 } : a));
    
    for (let i = 0; i < batch.length; i++) {
      const fileItem = batch[i];
      console.log(`[Agent ${agentIndex}] Processing file ${i + 1}/${batch.length}: ${fileItem.file.name}`);
      
      setAgents(prev => prev.map(a => a.id === agentIndex ? { ...a, currentFileName: fileItem.file.name } : a));
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing' } : f));
      
      try {
        let finalContent = "";
        let finalMime = "";
        let isText = false;
        
        // EXTRACT CONTENT
        if (fileItem.file.name.toLowerCase().endsWith('.docx')) {
           console.log(`[Agent ${agentIndex}] Extracting text from DOCX: ${fileItem.file.name}`);
           const arrayBuffer = await fileItem.file.arrayBuffer();
           const result = await mammoth.extractRawText({ arrayBuffer });
           finalContent = result.value;
           finalMime = "text/plain";
           isText = true;
           console.log(`[Agent ${agentIndex}] Extracted ${finalContent.length} characters from DOCX`);
        } else {
           console.log(`[Agent ${agentIndex}] Converting PDF/DOC to base64: ${fileItem.file.name}`);
           finalContent = await fileToBase64(fileItem.file);
           let mimeType = fileItem.file.type;
           if (!mimeType) mimeType = 'application/pdf';
           finalMime = mimeType;
           isText = false;
           console.log(`[Agent ${agentIndex}] Base64 encoded file (${finalContent.length} chars)`);
        }
        
        // DELAY (helps with rate limiting)
        await new Promise(r => setTimeout(r, 1000)); 
        
        // ANALYZE RESUME
        console.log(`[Agent ${agentIndex}] Sending to Gemini API for analysis...`);
        const result = await analyzeResume(finalContent, finalMime, jdText, user?.apiKey, isText);
        
        // LOG ANALYSIS RESULT
        console.log(`[Agent ${agentIndex}] Analysis complete for ${fileItem.file.name}:`, {
          candidateName: result.candidateName,
          matchStatus: result.matchStatus,
          matchScore: result.matchScore,
          mandatoryFound: result.mandatorySkillsFound.length,
          mandatoryMissing: result.mandatorySkillsMissing.length,
          reason: result.reason
        });
        
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'completed', result } : f));
        setAgents(prev => prev.map(a => {
          if (a.id !== agentIndex) return a;
          const newCandidatesFound = result.matchStatus ? a.candidatesFound + 1 : a.candidatesFound;
          console.log(`[Agent ${agentIndex}] Candidates found so far: ${newCandidatesFound}`);
          return {
            ...a,
            processedCount: a.processedCount + 1,
            progress: ((a.processedCount + 1) / a.totalAssigned) * 100,
            candidatesFound: newCandidatesFound
          };
        }));
      } catch (err) {
        console.error(`[Agent ${agentIndex}] ERROR processing file ${fileItem.id}:`, err);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error' } : f));
        
        // Add error result
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          result: {
            candidateName: "Error",
            matchStatus: false,
            matchScore: 0,
            reason: `Error: ${err instanceof Error ? err.message : String(err)}`,
            educationMatch: "None",
            nonMandatorySkillsCount: 0,
            mandatorySkillsFound: [],
            mandatorySkillsMissing: [],
            optionalSkillsFound: [],
            isAiGenerated: false,
            aiGenerationReasoning: "Error"
          }
        } : f));
      }
    }
    
    console.log(`[Agent ${agentIndex}] Batch processing complete. Total qualified: ${agents[agentIndex].candidatesFound}`);
    setAgents(prev => prev.map(a => a.id === agentIndex ? { ...a, status: 'completed', currentFileName: undefined } : a));
  };

  const startAnalysis = async () => {
    if (files.length === 0) { alert("Please upload at least one resume."); return; }
    if (!jdText.trim()) { alert("Please enter a Job Description."); return; }
    
    console.log("=== ANALYSIS STARTED ===");
    console.log(`Total files: ${files.length}`);
    console.log(`Job Description length: ${jdText.length} chars`);
    console.log(`Using API Key: ${user?.apiKey ? 'Custom' : 'System'}`);
    console.log("========================");
    
    setIsProcessing(true);
    const batches = distributeFiles(files, 5);
    
    console.log(`Distributing ${files.length} files across 5 agents:`, batches.map((b, i) => `Agent ${i}: ${b.length} files`));
    
    const agentPromises = batches.map((batch, index) => {
      if (batch.length === 0) {
        console.log(`[Agent ${index}] No files assigned`);
        setAgents(prev => prev.map(a => a.id === index ? { ...a, status: 'completed', progress: 100 } : a));
        return Promise.resolve();
      }
      return processBatch(index, batch);
    });
    
    await Promise.all(agentPromises);
    
    const qualifiedCount = files.filter(f => f.result?.matchStatus).length;
    console.log("=== ANALYSIS COMPLETE ===");
    console.log(`Total qualified: ${qualifiedCount}/${files.length}`);
    console.log("========================");
    
    setIsProcessing(false);
  };

  const reset = () => {
    console.log("Resetting application state");
    setFiles([]);
    setJdText('');
    setAgents(AGENT_NAMES.map((name, i) => ({
      id: i, name, status: 'idle', progress: 0, totalAssigned: 0, processedCount: 0, candidatesFound: 0
    })));
  };

  const handleLogout = () => { 
    console.log("User logged out");
    setUser(null); 
    setFiles([]); 
    setJdText(''); 
  };

  const handleSaveToHistory = async () => {
    if (!user) return;
    const title = prompt("Enter a name for this scan (e.g. 'Senior React Dev'):");
    if (!title) return;
    
    const serializableResults = files.map(f => ({
      id: f.id,
      fileName: f.file.name,
      fileSize: f.file.size,
      status: f.status,
      result: f.result
    }));
    const stats = {
      total: files.length,
      qualified: files.filter(f => f.result?.matchStatus).length
    };
    
    console.log(`Saving scan "${title}" with ${stats.qualified} qualified candidates`);
    
    try {
      const res = await fetch('/api/save-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title, jobDescription: jdText, results: serializableResults, stats })
      });
      if (res.ok) {
        console.log("Scan saved successfully");
        alert("Scan saved to history successfully!");
      } else {
        console.error("Failed to save scan:", res.statusText);
        alert("Failed to save history.");
      }
    } catch (err) {
      console.error("Error saving history:", err);
      alert("Failed to save history.");
    }
  };

  const handleLoadScan = async (scanId: number) => {
    try {
      console.log(`Loading scan ${scanId}`);
      const res = await fetch(`/api/scan/${scanId}`);
      const data = await res.json();
      setJdText(data.job_description);
      const reconstructedFiles: FileWithId[] = data.results.map((r: any) => ({
        id: r.id,
        file: { name: r.fileName, size: r.fileSize, type: 'application/pdf' } as File,
        status: r.status,
        result: r.result
      }));
      setFiles(reconstructedFiles);
      setIsHistoryOpen(false);
      setAgents(AGENT_NAMES.map((name, i) => ({
        id: i, name, status: 'completed', progress: 100, totalAssigned: 0, processedCount: 0, candidatesFound: 0
      })));
      console.log(`Loaded scan with ${reconstructedFiles.length} results`);
    } catch (err) {
      console.error("Error loading scan:", err);
      alert("Error loading scan details.");
    }
  };

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} onUpdateUser={setUser} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} userId={user.id} onLoadScan={handleLoadScan} />
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-2 rounded-lg shadow-lg shadow-primary-500/20"><Layers className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden md:block">ResumeAI</h1>
          </div>
          <div className="flex items-center gap-4">
             {files.length > 0 && <div className="px-3 py-1 bg-slate-900 rounded-full border border-slate-700 text-xs font-mono text-slate-400 hidden sm:block">{files.length} Applicants</div>}
            <div className="h-6 w-px bg-slate-800 mx-1"></div>
            <div className="flex items-center gap-3">
              <button onClick={reset} disabled={isProcessing} className="text-slate-400 hover:text-white p-2 hover:bg-slate-900 rounded-lg" title="Reset All"><RefreshCw className="w-5 h-5" /></button>
              <button onClick={() => setIsHistoryOpen(true)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-900 rounded-lg" title="History"><Clock className="w-5 h-5" /></button>
              <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 text-slate-300 hover:text-white p-1 pr-3 rounded-full hover:bg-slate-900 border border-transparent hover:border-slate-800">
                <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                   <div className="w-full h-full flex items-center justify-center"><UserIcon className="w-4 h-4 text-slate-500" /></div>
                </div>
                <span className="text-sm font-medium hidden sm:block">{user.name}</span>
              </button>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 p-2 hover:bg-slate-900 rounded-lg" title="Sign Out"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AgentStatus agents={agents} />
        {files.some(f => f.status === 'completed') && (
           <div className="flex justify-end mb-4">
             <button onClick={handleSaveToHistory} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg shadow-lg shadow-green-500/20 transition-all">
               <Save className="w-4 h-4" /> Save Results to History
             </button>
           </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-5 h-[500px]"><FileUpload files={files} setFiles={setFiles} isProcessing={isProcessing} /></div>
          <div className="lg:col-span-7 h-[500px]"><JobDescriptionInput jdText={jdText} setJdText={setJdText} isProcessing={isProcessing} /></div>
        </div>
        <div className="flex justify-center mb-12">
          {!isProcessing ? (
             <button onClick={startAnalysis} disabled={files.length === 0} className="group relative inline-flex items-center gap-3 px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-full transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              <Rocket className="w-5 h-5 group-hover:-translate-y-1 transition-transform" /> <span>Deploy 5 AI Agents</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 px-8 py-4 bg-slate-800 text-slate-300 rounded-full border border-slate-700"><PlayCircle className="w-5 h-5 animate-spin text-primary-500" /><span className="font-medium">Agents are processing parallel tasks...</span></div>
          )}
        </div>
        <ResultsDashboard files={files} user={user} />
      </main>
    </div>
  );
}

export default App;

