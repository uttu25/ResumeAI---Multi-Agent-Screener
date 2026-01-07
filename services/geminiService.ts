import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "Full name of the candidate extracted from resume." },
    matchStatus: { type: Type.BOOLEAN, description: "TRUE ONLY if ALL mandatory criteria are met. FALSE if ANY mandatory criteria are missing." },
    matchScore: { type: Type.INTEGER, description: "0-100. Base 50 if passes mandatory checks. +10 for each bonus skill found. Cap at 100." },
    reason: { type: Type.STRING, description: "Specific explanation. If rejected, list EXACTLY what is missing (Degree or Skill names). If accepted, list which mandatory requirements were met." },
    educationMatch: { type: Type.STRING, description: "Exact degree/certification found. Examples: 'B.Tech Computer Science', 'MBA', 'B.Sc', 'None'." },
    nonMandatorySkillsCount: { type: Type.INTEGER, description: "Count of bonus/optional skills found (0+)." },
    mandatorySkillsFound: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of mandatory skills from JD that ARE present in resume." },
    mandatorySkillsMissing: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of mandatory skills from JD that are NOT in resume." },
    optionalSkillsFound: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of optional/bonus skills found." },
    isAiGenerated: { type: Type.BOOLEAN, description: "TRUE if resume appears AI-written, FALSE if appears human-written." },
    aiGenerationReasoning: { type: Type.STRING, description: "Why it is or isn't AI-generated." },
    educationRequired: { type: Type.BOOLEAN, description: "Whether JD explicitly requires education degree." },
    educationPresent: { type: Type.BOOLEAN, description: "Whether resume contains the required education." },
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
    "aiGenerationReasoning",
    "educationRequired",
    "educationPresent"
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
    const effectiveKey = apiKey || process.env.REACT_APP_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!effectiveKey) throw new Error("No API Key provided. Please set GEMINI_API_KEY in settings or environment variables.");
    
    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    const modelId = "gemini-1.5-pro"; 

    // ULTRA-STRICT RECRUITMENT SCREENING PROMPT
    const prompt = `YOU ARE A STRICT RECRUITMENT SCREENER. FOLLOW THE EXACT ALGORITHM BELOW.

## CANDIDATE EVALUATION ALGORITHM

### PHASE 1: PARSE JOB DESCRIPTION
Extract from the JD:
1. EDUCATION REQUIREMENTS:
   - Does JD explicitly state a required degree? (Bachelor's, Master's, MBA, B.Tech, etc.)
   - If YES: Note the exact degree type(s) required
   - If NO: Education is NOT mandatory

2. MANDATORY SKILLS (Must Have, Required, Mandatory, Must, Compulsory):
   - Extract ONLY skills explicitly listed under "Required", "Mandatory", "Must Have", "Must include"
   - If section doesn't exist or JD is vague, assume NO mandatory skills beyond education
   - List each mandatory skill as a single term (e.g., "React.js", "Python", "AWS")

3. OPTIONAL SKILLS (Nice to have, Preferred, Good to have, Bonus):
   - Extract skills from these sections
   - These do NOT affect pass/fail, only boost score

### PHASE 2: SCAN RESUME
1. EXTRACT EDUCATION:
   - Find degree section (Education, Qualification, etc.)
   - Return exact degree found (e.g., "B.Tech Computer Science")
   - Return "None" if no degree found

2. EXTRACT SKILLS:
   - Search entire resume for mandatory skills from Phase 1
   - Mark each as FOUND or MISSING
   - Search for optional skills

### PHASE 3: DECISION LOGIC (STRICT)
IF Education is REQUIRED by JD:
  - IF Resume does NOT have required degree: REJECT (matchStatus = false)
  
FOR each MANDATORY SKILL from JD:
  - IF skill NOT found in resume: REJECT (matchStatus = false)

IF all mandatory requirements passed:
  - ACCEPT (matchStatus = true)
  - Score = 50 (base for passing)
  - Add +10 for each optional skill found (max 100)

### PHASE 4: GENERATE RESPONSE
- matchStatus: true/false (based on Phase 3)
- reason: If rejected, say "Missing: [Degree OR Skills]". If accepted, say "All mandatory requirements met."
- educationMatch: Exact degree or "None"
- mandatorySkillsFound: Skills present
- mandatorySkillsMissing: Skills absent (CRITICAL - these cause rejection)
- optionalSkillsFound: Bonus skills
- nonMandatorySkillsCount: Count of optional skills

---

## CRITICAL REMINDERS

⚠️ DO NOT:
- Make assumptions about implied skills
- Accept partial matches (e.g., "Java" when "JavaScript" required)
- Infer missing education if not explicitly stated
- Be lenient on mandatory requirements
- Accept abbreviations unless explicitly equivalent (MBA = PGDM only)

✅ DO:
- Be exact and literal when matching skills
- Treat "Required" and "Mandatory" as strict gates
- List EXACTLY what's missing in mandatorySkillsMissing
- Return false immediately if ANY mandatory requirement missing
- Use case-insensitive matching (Python = python = PYTHON)

---

## JOB DESCRIPTION TO ANALYZE:

${jobDescription}

---

PROCEED WITH ANALYSIS. BE STRICT. NO LENIENCY.`;

    const makeRequestWithRetry = async (retries = 3, delay = 2000): Promise<any> => {
      try {
        const contentsParts: any[] = [{ text: prompt }];

        if (isPlainText) {
           contentsParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
        } else {
           contentsParts.push({
             inlineData: { mimeType: mimeType, data: fileContent }
           });
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents: { parts: contentsParts },
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.0, // Absolute zero randomness - strict, deterministic mode
            topP: 0.1, // Very low diversity in token selection
          }
        });

        return response;
      } catch (error: any) {
        console.error(`API Error (Attempt ${4 - retries}):`, error.message);
        
        // Specific handling for rate limits and quota issues
        if (retries > 0 && (
          error.message?.includes("429") || 
          error.message?.includes("quota") ||
          error.message?.includes("RESOURCE_EXHAUSTED") ||
          error.message?.includes("rate limit")
        )) {
          const waitTime = delay;
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return makeRequestWithRetry(retries - 1, delay * 2);
        }
        throw error;
      }
    };

    const response = await makeRequestWithRetry();
    const text = response.text();
    if (!text) throw new Error("No response text from AI model");

    let parsed: AnalysisResult;
    try {
      parsed = JSON.parse(text) as AnalysisResult;
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", text);
      throw new Error(`Invalid JSON response from API: ${parseError}`);
    }

    // VALIDATION: Ensure response matches expected structure
    if (typeof parsed.matchStatus !== 'boolean') {
      console.warn("Invalid matchStatus type, attempting recovery...");
      parsed.matchStatus = parsed.mandatorySkillsMissing?.length === 0 && parsed.educationPresent !== false;
    }

    if (typeof parsed.matchScore !== 'number') {
      parsed.matchScore = parsed.matchStatus ? 75 : 0;
    }

    // Ensure arrays exist
    parsed.mandatorySkillsFound = parsed.mandatorySkillsFound || [];
    parsed.mandatorySkillsMissing = parsed.mandatorySkillsMissing || [];
    parsed.optionalSkillsFound = parsed.optionalSkillsFound || [];

    return parsed;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error.message);
    return {
      candidateName: "Error Processing",
      matchStatus: false,
      matchScore: 0,
      reason: `System Error: ${error.message || "Analysis failed"}`,
      educationMatch: "None",
      nonMandatorySkillsCount: 0,
      mandatorySkillsFound: [],
      mandatorySkillsMissing: ["Unable to process resume"],
      optionalSkillsFound: [],
      isAiGenerated: false,
      aiGenerationReasoning: "Error occurred during processing"
    };
  }
};

export const startChatWithResume = async (
  fileContent: string,
  mimeType: string,
  isPlainText: boolean,
  apiKey?: string
) => {
  const effectiveKey = apiKey || process.env.REACT_APP_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!effectiveKey) throw new Error("No API Key provided. Please set GEMINI_API_KEY in settings.");
  
  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const initialParts: any[] = [
    { text: "You are a Recruitment Assistant. Answer questions about the candidate based ONLY on the resume provided. Be concise, accurate, and factual. Do not make assumptions." }
  ];
  
  if (isPlainText) {
    initialParts.push({ text: `RESUME TEXT CONTENT:\n${fileContent}` });
  } else {
    initialParts.push({ inlineData: { mimeType, data: fileContent } });
  }
  
  return model.startChat({
    history: [
      { role: "user", parts: initialParts },
      { role: "model", parts: [{ text: "I've reviewed the resume. I'll provide accurate information based only on what's stated in the document. What would you like to know?" }] }
    ]
  });
};
