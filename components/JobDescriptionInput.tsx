import React from 'react';
import { Briefcase } from 'lucide-react';

interface JobDescriptionInputProps {
  jdText: string;
  setJdText: (text: string) => void;
  isProcessing: boolean;
}

const JobDescriptionInput: React.FC<JobDescriptionInputProps> = ({ jdText, setJdText, isProcessing }) => {
  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm h-full flex flex-col">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
        <Briefcase className="w-5 h-5 text-primary-500" />
        Job Description
      </h2>
      <div className="flex-grow">
        <textarea
          className="w-full h-64 md:h-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none transition-all placeholder-slate-600 leading-relaxed"
          placeholder="Paste the detailed Job Description here. Include mandatory skills, years of experience, and nice-to-have qualifications..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          disabled={isProcessing}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500 flex justify-between">
        <span>The AI agents will infer mandatory vs optional skills from this text.</span>
        <span>{jdText.length} chars</span>
      </div>
    </div>
  );
};

export default JobDescriptionInput;
