import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// 1. Define the Schema to match YOUR Prompt's output requirements
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate." },
    matchStatus: { type: Type.BOOLEAN, description: "Final Decision: TRUE only if Education AND Mandatory Skills are met. FALSE otherwise." },
    matchScore: { type: Type.INTEGER, description: "0-100 score. 0=Reject. 70+=Match. Higher score = more non-mandatory skills." },
    reason: { type: Type.STRING, description: "Explanation of the decision. If rejected, state EXACTLY what is missing." },
    educationMatch: { type: Type.STRING, description: "The exact text from the resume proving the degree (e.g. 'MBA - Harvard')." },
    nonMandatorySkillsCount: { type: Type.INTEGER, description: "Count of how many 'Good to Have' skills were found." },
    mandatorySkillsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    mandatorySkillsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
    optionalSkillsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    isAiGenerated: { type: Type.BOOLEAN },
    aiGenerationReasoning: { type: Type.STRING },
  },
  required: [
    "candidateName", 
    "matchStatus", 
    "matchScore", 
    "reason", 
    "educationMatch", 
    "nonMandatorySkillsCount",
    "mandatorySkillsFound", 
    "mandatorySkillsMissing", 
    "optionalSkillsFound", 
    "isAiGenerated", 
    "aiGenerationReasoning"
  ],
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
    
    // RECOMMENDATION: Keep 'gemini-1.5-pro'. 
    // It is the smartest stable model for "Strict" reasoning. 
    // 'Flash' models might skip your detailed instructions for speed.
    const modelId = "gemini-1.5-pro"; 

    // YOUR CUSTOM PROMPT (Slightly optimized for single-file processing)
    const prompt = `
      You are a Strict Recruitment Screener. You have to go through this resume and check it against the Job Description (JD).
      
      ### JOB DESCRIPTION (JD):
      ${jobDescription}
      
      ### INSTRUCTIONS:
      1. **Extract Education Requirements**: Does the JD require a specific degree (e.g., "MBA", "Bachelor's", "Master's")?
      2. **Scan Resume for Education**: Look for these degrees in the 'Education' section of the resume. 
         - NOTE: "MBA", "M.B.A.", "Master of Business Administration", "PGDM" are all synonyms. B.Tech, B.E. are also synonyms.
      3. **Scan for Skills**: Look for mandatory technical skills and soft skills.
      
      ### CRITICAL DECISION RULES:
      - **STRICT MATCH**: If JD asks for a degree AND mandatory skills (Tech/Non-Tech/Soft) with phrases like "must have", "should have", and the resume HAS them -> matchStatus: true.
      
      - **REJECT (Degree)**: If the JD asks for a degree and the resume does NOT have it -> REJECT (matchStatus: false).
      
      - **REJECT (Skills)**: If the JD has mandatory Tech, Non-Tech, or Soft skill requirements and the resume does NOT have them -> REJECT (matchStatus: false).
      
      - **RANKING (Non-Mandatory)**: If the JD mentions "good to have" (non-mandatory) skills:
         - Do NOT reject if these are missing.
         - **SCORING**: Give a higher 'matchScore' (e.g., 85-100) to candidates who have more of these non-mandatory skills.
         - Count exactly how many non-mandatory skills they have.
      
      ### OUTPUT:
      Return a JSON object matching the schema. 
      - In 'educationMatch', paste the exact text from the resume that proves they have the degree (e.g., "MBA - Harvard University").
      - In 'matchStatus', set true ONLY if education and critical skills are met.
      - In 'nonMandatorySkillsCount', return the integer number of non-mandatory skills found.
    `;

    // Retry Logic
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
            // Low temperature = High Strictness. 
            // We want the AI to be "Strict" as per your instruction.
            temperature: 0.0, 
          }
        });
      } catch (error: any) {
        if (retries > 0 && (error.message?.includes("429") || error.message?.includes("quota"))) {
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
    // Fallback error object
    return {
      candidateName: "Error",
      matchStatus: false,
      matchScore: 0,
      reason: "Error processing file.",
      educationMatch: "None",
      nonMandatorySkillsCount: 0,
      mandatorySkillsFound: [],
      mandatorySkillsMissing: [],
      optionalSkillsFound: [],
      isAiGenerated: false,
      aiGenerationReasoning: "Error"
    } as any;
  }
};

// ... (Chat Feature remains unchanged) ...
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

  const initialParts: any[] = [
    { text: "You are a Recruitment Assistant. Answer questions based ONLY on the resume provided." }
  ];

  if (isPlainText) {
    initialParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
  } else {
    initialParts.push({ inlineData: { mimeType, data: fileContent } });
  }

  return model.startChat({
    history: [
      { role: "user", parts: initialParts },
      { role: "model", parts: [{ text: "Ready." }] }
    ]
  });
};
