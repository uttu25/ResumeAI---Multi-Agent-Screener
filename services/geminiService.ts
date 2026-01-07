import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate." },
    matchStatus: { type: Type.BOOLEAN, description: "TRUE if the candidate meets the Minimum Mandatory Requirements (Degree + Critical Skills)." },
    matchScore: { type: Type.INTEGER, description: "0-100 score. Base score is 70 if mandatory met. Add points for optional skills." },
    reason: { type: Type.STRING, description: "Explain WHY. If rejected, specify missing degree/skill. If accepted, mention bonus skills found." },
    educationMatch: { type: Type.STRING, description: "Exact text of the degree found in the resume. If not found, return 'None'." },
    nonMandatorySkillsCount: { type: Type.INTEGER, description: "Total number of 'Good to Have' skills found in the resume." },
    mandatorySkillsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    mandatorySkillsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
    optionalSkillsFound: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 'Good to Have' skills explicitly found." },
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

    const prompt = `
      You are a Smart Recruitment Screener. Your goal is to be FAIR and DETAILED based on the Job Description (JD).

      ### JOB DESCRIPTION (JD):
      ${jobDescription}

      ### ANALYSIS STEPS:

      **STEP 1: Analyze the JD Requirements**
      - **Degree:** Does the JD ask for a specific degree? (e.g., "MBA").
      - **Mandatory Skills:** Does the JD explicitly say "Must have" or "Required"? (If JD is only 1 line like "Must have MBA", then Mandatory Skills = Empty).
      - **Optional/Bonus Skills:** Does the JD say "Good to have", "Preferred", "Plus", or list skills that aren't strictly mandatory?

      **STEP 2: Scan Resume (Evidence Gathering)**
      - **Education:** Look for the requested degree (synonyms allowed: MBA==PGDM, B.Tech==B.E.).
      - **Mandatory Skills:** Check if the candidate has the "Must Haves".
      - **Optional Skills:** Check if the candidate has the "Good to Haves".

      **STEP 3: Scoring & Decision Logic**
      - **Pass/Fail Rule (matchStatus):** - Candidate FAILS if they miss the Degree OR any Critical Mandatory Skill.
         - Candidate PASSES if they have the Degree AND All Mandatory Skills.
         - *Special Case:* If JD has NO mandatory skills (only Degree), then Degree = Pass.

      - **Scoring Rule (matchScore):**
         - **Base Score:** 70 points for meeting All Mandatory requirements.
         - **Bonus Points:** Add 5 points for every "Optional Skill" found (up to 100 max).
         - *Example:* A candidate with MBA + 3 Bonus Skills gets higher score than candidate with just MBA.

      ### OUTPUT INSTRUCTIONS:
      - 'nonMandatorySkillsCount': Put the exact count of optional skills found.
      - 'optionalSkillsFound': List them specifically.
      - 'educationMatch': Put the exact degree string found.
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
