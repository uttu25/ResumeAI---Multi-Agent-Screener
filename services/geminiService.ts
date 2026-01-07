import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate extracted from resume" },
    matchStatus: { type: Type.BOOLEAN, description: "True ONLY if ALL mandatory skills/degrees are present." },
    matchScore: { type: Type.INTEGER, description: "0-49 if mandatory missing. 70 if all mandatory present. 71-100 based on optional skills." },
    reason: { type: Type.STRING, description: "Specific justification. If rejected, state exactly which mandatory skill was missing." },
    mandatorySkillsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    mandatorySkillsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
    optionalSkillsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    isAiGenerated: { type: Type.BOOLEAN, description: "True if the resume text exhibits patterns strongly characteristic of AI generation (e.g. ChatGPT)." },
    aiGenerationReasoning: { type: Type.STRING, description: "Brief explanation of why the text looks AI-generated or human-written." },
  },
  required: ["candidateName", "matchStatus", "matchScore", "reason", "mandatorySkillsFound", "mandatorySkillsMissing", "optionalSkillsFound", "isAiGenerated", "aiGenerationReasoning"],
};

export const analyzeResume = async (
  fileContent: string, 
  mimeType: string, 
  jobDescription: string, 
  apiKey?: string,
  isPlainText: boolean = false
): Promise<AnalysisResult> => {
  try {
    const effectiveKey = apiKey || process.env.API_KEY;
    if (!effectiveKey) throw new Error("No API Key provided.");
    
    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    const modelId = "gemini-1.5-flash"; // Switched to stable model

    const prompt = `
      You are an Evidence-Based Recruitment Auditor. 
      Your ONLY goal is to verify if specific keywords from the Job Description (JD) exist in the Resume.
      
      JOB DESCRIPTION (JD):
      ${jobDescription}
      
      ---------------------------------------------------------
      CRITICAL INSTRUCTION:
      1. Identify MANDATORY requirements (Degrees, "Must Have" skills).
      2. SCAN the Resume for these exact keywords.
      3. Return a JSON object strictly matching the schema.
      ---------------------------------------------------------
    `;

    // Retry Logic for Rate Limits (429 Errors)
    const makeRequestWithRetry = async (retries = 3, delay = 2000): Promise<any> => {
      try {
        let contentsParts = [{ text: prompt }];

        if (isPlainText) {
           // Inject extracted text directly into the prompt
           contentsParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
        } else {
           // Use standard vision/document mode
           contentsParts.push({
             inlineData: { mimeType: mimeType, data: fileContent }
           });
        }

        return await ai.models.generateContent({
          model: modelId,
          contents: { parts: contentsParts },
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.0,
          }
        });
      } catch (error: any) {
        if (retries > 0 && (error.message?.includes("429") || error.message?.includes("quota"))) {
          console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return makeRequestWithRetry(retries - 1, delay * 2);
        }
        throw error;
      }
    };

    const response = await makeRequestWithRetry();
    const text = response.text();
    if (!text) throw new Error("No response text from AI model");

    return JSON.parse(text) as AnalysisResult;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error.message);
    return {
      candidateName: "Error Processing File",
      matchStatus: false,
      matchScore: 0,
      reason: `API Error: ${error.message || "Unknown error"}.`,
      mandatorySkillsFound: [],
      mandatorySkillsMissing: [],
      optionalSkillsFound: [],
      isAiGenerated: false,
      aiGenerationReasoning: "Processing failed."
    };
  }
};
// ... existing code ...

// --- NEW CHAT FEATURE ---
export const startChatWithResume = async (
  fileContent: string,
  mimeType: string,
  isPlainText: boolean,
  apiKey?: string
) => {
  const effectiveKey = apiKey || process.env.API_KEY;
  if (!effectiveKey) throw new Error("No API Key provided.");

  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Prepare the initial context
  const initialParts: any[] = [
    { text: "You are an expert Recruitment Assistant. I will provide you with a candidate's resume. Your job is to answer my specific questions about their experience, skills, and red flags based ONLY on this document. Be concise and professional." }
  ];

  if (isPlainText) {
    initialParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
  } else {
    initialParts.push({ inlineData: { mimeType, data: fileContent } });
  }

  // Start the chat
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: initialParts
      },
      {
        role: "model",
        parts: [{ text: "Understood. I have read the resume. Ask me anything about this candidate." }]
      }
    ]
  });

  return chat;
};
