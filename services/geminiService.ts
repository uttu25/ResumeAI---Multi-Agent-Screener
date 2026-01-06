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
  base64Data: string,
  mimeType: string,
  jobDescription: string,
  apiKey?: string
): Promise<AnalysisResult> => {
  try {
    // Dynamically initialize client to support user-provided keys
    const effectiveKey = apiKey || process.env.API_KEY;
    if (!effectiveKey) {
      throw new Error("No API Key provided. Please configure it in settings or environment.");
    }
    
    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    // Use the stable gemini-2.0-flash model to ensure reliability. 
    const modelId = "gemini-2.0-flash"; 

    const prompt = `
      You are a Strict Recruitment Officer. Your job is to enforce requirements without exception.
      
      JOB DESCRIPTION (JD):
      ${jobDescription}

      INSTRUCTIONS:
      
      STEP 1: ANALYZE THE JD
      - Extract a list of **MANDATORY** requirements. 
        - RULE: Any educational degree (MBA, PhD, Bachelors, etc.) mentioned is AUTOMATICALLY MANDATORY unless the JD explicitly says "preferred" or "optional" next to it.
        - RULE: Keywords like "Must have", "Required", "Essential", "Core" indicate Mandatory.
      - Extract a list of **OPTIONAL** requirements (Nice to have, Preferred, Bonus).

      STEP 2: ANALYZE THE RESUME
      - Cross-reference the resume against the lists from Step 1.

      STEP 3: CALCULATE STATUS AND SCORE
      
      **LOGIC FOR MATCH STATUS (Pass/Fail):**
      - If the resume is missing EVEN ONE Mandatory requirement (especially the Degree):
        -> matchStatus = FALSE
        -> matchScore MUST be between 0 and 49.
      - If the resume has ALL Mandatory requirements:
        -> matchStatus = TRUE
        -> matchScore MUST be at least 70.

      **LOGIC FOR RANKING (70-100):**
      - Only if matchStatus is TRUE, use Optional skills to increase the score.
      - Base Score = 70 (Met all mandatory).
      - Add points for every Optional skill found up to 100.
      
      **AI DETECTION:**
      - Analyze the writing style for robotic patterns, lack of nuance, or ChatGPT-style sentence structures.

      OUTPUT FORMAT:
      Return pure JSON adhering to the defined schema.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.0, // Set to 0.0 for maximum determinism
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI model");

    return JSON.parse(text) as AnalysisResult;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    // Extract more specific error message if available
    const errorMessage = error.message || "Unknown API Error";

    // Return a fallback error result so the batch processing continues
    return {
      candidateName: "Error Processing File",
      matchStatus: false,
      matchScore: 0,
      reason: `API Error: ${errorMessage}. Please check your API key and quota.`,
      mandatorySkillsFound: [],
      mandatorySkillsMissing: [],
      optionalSkillsFound: [],
      isAiGenerated: false,
      aiGenerationReasoning: "Processing failed."
    };
  }
};