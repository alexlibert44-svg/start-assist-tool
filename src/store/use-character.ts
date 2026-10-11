import { create } from 'zustand';
import larryPortrait from '@/assets/larry.jpg.asset.json';
import senseiPortrait from '@/assets/sensei.jpg.asset.json';
import drNeoPortrait from '@/assets/dr-neo.png.asset.json';
import hassanPortrait from '@/assets/hassan.png.asset.json';

export type CharacterId = 'Larry' | 'Sensei' | 'Dr Neo' | 'Hassan';

export interface Character {
  id: CharacterId;
  name: string;
  role: string;
  colorName: string;
  image: string;
  theme: {
    gradient: string;
    chatBubble: string;
    glow: string;
    text: string;
    border: string;
  };
}

export const WELCOME_MESSAGES: Record<CharacterId, string> = {
  'Larry': "Welcome. I'm Larry, and I lead this organization dedicated to helping you reclaim your time and focus. Together with Sensei, Dr. Neo, and Hassan, we're here to guide you. What brings you here today?",
  'Sensei': "Welcome. I'm Sensei. My role is to guide you through knowledge, learning, and intellectual growth. What would you like to explore today?",
  'Dr Neo': "Hello. I'm Dr. Neo. I'm here to help you understand your mind, mental clarity, and the effects of technology on your brain. How are you feeling today?",
  'Hassan': "Hi. I'm Hassan. I'm here to help you build strength, energy, and discipline through physical activity and healthy habits. Are you ready to begin?"
};

export const CHARACTERS: Record<CharacterId, Character> = {
  'Larry': {
    id: 'Larry',
    name: 'Larry',
    role: 'Main guide and coordinator',
    colorName: 'purple',
    image: larryPortrait.url,
    theme: {
      gradient: 'from-purple-600 to-indigo-600',
      chatBubble: 'bg-gradient-to-br from-purple-600/30 to-indigo-600/30 backdrop-blur-xl',
      glow: 'shadow-purple-500/25',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
    }
  },
  'Sensei': {
    id: 'Sensei',
    name: 'Sensei',
    role: 'Wise teacher for learning & knowledge',
    colorName: 'sky blue',
    image: senseiPortrait.url,
    theme: {
      gradient: 'from-sky-400 to-blue-600',
      chatBubble: 'bg-gradient-to-br from-sky-500/30 to-blue-600/30 backdrop-blur-xl',
      glow: 'shadow-sky-500/25',
      text: 'text-sky-400',
      border: 'border-sky-500/30',
    }
  },
  'Dr Neo': {
    id: 'Dr Neo',
    name: 'Dr Neo',
    role: 'Mental clarity & brain health advisor',
    colorName: 'deep navy blue',
    image: drNeoPortrait.url,
    theme: {
      gradient: 'from-blue-800 to-indigo-900',
      chatBubble: 'bg-gradient-to-br from-blue-700/30 to-indigo-800/30 backdrop-blur-xl',
      glow: 'shadow-blue-600/25',
      text: 'text-blue-400',
      border: 'border-blue-700/30',
    }
  },
  'Hassan': {
    id: 'Hassan',
    name: 'Hassan',
    role: 'Physical health & fitness motivator',
    colorName: 'green',
    image: hassanPortrait.url,
    theme: {
      gradient: 'from-emerald-400 to-green-600',
      chatBubble: 'bg-gradient-to-br from-emerald-500/30 to-green-600/30 backdrop-blur-xl',
      glow: 'shadow-emerald-500/25',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    }
  }
};

interface CharacterStore {
  activeCharacterId: CharacterId;
  setActiveCharacter: (id: CharacterId) => void;
  getActiveCharacter: () => Character;
  // Request handed from one character to another; the target chat auto-sends it
  pendingHandoff: { to: CharacterId; from: CharacterId; question: string; conversationId: string } | null;
  handoff: (from: CharacterId, to: CharacterId, question: string, conversationId: string) => void;
  clearHandoff: () => void;
}

export const useCharacter = create<CharacterStore>((set, get) => ({
  activeCharacterId: 'Larry',
  setActiveCharacter: (id) => set({ activeCharacterId: id }),
  getActiveCharacter: () => CHARACTERS[get().activeCharacterId],
  pendingHandoff: null,
  handoff: (from, to, question, conversationId) => set({ pendingHandoff: { from, to, question, conversationId }, activeCharacterId: to }),
  clearHandoff: () => set({ pendingHandoff: null }),
}));
