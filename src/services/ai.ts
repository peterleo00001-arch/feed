import { GoogleGenAI, Type } from "@google/genai";
import { db } from "../db";

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export function getBabyProfile() {
  try {
    const data = localStorage.getItem('babyProfile');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return { age: 24, gender: 'boy' };
}

function getAgeString(months: number) {
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? `${years} year and ${m} month old` : `${years} year old`;
  }
  return `${months} month old`;
}

export async function generateDailyPlan(date: string, language: 'zh' | 'en') {
  const prefs = await db.preferences.toArray();
  const likes = prefs.filter(p => p.type === 'like').map(p => p.item);
  const dislikes = prefs.filter(p => p.type === 'dislike').map(p => p.item);
  const allergies = prefs.filter(p => p.type === 'allergy').map(p => p.item);

  // Get recent history to avoid repetition and learn from rejections
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentHistory = await db.mealHistory.where('date').aboveOrEqual(threeDaysAgo).toArray();

  const rejected = recentHistory.filter(h => h.status === 'rejected').map(h => h.dishName);
  const eaten = recentHistory.filter(h => h.status === 'eaten').map(h => h.dishName);

  const langInstruction = language === 'zh' ? 'The response MUST be in Chinese (Simplified).' : 'The response MUST be in English.';
  const profile = getBabyProfile();
  const ageStr = getAgeString(profile.age);

  const prompt = `
Generate a healthy daily meal plan for a ${ageStr} toddler (${profile.gender}) for the date ${date}.
The toddler has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Recently rejected meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently eaten meals (they like these, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, soft enough for a ${ageStr} toddler, and nutritionally balanced.
- Provide 4 meals: breakfast, lunch, snack, dinner.
- For each meal, provide a dish name and a list of main ingredients.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mealType: { type: Type.STRING, description: "breakfast, lunch, snack, or dinner" },
                dishName: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["mealType", "dishName", "ingredients"]
            }
          }
        },
        required: ["meals"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return data.meals || [];
  } catch (e) {
    console.error("Failed to parse meal plan JSON", e);
    return [];
  }
}

export async function generateSingleMeal(date: string, mealType: string, language: 'zh' | 'en') {
  const prefs = await db.preferences.toArray();
  const likes = prefs.filter(p => p.type === 'like').map(p => p.item);
  const dislikes = prefs.filter(p => p.type === 'dislike').map(p => p.item);
  const allergies = prefs.filter(p => p.type === 'allergy').map(p => p.item);

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentHistory = await db.mealHistory.where('date').aboveOrEqual(threeDaysAgo).toArray();

  const rejected = recentHistory.filter(h => h.status === 'rejected').map(h => h.dishName);
  const eaten = recentHistory.filter(h => h.status === 'eaten').map(h => h.dishName);

  const langInstruction = language === 'zh' ? 'The response MUST be in Chinese (Simplified).' : 'The response MUST be in English.';
  const profile = getBabyProfile();
  const ageStr = getAgeString(profile.age);

  const prompt = `
Generate a healthy ${mealType} for a ${ageStr} toddler (${profile.gender}) for the date ${date}.
The toddler has the following preferences:
- Likes: ${likes.join(', ') || 'None specified'}
- Dislikes: ${dislikes.join(', ') || 'None specified'}
- Allergies: ${allergies.join(', ') || 'None specified'}

Recently rejected meals (avoid these or similar): ${rejected.join(', ') || 'None'}
Recently eaten meals (they like these, but don't repeat exactly): ${eaten.join(', ') || 'None'}

Requirements:
- Meals must be healthy, low in sodium and sugar, soft enough for a ${ageStr} toddler, and nutritionally balanced.
- Provide a dish name and a list of main ingredients.
- The response MUST be a valid JSON object matching the requested schema.
- ${langInstruction}
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mealType: { type: Type.STRING },
          dishName: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["mealType", "dishName", "ingredients"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse single meal JSON", e);
    return null;
  }
}

export async function generateAudio(text: string, language: 'zh' | 'en') {
  try {
    const voiceName = language === 'zh' ? 'Aoede' : 'Kore';
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    console.error("Failed to generate audio", e);
    return null;
  }
}

export async function generateTutorial(dishName: string, ingredients: string[], language: 'zh' | 'en') {
  const langInstruction = language === 'zh' ? 'The tutorial MUST be written in Chinese (Simplified).' : 'The tutorial MUST be written in English.';
  const profile = getBabyProfile();
  const ageStr = getAgeString(profile.age);

  const prompt = `
Provide a detailed, step-by-step cooking tutorial for a ${ageStr} toddler's meal: "${dishName}".
Main ingredients: ${ingredients.join(', ')}.

Requirements:
- The cooking method must be healthy (e.g., steaming, boiling, light sautéing).
- Ensure the texture is appropriate for a ${ageStr} toddler (soft, easy to chew).
- Mention any specific prep steps for toddlers (e.g., cutting grapes in half, removing bones).
- Do not use added salt or sugar.
- Format as Markdown.
- ${langInstruction}
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  return response.text || '';
}

export async function generateReport(timeframe: 'daily' | 'weekly', history: any[], language: 'zh' | 'en') {
  const langInstruction = language === 'zh' ? 'The report MUST be written in Chinese (Simplified).' : 'The report MUST be written in English.';

  const prompt = `
Analyze the following meal history for a 2-year-old toddler over the past ${timeframe} and provide a summary report.
History:
${JSON.stringify(history)}

Provide:
1. A summary of their eating habits (what they liked, what they rejected).
2. Nutritional insights (are they getting enough variety?).
3. Smart adjustments for future meals based on their rejections and acceptances.
Format as Markdown.
- ${langInstruction}
  `;

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  return response.text || '';
}
