import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate extracted from resume" },
    matchStatus: { type: Type.BOOLEAN, description: "Set to TRUE if the candidate meets the CORE MANDATORY requirements. Set to FALSE if they are missing critical skills." },
    matchScore: { type: Type.INTEGER, description: "0-100 score. 90+ for perfect match, 70-89 for strong match, <50 for rejection." },
    reason: { type: Type.STRING, description: "Concise reason. If rejected, explicitly list the MISSING mandatory skills." },
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
    
    // Using 'gemini-1.5-pro' for maximum intelligence
    const modelId = "gemini-1.5-pro"; 

    const prompt = `
      You are an Expert Technical Recruiter. Your job is to SCREEN this resume against the Job Description (JD).
      
      ### JOB DESCRIPTION:
      ${jobDescription}
      
      ### INSTRUCTIONS:
      1. **Analyze the JD**: Identify the "Must-Have" (Mandatory) skills vs "Nice-to-Have" (Optional).
      2. **Scan the Resume**: Search for these skills using SEMANTIC MATCHING.
         - *Example*: If JD asks for "React", and Resume has "React.js" or "ReactJS", that is a MATCH.
         - *Example*: If JD asks for "AWS", and Resume has "Amazon Web Services", that is a MATCH.
      3. **Decision Logic**:
         - **matchStatus**: TRUE if specific mandatory hard skills are present. FALSE if a critical deal-breaker skill is completely missing.
         - **matchScore**:
           - 90-100: Meets all mandatory + some optional.
           - 70-89: Meets most mandatory skills (good fit).
           - 0-60: Missing critical mandatory skills (reject).
      
      ### OUTPUT FORMAT:
      Return a JSON object strictly matching the provided schema.
    `;

    // Retry Logic for Rate Limits (429 Errors)
    const makeRequestWithRetry = async (retries = 3, delay = 2000): Promise<any> => {
      try {
        let contentsParts: any[] = [{ text: prompt }];

        if (isPlainText) {
           contentsParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
        } else {
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
            temperature: 0.1, 
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

// --- CHAT FEATURE ---
export const startChatWithResume = async (
  fileContent: string,
  mimeType: string,
  isPlainText: boolean,
  apiKey?: string
) => {
  const effectiveKey = apiKey || process.env.API_KEY;
  if (!effectiveKey) throw new Error("No API Key provided.");

  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  // Using Flash for chat as it is faster and sufficient for Q&A
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  const initialParts: any[] = [
    { text: "You are an expert Recruitment Assistant. I will provide you with a candidate's resume. Your job is to answer my specific questions about their experience, skills, and red flags based ONLY on this document. Be concise and professional." }
  ];

  if (isPlainText) {
    initialParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
  } else {
    initialParts.push({ inlineData: { mimeType, data: fileContent } });
  }

  const chat = model.startChat({
    history: [
      { role: "user", parts: initialParts },
      { role: "model", parts: [{ text: "Understood. I have read the resume. Ask me anything about this candidate." }] }
    ]
  });

  return chat;
};
