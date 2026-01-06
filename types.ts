export interface FileWithId {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'rejected';
  result?: AnalysisResult;
}

export interface AnalysisResult {
  candidateName: string;
  matchStatus: boolean;
  matchScore: number; // 0 to 100
  reason: string;
  mandatorySkillsFound: string[];
  mandatorySkillsMissing: string[];
  optionalSkillsFound: string[];
  isAiGenerated: boolean;
  aiGenerationReasoning: string;
}

export interface AgentState {
  id: number;
  name: string;
  status: 'idle' | 'working' | 'completed';
  progress: number;
  totalAssigned: number;
  processedCount: number;
  currentFileName?: string;
  candidatesFound: number;
}

export interface JobDescription {
  title: string;
  description: string;
  mandatorySkills: string[];
  optionalSkills: string[];
}