import { PEOPLE_KEY, MAX_PEOPLE } from '../constants';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lastUsed: number;
}

export function loadPeople(): Promise<Person[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([PEOPLE_KEY], (result) => {
      resolve((result[PEOPLE_KEY] as Person[] | undefined) ?? []);
    });
  });
}

export function savePeople(people: Person[]): Promise<void> {
  const sorted = [...people].sort((a, b) => b.lastUsed - a.lastUsed);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [PEOPLE_KEY]: sorted }, resolve);
  });
}

/** Add a new person or update lastUsed if already present by email. Evicts LRU if at capacity. */
export function upsertPerson(people: Person[], name: string, email: string): Person[] {
  const existingIdx = people.findIndex((p) => p.email.toLowerCase() === email.toLowerCase());
  if (existingIdx !== -1) {
    return people.map((p, i) => (i === existingIdx ? { ...p, lastUsed: Date.now() } : p));
  }
  const [firstName, ...rest] = name.trim().split(' ');
  const newPerson: Person = {
    id: crypto.randomUUID(),
    firstName: firstName ?? name,
    lastName: rest.join(' '),
    email,
    lastUsed: Date.now(),
  };
  const updated = [...people];
  if (updated.length >= MAX_PEOPLE) {
    const lruIdx = updated.reduce((min, p, i) => (p.lastUsed < updated[min].lastUsed ? i : min), 0);
    updated.splice(lruIdx, 1);
  }
  updated.push(newPerson);
  return updated;
}
