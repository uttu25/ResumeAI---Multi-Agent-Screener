import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, FolderUp, Trash2 } from 'lucide-react';
import { FileWithId } from '../types';
import { generateId } from '../utils/helpers';

interface FileUploadProps {
  files: FileWithId[];
  setFiles: React.Dispatch<React.SetStateAction<FileWithId[]>>;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ files, setFiles, isProcessing }) => {
  const [isDragging, setIsDragging] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList | null) => {
    if (fileList && fileList.length > 0) {
      const newFiles: FileWithId[] = Array.from(fileList)
        .filter(file => file.name.match(/\.(pdf|doc|docx)$/i)) // Simple extension validation
        .map((file) => ({
          id: generateId(),
          file: file as File,
          status: 'pending'
        }));
      
      setFiles(prev => {
        // Avoid duplicates based on name and size
        const existingIds = new Set(prev.map(f => `${f.file.name}-${f.file.size}`));
        const uniqueNewFiles = newFiles.filter(f => !existingIds.has(`${f.file.name}-${f.file.size}`));
        return [...prev, ...uniqueNewFiles];
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
    // Reset input value to allow selecting same files again if needed
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    processFiles(e.dataTransfer.files);
  };

  const triggerFolderUpload = () => {
    folderInputRef.current?.click();
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    if (isProcessing) return;
    setFiles([]);
  };

  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary-500" />
          Bulk Upload
        </h2>
        {files.length > 0 && !isProcessing && (
          <button 
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
          >
            <Trash2 className="w-3 h-3" />
            Clear Queue
          </button>
        )}
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 flex flex-col items-center justify-center gap-4 flex-grow
          ${isProcessing ? 'opacity-50 cursor-not-allowed border-slate-700' : ''}
          ${isDragging ? 'border-primary-500 bg-primary-500/10 scale-[0.99]' : 'border-slate-700 hover:border-primary-500 hover:bg-slate-800/50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />
        {/* Hidden Input for Folder Upload - using ref to trigger */}
        <input
          type="file"
          ref={folderInputRef}
          multiple
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
          {...({ webkitdirectory: "", directory: "" } as any)}
        />

        <div className={`p-4 rounded-full transition-transform duration-300 ${isDragging ? 'bg-primary-500 text-white scale-110' : 'bg-slate-800 text-primary-400'}`}>
          <Upload className="w-8 h-8" />
        </div>
        
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-white">Drag & Drop Resumes</h3>
          <p className="text-slate-400 text-sm">PDF, DOC, DOCX supported</p>
        </div>

        {!isProcessing && (
          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full max-w-xs">
            <button
              onClick={triggerFileUpload}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg border border-slate-600 transition-colors"
            >
              Select Files
            </button>
            <button
              onClick={triggerFolderUpload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary-500/20 transition-all"
            >
              <FolderUp className="w-4 h-4" />
              Upload Folder
            </button>
          </div>
        )}
      </div>

      {/* File List / Queue */}
      {files.length > 0 && (
        <div className="mt-4 flex-grow-0">
          <div className="flex justify-between items-center mb-2">
             <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Queue ({files.length})</h3>
             <span className="text-xs text-slate-500">Max 500 files</span>
          </div>
          
          <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {files.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-slate-800 p-2.5 rounded-md border border-slate-700 group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-slate-200 truncate max-w-[180px]">{item.file.name}</span>
                    <span className="text-[10px] text-slate-500">{(item.file.size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {item.status === 'completed' && <span className="text-green-400 text-[10px] font-bold bg-green-500/10 px-2 py-0.5 rounded">DONE</span>}
                  {item.status === 'processing' && <span className="text-blue-400 text-[10px] font-bold animate-pulse">Scanning...</span>}
                  {item.status === 'error' && <span className="text-red-400 text-[10px] font-bold">ERROR</span>}
                  {item.status === 'pending' && !isProcessing && (
                    <button 
                      onClick={() => removeFile(item.id)} 
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;