import React, { useCallback } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { FileWithId } from '../types';
import { generateId } from '../utils/helpers';

interface FileUploadProps {
  files: FileWithId[];
  setFiles: React.Dispatch<React.SetStateAction<FileWithId[]>>;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ files, setFiles, isProcessing }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles: FileWithId[] = Array.from(event.target.files).map((file) => ({
        id: generateId(),
        file: file as File,
        status: 'pending'
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary-500" />
          Resume Upload
        </h2>
        <span className="text-slate-400 text-sm">{files.length} files selected</span>
      </div>

      <div className={`border-2 border-dashed border-slate-700 rounded-lg p-8 text-center transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-500 hover:bg-slate-800/50'}`}>
        <input
          type="file"
          id="resume-upload"
          multiple
          accept=".pdf,.docx"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />
        <label htmlFor="resume-upload" className={`cursor-pointer flex flex-col items-center gap-3 ${isProcessing ? 'pointer-events-none' : ''}`}>
          <div className="p-4 bg-slate-800 rounded-full">
            <Upload className="w-8 h-8 text-primary-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-white">Click to upload resumes</p>
            <p className="text-slate-400 text-sm mt-1">Supports PDF & Word (Max 500 files)</p>
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Upload Queue</h3>
          <div className="space-y-2">
            {files.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-md border border-slate-700">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200 truncate max-w-[200px]">{item.file.name}</span>
                  <span className="text-xs text-slate-500">{(item.file.size / 1024).toFixed(1)} KB</span>
                </div>
                {!isProcessing && (
                  <button onClick={() => removeFile(item.id)} className="text-slate-500 hover:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                  </button>
                )}
                {item.status === 'completed' && <span className="text-green-400 text-xs font-bold">DONE</span>}
                {item.status === 'processing' && <span className="text-blue-400 text-xs font-bold animate-pulse">Analyzing...</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;