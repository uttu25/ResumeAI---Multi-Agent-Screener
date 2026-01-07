import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate." },
    matchStatus: { type: Type.BOOLEAN, description: "TRUE if candidate meets Degree AND All Mandatory Skills. FALSE otherwise." },
    matchScore: { type: Type.INTEGER, description: "0-100 score. Base 70 for passing. +5 for each bonus skill." },
    reason: { type: Type.STRING, description: "Clear explanation. If rejected, state missing Degree or Skill. If passed, list bonus skills." },
    educationMatch: { type: Type.STRING, description: "Exact degree found in resume (e.g. 'B.Tech CS'). If missing, return 'None'." },
    nonMandatorySkillsCount: { type: Type.INTEGER, description: "Count of optional/bonus skills found." },
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
    const modelId = "gemini-1.5-pro"; 

    // STRICT RECRUITER PROMPT
    const prompt = `
      You are a Strict Recruitment Screener. Follow this process EXACTLY.

      ### JOB DESCRIPTION (JD):
      ${jobDescription}

      ### STEP 1: EDUCATION CHECK (Strict)
      - Does the JD ask for a specific degree? (e.g., "MBA", "B.Tech", "Master's").
      - **Action:** Scan resume for this degree (Synonyms: MBA=PGDM, B.Tech=B.E.).
      - **Rule:** If JD requires a degree and Resume does NOT have it -> **REJECT IMMEDIATELY (matchStatus: false)**.

      ### STEP 2: MANDATORY SKILLS CHECK (Strict)
      - Does the JD explicitly list "Must Have" or "Required" skills?
      - **Action:** Scan resume for these specific skills.
      - **Rule:** If the resume is missing ANY critical mandatory skill -> **REJECT IMMEDIATELY (matchStatus: false)**.
      - *Note:* If JD is short (e.g. "Must have MBA") and lists NO specific skills, then skip this step (Don't invent skills).

      ### STEP 3: BONUS / RANKING (Only if Steps 1 & 2 Pass)
      - Does the JD list "Good to have", "Preferred", or "Bonus" skills?
      - **Action:** Count how many of these are present.
      - **Scoring:** - Start with **70** points (Passing Grade).
         - Add **+5 points** for every Bonus Skill found.
         - Cap score at 100.

      ### OUTPUT INSTRUCTIONS:
      - **matchStatus:** TRUE only if Step 1 AND Step 2 are passed.
      - **reason:** If rejected, say "Rejected: Missing Degree X" or "Rejected: Missing Mandatory Skill Y".
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
            temperature: 0.0, // Strict, factual mode
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
    return {
      candidateName: "Error Processing",
      matchStatus: false,
      matchScore: 0,
      reason: "System Error during analysis.",
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
  const initialParts: any[] = [{ text: "You are a Recruitment Assistant. Answer based ONLY on the resume provided." }];
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
