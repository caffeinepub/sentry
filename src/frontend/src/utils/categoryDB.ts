export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}

const STORAGE_KEY = "sentry-categories";

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "grammar",
    name: "Grammar",
    color: "0.72 0.14 85",
    description: "Language rules and structure",
  },
  {
    id: "social-cues",
    name: "Social Cues",
    color: "0.65 0.16 50",
    description: "Social interaction patterns",
  },
  {
    id: "powers",
    name: "Powers",
    color: "0.6 0.18 300",
    description: "Abilities and capabilities",
  },
  {
    id: "occult",
    name: "Occult",
    color: "0.55 0.2 280",
    description: "Hidden knowledge and mysticism",
  },
  {
    id: "astral-projection",
    name: "Astral Projection",
    color: "0.6 0.15 260",
    description: "Out-of-body experiences",
  },
  {
    id: "zener-cards",
    name: "Zener Cards",
    color: "0.65 0.14 200",
    description: "ESP and psychic prediction",
  },
  {
    id: "prediction",
    name: "Prediction",
    color: "0.6 0.18 300",
    description: "Forecasting and foresight",
  },
  {
    id: "math",
    name: "Math",
    color: "0.65 0.16 220",
    description: "Mathematics and logic",
  },
  {
    id: "coding",
    name: "Coding",
    color: "0.6 0.14 200",
    description: "Programming and technology",
  },
  {
    id: "plants-herbs",
    name: "Plants & Herbs",
    color: "0.65 0.14 145",
    description: "Plant knowledge and herbalism",
  },
  {
    id: "health",
    name: "Mental/Physical Health",
    color: "0.65 0.16 160",
    description: "Wellness and medicine",
  },
  {
    id: "robotics",
    name: "Robotics/Electronics/Automotive",
    color: "0.6 0.14 210",
    description: "Engineering and mechanics",
  },
  {
    id: "futuristic-tech",
    name: "Futuristic Technology",
    color: "0.6 0.18 220",
    description: "Advanced future tech concepts",
  },
  {
    id: "general-projects",
    name: "General Projects",
    color: "0.65 0.14 85",
    description: "DIY and project management",
  },
  {
    id: "laws-rights",
    name: "Laws & Rights",
    color: "0.6 0.14 30",
    description: "Legal systems and civil rights",
  },
  {
    id: "taxes-budgeting",
    name: "Taxes & Budgeting",
    color: "0.65 0.14 60",
    description: "Finance and tax knowledge",
  },
  {
    id: "life-skills",
    name: "Life Skills",
    color: "0.65 0.14 85",
    description: "Practical everyday skills",
  },
  {
    id: "shapeshifting",
    name: "Shapeshifting",
    color: "0.6 0.2 300",
    description: "Transformation concepts",
  },
  {
    id: "psychological-engineering",
    name: "Psychological Engineering",
    color: "0.6 0.16 340",
    description: "Mind and behavior shaping",
  },
  {
    id: "world-code",
    name: "World Code",
    color: "0.6 0.18 260",
    description: "Reality structure and patterns",
  },
  {
    id: "creatures",
    name: "Creatures That Exist",
    color: "0.65 0.14 145",
    description: "Beings and entities",
  },
  {
    id: "business",
    name: "Business",
    color: "0.65 0.14 50",
    description: "Entrepreneurship and commerce",
  },
  {
    id: "music",
    name: "Music",
    color: "0.65 0.16 280",
    description: "Musical theory and practice",
  },
  {
    id: "singing",
    name: "Singing",
    color: "0.65 0.16 300",
    description: "Vocal techniques",
  },
  {
    id: "subliminal-making",
    name: "Subliminal Making",
    color: "0.55 0.18 280",
    description: "Subconscious audio/visual techniques",
  },
  {
    id: "homeowning",
    name: "Homeowning/Buying Land",
    color: "0.65 0.14 60",
    description: "Real estate and property",
  },
  {
    id: "hypnosis",
    name: "Hypnosis",
    color: "0.6 0.16 260",
    description: "Trance and suggestion techniques",
  },
];

export function getCategories(): Category[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

export function saveCategories(cats: Category[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
}

export function addCategory(name: string, description?: string): Category {
  const cats = getCategories();
  const newCat: Category = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    color: "0.72 0.14 85",
    description,
  };
  cats.push(newCat);
  saveCategories(cats);
  return newCat;
}

export function deleteCategory(id: string): void {
  const cats = getCategories().filter((c) => c.id !== id);
  saveCategories(cats);
}

export function updateCategory(
  id: string,
  updates: Partial<Omit<Category, "id">>,
): void {
  const cats = getCategories().map((c) =>
    c.id === id ? { ...c, ...updates } : c,
  );
  saveCategories(cats);
}
