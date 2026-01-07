import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { FileWithId, UserProfile } from '../types';
import { CheckCircle, XCircle, User, Award, AlertTriangle, FileText, Bot, Download, MessageSquare } from 'lucide-react';
import CandidateChatModal from './CandidateChatModal'; // Import the new modal

interface ResultsDashboardProps {
  files: FileWithId[];
  user?: UserProfile | null; // Pass user for API key access
}

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ files, user }) => {
  const [selectedCandidate, setSelectedCandidate] = useState<FileWithId | null>(null);

  const processedFiles = useMemo(() => files.filter(f => f.status === 'completed' && f.result), [files]);
  
  const qualifiedCandidates = useMemo(() => 
    processedFiles
      .filter(f => f.result?.matchStatus)
      .sort((a, b) => (b.result?.matchScore || 0) - (a.result?.matchScore || 0)), 
    [processedFiles]
  );

  const stats = useMemo(() => {
    const total = processedFiles.length;
    const qualified = qualifiedCandidates.length;
    const rejected = total - qualified;
    const aiDetected = processedFiles.filter(f => f.result?.isAiGenerated).length;
    return { total, qualified, rejected, aiDetected };
  }, [processedFiles, qualifiedCandidates]);

  const scoreDistribution = useMemo(() => {
    const buckets = { '0-49': 0, '50-69': 0, '70-89': 0, '90-100': 0 };
    processedFiles.forEach(f => {
      const s = f.result?.matchScore || 0;
      if (s >= 90) buckets['90-100']++;
      else if (s >= 70) buckets['70-89']++;
      else if (s >= 50) buckets['50-69']++;
      else buckets['0-49']++;
    });
    return Object.keys(buckets).map(key => ({ name: key, count: buckets[key as keyof typeof buckets] }));
  }, [processedFiles]);

  const downloadCSV = () => {
    if (processedFiles.length === 0) return;
    const headers = ["Candidate Name", "Match Score", "Status", "Mandatory Skills Found", "Missing Skills", "AI Generated?", "Reasoning"];
    const rows = processedFiles.map(f => {
      const r = f.result;
      if (!r) return "";
      const safeReason = `"${r.reason.replace(/"/g, '""')}"`;
      const safeMissing = `"${r.mandatorySkillsMissing.join(', ')}"`;
      const safeFound = `"${r.mandatorySkillsFound.join(', ')}"`;
      return [`"${r.candidateName}"`, r.matchScore, r.matchStatus ? "Qualified" : "Rejected", safeFound, safeMissing, r.isAiGenerated ? "Yes" : "No", safeReason].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `resume_screening_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (processedFiles.length === 0) return null;

  return (
    <>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Top Level Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* ... (Keep existing stats cards code same as before) ... */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Processed</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg"><FileText className="w-6 h-6 text-slate-400" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Qualified Candidates</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{stats.qualified}</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg"><CheckCircle className="w-6 h-6 text-green-500" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">Rejection Rate</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}%</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg"><XCircle className="w-6 h-6 text-red-500" /></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium">AI Detected</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{stats.aiDetected}</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg"><Bot className="w-6 h-6 text-purple-500" /></div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ... (Keep existing charts code same as before) ... */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Score Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution}>
                  <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b'}} />
                  <YAxis stroke="#64748b" tick={{fill: '#64748b'}} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} itemStyle={{ color: '#3b82f6' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 3 ? '#22c55e' : index === 2 ? '#3b82f6' : index === 1 ? '#eab308' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4">Qualification Ratio</h3>
            <div className="h-64 w-full flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Qualified', value: stats.qualified }, { name: 'Rejected', value: stats.rejected }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} />
                </PieChart>
               </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-slate-300">Qualified</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-slate-300">Rejected</span></div>
            </div>
          </div>
        </div>

        {/* Consolidated List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Top Candidates (Consolidated)</h3>
            <div className="flex items-center gap-3">
               <button onClick={downloadCSV} className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded transition-colors shadow-lg shadow-primary-500/20">
                 <Download className="w-4 h-4" /> Export CSV
               </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Rank</th>
                  <th className="p-4 font-medium">Candidate</th>
                  <th className="p-4 font-medium">Score</th>
                  <th className="p-4 font-medium">Details</th>
                  <th className="p-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {qualifiedCandidates.map((file, idx) => (
                  <tr key={file.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4 font-mono text-slate-500">#{idx + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-full text-slate-400 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{file.result?.candidateName}</p>
                          <p className="text-xs text-slate-500 truncate w-32">{file.file.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold text-lg ${
                        (file.result?.matchScore || 0) >= 90 ? 'text-green-400' : 
                        (file.result?.matchScore || 0) >= 70 ? 'text-primary-400' : 'text-yellow-400'
                      }`}>
                        {file.result?.matchScore}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                         <div className="flex gap-1 flex-wrap">
                          {file.result?.mandatorySkillsFound.slice(0, 2).map((s, i) => (
                             <span key={i} className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">{s}</span>
                          ))}
                         </div>
                         {file.result?.mandatorySkillsMissing.length > 0 && (
                           <span className="text-[10px] text-red-400">Missing: {file.result?.mandatorySkillsMissing[0]}</span>
                         )}
                      </div>
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => setSelectedCandidate(file)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-primary-600 hover:text-white text-slate-300 text-xs font-medium rounded-lg border border-slate-700 hover:border-primary-500 transition-all"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Chat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Render Modal */}
      <CandidateChatModal 
        candidate={selectedCandidate} 
        isOpen={!!selectedCandidate} 
        onClose={() => setSelectedCandidate(null)}
        user={user || null}
      />
    </>
  );
};

export default ResultsDashboard;
