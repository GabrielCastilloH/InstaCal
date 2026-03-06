import { useState, useEffect } from 'react';
import { loadPeople, savePeople, upsertPerson, type Person } from '../utils/people';

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    loadPeople().then(setPeople);
  }, []);

  async function addPerson(name: string, email: string): Promise<void> {
    const updated = upsertPerson(people, name, email);
    setPeople(updated);
    await savePeople(updated);
  }

  return { people, addPerson };
}
