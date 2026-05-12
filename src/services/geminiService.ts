import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getSkillGapAnalyses(currentSkills: any[], targetRole: string, aspirations?: string) {
  const currentSkillNames = currentSkills.map(s => typeof s === 'string' ? s : s.name);
  const prompt = `Profile: 
    Current Skills: ${currentSkillNames.join(", ")}
    Target Goal: ${targetRole}
    Aspirations: ${aspirations || "Not specified"}
    
    Tasks:
    1. Identify 3 skill gaps.
    2. Suggest 2 "Trending Skills" in the enterprise today that align with these aspirations.
    3. Provide a structured learning path.
    
    Return JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          gaps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                skill: { type: Type.STRING },
                reason: { type: Type.STRING },
                steps: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["skill", "reason", "steps"]
            }
          },
          trending: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                skill: { type: Type.STRING },
                why: { type: Type.STRING }
              },
              required: ["skill", "why"]
            }
          }
        },
        required: ["gaps", "trending"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { gaps: [], trending: [] };
  }
}

export async function getMentorRecommendations(menteeProfile: any, activeMentors: any[]) {
  if (activeMentors.length === 0) return { recommendations: [] };

  const prompt = `Mentee Profile:
    Name: ${menteeProfile.displayName}
    Current Role: ${menteeProfile.title || "Not set"}
    Expert Skills: ${menteeProfile.skillsExpert.map((s:any) => s.name).join(", ")}
    Interests: ${menteeProfile.skillsInterested.map((s:any) => s.name).join(", ")}
    
    Available Mentors at Arvind:
    ${activeMentors.map(m => `- ${m.displayName} (UID: ${m.uid}, Skills: ${m.skillsExpert.map((s:any) => s.name).join(", ")}, Title: ${m.title || "Employee"})`).join("\n")}
    
    Task:
    Select the top 2 mentors from the list who can best help this mentee reach their growth goals.
    For each recommendation, give a concise 1-sentence reason.
    
    Return JSON: { recommendations: [{ mentorUid: string, reason: string }] }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mentorUid: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["mentorUid", "reason"]
            }
          }
        },
        required: ["recommendations"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("No response text from Gemini");
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Mentor recommendations", e);
    return { recommendations: [] };
  }
}
