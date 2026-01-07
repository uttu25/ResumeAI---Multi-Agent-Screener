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
    
    // UPDATED: Using Gemini 3.0 Flash as requested for best performance and stability.
    const modelId = "gemini-3-flash-preview"; 

    const prompt = `
      You are an Evidence-Based Recruitment Auditor. 
      Your ONLY goal is to verify if specific keywords from the Job Description (JD) exist in the Resume.

      JOB DESCRIPTION (JD):
      ${jobDescription}

      ---------------------------------------------------------

      CRITICAL INSTRUCTION FOR MANDATORY SKILLS:
      1. Identify all MANDATORY requirements in the JD (especially Degrees like MBA, PhD, Bachelor, and "Must Have" skills).
      2. SCAN the Resume for these exact keywords or their standard abbreviations.
         - Example: If JD asks for "MBA", you MUST accept "M.B.A.", "Master of Business Administration", "Masters in Business", or "MBA".
         - Example: If JD asks for "Python", you MUST accept "Python".
      3. IF the keyword or its synonym exists in the resume, it is FOUND. Do not over-analyze the context (e.g. if they have the degree, they match, regardless of year).

      SCORING LOGIC (STRICT):
      - **FAIL (Score 0-49)**: If ANY Mandatory Requirement is completely MISSING from the text.
        - matchStatus: false
      - **PASS (Score 70-100)**: If ALL Mandatory Requirements are present.
        - matchStatus: true
        - Base Score: 70.
        - Add points (up to 100) for every OPTIONAL skill found.

      ---------------------------------------------------------

      OUTPUT:
      Return a JSON object matching the schema. 
      - If you reject (matchStatus: false), 'reason' MUST specify exactly which mandatory keyword was missing.
      - If you accept (matchStatus: true), 'reason' should summarize why they fit.
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
        temperature: 0.0, // Zero temperature for deterministic keyword matching
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI model");

    return JSON.parse(text) as AnalysisResult;

  } catch (error: any) {
    // SECURITY: Only log the message, never the full error object which might contain the API key config
    console.error("Gemini Analysis Error:", error.message || "Unknown error occurred");
    
    const errorMessage = error.message || "Unknown API Error";

    // Return a fallback error result so the batch processing continues
    return {
      candidateName: "Error Processing File",
      matchStatus: false,
      matchScore: 0,
      reason: `API Error: ${errorMessage}.`,
      mandatorySkillsFound: [],
      mandatorySkillsMissing: [],
      optionalSkillsFound: [],
      isAiGenerated: false,
      aiGenerationReasoning: "Processing failed."
    };
  }
};