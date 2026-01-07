import React, { useEffect, useState } from 'react';
import { X, Calendar, ChevronRight, Trash2, Clock, Loader2 } from 'lucide-react';

interface HistoryItem {
  id: number;
  title: string;
  date: string;
  stats: { total: number; qualified: number };
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onLoadScan: (scanId: number) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, userId, onLoadScan }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchHistory();
    }
  }, [isOpen, userId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/history/${userId}`); // UPDATED: Relative path
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            Recruitment History
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Loading records...</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center py-10 text-slate-500">No scan history found.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors group">
                <div>
                  <h3 className="font-semibold text-slate-200">{item.title}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-300">
                      {item.stats.qualified} qualified / {item.stats.total} total
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => onLoadScan(item.id)}
                  className="px-4 py-2 bg-primary-600/20 text-primary-400 text-sm font-medium rounded-lg hover:bg-primary-600 hover:text-white transition-all flex items-center gap-2"
                >
                  Load Results <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
