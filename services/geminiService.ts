import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// Initialize Gemini Client
// In a real app, this should be handled securely. Here we assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate extracted from resume" },
    matchStatus: { type: Type.BOOLEAN, description: "True if all mandatory skills are present and candidate is a good fit" },
    matchScore: { type: Type.INTEGER, description: "A score from 0 to 100 indicating fit" },
    reason: { type: Type.STRING, description: "Short justification for the score" },
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
  jobDescription: string
): Promise<AnalysisResult> => {
  try {
    const modelId = "gemini-2.5-flash-latest"; // Using Flash for speed and throughput on large batches

    const prompt = `
      You are an expert HR Screening Agent with a specialization in detecting AI-generated text. 
      Your task is to analyze the provided resume against the following Job Description.
      
      JOB DESCRIPTION:
      ${jobDescription}

      TASKS:
      1. Identify the candidate's name.
      2. Check for MANDATORY skills inferred from the JD. If any mandatory skill is completely missing, matchStatus MUST be false.
      3. Check for OPTIONAL skills (nice-to-haves).
      4. Assign a match score (0-100). 
         - < 50: Missing mandatory skills.
         - 50-70: Has mandatory, missing optional.
         - 70-90: Has mandatory + some optional.
         - 90+: Perfect match.
      5. Provide a concise reason for the fit.
      6. **AI DETECTION**: Analyze the writing style, tone, and structure of the resume. 
         - Look for excessive use of buzzwords, overly generic phrasing, perfect but robotic grammar, or patterns typical of LLMs (like ChatGPT).
         - Determine if it is likely AI-generated (isAiGenerated: true/false).
         - Provide a brief reasoning for this detection.

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
        temperature: 0.1, // Low temperature for consistent, analytical results
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Return a fallback error result so the batch processing continues
    return {
      candidateName: "Unknown/Error",
      matchStatus: false,
      matchScore: 0,
      reason: "Failed to process resume due to API or file error.",
      mandatorySkillsFound: [],
      mandatorySkillsMissing: [],
      optionalSkillsFound: [],
      isAiGenerated: false,
      aiGenerationReasoning: "Error during processing."
    };
  }
};