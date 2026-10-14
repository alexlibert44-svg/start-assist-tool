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
      gradient: 'agent-larry from-agent to-agent agent-gradient',
      chatBubble: 'agent-larry agent-glass',
      glow: 'agent-larry agent-glow',
      text: 'agent-larry text-agent-ink',
      border: 'agent-larry border-agent/40',
    }
  },
  'Sensei': {
    id: 'Sensei',
    name: 'Sensei',
    role: 'Wise teacher for learning & knowledge',
    colorName: 'sky blue',
    image: senseiPortrait.url,
    theme: {
      gradient: 'agent-sensei from-agent to-agent agent-gradient',
      chatBubble: 'agent-sensei agent-glass',
      glow: 'agent-sensei agent-glow',
      text: 'agent-sensei text-agent-ink',
      border: 'agent-sensei border-agent/40',
    }
  },
  'Dr Neo': {
    id: 'Dr Neo',
    name: 'Dr Neo',
    role: 'Mental clarity & brain health advisor',
    colorName: 'deep navy blue',
    image: drNeoPortrait.url,
    theme: {
      gradient: 'agent-neo from-agent to-agent agent-gradient',
      chatBubble: 'agent-neo agent-glass',
      glow: 'agent-neo agent-glow',
      text: 'agent-neo text-agent-ink',
      border: 'agent-neo border-agent/40',
    }
  },
  'Hassan': {
    id: 'Hassan',
    name: 'Hassan',
    role: 'Physical health & fitness motivator',
    colorName: 'green',
    image: hassanPortrait.url,
    theme: {
      gradient: 'agent-hassan from-agent to-agent agent-gradient',
      chatBubble: 'agent-hassan agent-glass',
      glow: 'agent-hassan agent-glow',
      text: 'agent-hassan text-agent-ink',
      border: 'agent-hassan border-agent/40',
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
