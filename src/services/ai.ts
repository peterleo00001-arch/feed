import { db } from "../db";

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DASHSCOPE_TTS_URL =
  process.env.DASHSCOPE_TTS_URL ||
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen-plus";
const QWEN_TTS_MODEL = "qwen3-tts-flash";

function getApiKey() {
  if (!DASHSCOPE_API_KEY) {
    throw new Error("Missing DASHSCOPE_API_KEY. Please set it in your environment.");
  }
  return DASHSCOPE_API_KEY;
}

async function callQwenChat(prompt: string) {
  const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DashScope chat error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return (data?.choices?.[0]?.message?.content || "") as string;
}

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
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
- Each meal MUST include "mealType" and it MUST be one of: "breakfast", "lunch", "snack", "dinner".
- ${langInstruction}
  `;

  try {
    const text = await callQwenChat(prompt);
    const data = extractJson(text) || {};
    const meals = Array.isArray(data.meals) ? data.meals : [];
    const defaultTypes = ['breakfast', 'lunch', 'snack', 'dinner'];
    return meals.map((meal: any, index: number) => {
      const rawType = typeof meal?.mealType === 'string' ? meal.mealType : '';
      const lowered = rawType.toLowerCase();
      const normalized =
        ['breakfast', '早餐', '早饭', '早飯'].includes(rawType) || lowered === 'breakfast'
          ? 'breakfast'
          : ['lunch', '午餐', '午饭', '午飯'].includes(rawType) || lowered === 'lunch'
          ? 'lunch'
          : ['snack', '加餐', '点心', '點心'].includes(rawType) || lowered === 'snack'
          ? 'snack'
          : ['dinner', '晚餐', '晚饭', '晚飯'].includes(rawType) || lowered === 'dinner'
          ? 'dinner'
          : defaultTypes[index] || 'breakfast';
      return {
        ...meal,
        mealType: normalized,
        dishName: typeof meal?.dishName === 'string' ? meal.dishName : '',
        ingredients: Array.isArray(meal?.ingredients) ? meal.ingredients : []
      };
    });
  } catch (e) {
    console.error("Failed to generate meal plan", e);
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
- The response MUST include "mealType" and it MUST equal "${mealType}".
- ${langInstruction}
  `;

  try {
    const text = await callQwenChat(prompt);
    return extractJson(text);
  } catch (e) {
    console.error("Failed to generate single meal", e);
    return null;
  }
}

export async function generateAudio(text: string, language: 'zh' | 'en') {
  try {
    const response = await fetch(DASHSCOPE_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: QWEN_TTS_MODEL,
        input: {
          text,
          voice: "Cherry",
          language_type: language === "zh" ? "Chinese" : "English",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DashScope TTS error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data?.output?.audio?.url || null;
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

  try {
    return await callQwenChat(prompt);
  } catch (e) {
    console.error("Failed to generate tutorial", e);
    return '';
  }
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

  try {
    return await callQwenChat(prompt);
  } catch (e) {
    console.error("Failed to generate report", e);
    return '';
  }
}
