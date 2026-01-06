import React from 'react';
import { Bot, CheckCircle2, Loader2, BrainCircuit } from 'lucide-react';
import { AgentState } from '../types';

interface AgentStatusProps {
  agents: AgentState[];
}

const AgentStatus: React.FC<AgentStatusProps> = ({ agents }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
      {agents.map((agent) => (
        <div 
          key={agent.id} 
          className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ${
            agent.status === 'working' 
              ? 'bg-slate-800 border-primary-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : agent.status === 'completed'
              ? 'bg-slate-900 border-green-500/30'
              : 'bg-slate-900 border-slate-800 opacity-70'
          }`}
        >
          {/* Background Pulse Animation for working agents */}
          {agent.status === 'working' && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-500/5 to-transparent animate-pulse-slow" />
          )}

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${agent.status === 'working' ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-800 text-slate-500'}`}>
                  {agent.status === 'working' ? <BrainCircuit className="w-5 h-5 animate-pulse" /> : <Bot className="w-5 h-5" />}
                </div>
                <span className="font-mono text-sm font-bold text-slate-200">{agent.name}</span>
              </div>
              {agent.status === 'working' && <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />}
              {agent.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            </div>

            <div className="space-y-1 mt-auto">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progress</span>
                <span>{agent.processedCount} / {agent.totalAssigned}</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${agent.status === 'completed' ? 'bg-green-500' : 'bg-primary-500'}`}
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2">
                 <span className="text-slate-500 truncate max-w-[120px] h-4">
                  {agent.status === 'working' ? `Scanning: ${agent.currentFileName || '...'}` : agent.status === 'completed' ? 'Idle' : 'Waiting...'}
                 </span>
                 <span className="text-green-400 font-medium">Found: {agent.candidatesFound}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentStatus;
