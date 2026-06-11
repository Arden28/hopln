import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { RouteSummary } from '../services/ai';

const storage = new MMKV();

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  route?: RouteSummary | null;
}

interface ChatState {
  messages: Message[];
  addMessage: (msg: Message) => void;
  clearHistory: () => void;
  loadHistory: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => {
    const updated = [...state.messages, msg];
    storage.set('kwame_history', JSON.stringify(updated));
    return { messages: updated };
  }),
  clearHistory: () => {
    storage.delete('kwame_history');
    set({ messages: [{ id: 'welcome', role: 'assistant', text: "Sasa! I'm Kwame, your Navigo guide. Where are we heading today?" }] });
  },
  loadHistory: (sessionId) => {
    const saved = storage.getString('kwame_history');
    if (saved) set({ messages: JSON.parse(saved) });
  }
}));