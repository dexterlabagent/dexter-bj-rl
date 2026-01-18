'use client';
import { Character } from '@repo/shared/types';
import Dexie, { Table } from 'dexie';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

class CharactersDatabase extends Dexie {
    characters!: Table<Character>;
    constructor() {
        super('CharactersDatabase');
        this.version(1).stores({
            characters: 'id, createdAt',
        });
    }
}

let db: CharactersDatabase;
if (typeof window !== 'undefined') {
    db = new CharactersDatabase();
}

type State = {
    characters: Character[];
    isLoaded: boolean;
};

type Actions = {
    loadCharacters: () => Promise<void>;
    createCharacter: (character: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Character>;
    updateCharacter: (id: string, updates: Partial<Omit<Character, 'id' | 'createdAt'>>) => Promise<void>;
    deleteCharacter: (id: string) => Promise<void>;
};

export const useCharactersStore = create<State & Actions>()(
    immer((set, get) => ({
        characters: [],
        isLoaded: false,

        loadCharacters: async () => {
            if (!db) return;
            const characters = await db.characters.orderBy('createdAt').reverse().toArray();
            set(state => {
                state.characters = characters;
                state.isLoaded = true;
            });
        },

        createCharacter: async (data) => {
            const character: Character = {
                ...data,
                id: nanoid(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            if (db) await db.characters.add(character);
            set(state => {
                state.characters.unshift(character);
            });
            return character;
        },

        updateCharacter: async (id, updates) => {
            const updated = { ...updates, updatedAt: new Date() };
            if (db) await db.characters.update(id, updated);
            set(state => {
                const idx = state.characters.findIndex(c => c.id === id);
                if (idx !== -1) Object.assign(state.characters[idx], updated);
            });
        },

        deleteCharacter: async (id) => {
            if (db) await db.characters.delete(id);
            set(state => {
                state.characters = state.characters.filter(c => c.id !== id);
            });
        },
    }))
);
