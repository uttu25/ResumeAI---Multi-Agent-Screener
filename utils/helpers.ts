import { FileWithId } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the Data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

// Distribute files evenly among agents
export const distributeFiles = (files: FileWithId[], agentCount: number): FileWithId[][] => {
  const chunks: FileWithId[][] = Array.from({ length: agentCount }, () => []);
  files.forEach((file, index) => {
    chunks[index % agentCount].push(file);
  });
  return chunks;
};
