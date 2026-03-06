import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { type Person, loadPeople, savePeople } from '../utils/people'
import { MAX_PEOPLE } from '../constants'

export async function loadPeopleFromFirestore(uid: string): Promise<Person[]> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return []
  return (snap.data().people as Person[] | undefined) ?? []
}

export async function savePeopleToFirestore(uid: string, people: Person[]): Promise<void> {
  const ref = doc(db, 'users', uid)
  await setDoc(ref, { people }, { merge: true })
}

/**
 * On popup init: merge Firestore people with local chrome.storage people,
 * write the merged list back to both stores, and return it.
 */
export async function syncPeopleOnInit(uid: string): Promise<Person[]> {
  const [local, remote] = await Promise.all([
    loadPeople(),
    loadPeopleFromFirestore(uid).catch(() => [] as Person[]),
  ])

  if (remote.length === 0 && local.length === 0) return []

  // Merge by email — prefer the entry with the higher lastUsed timestamp
  const byEmail = new Map<string, Person>()
  for (const p of [...remote, ...local]) {
    const key = p.email.toLowerCase()
    const existing = byEmail.get(key)
    if (!existing || p.lastUsed > existing.lastUsed) {
      byEmail.set(key, p)
    }
  }

  const merged = [...byEmail.values()]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_PEOPLE)

  await Promise.all([
    savePeople(merged),
    savePeopleToFirestore(uid, merged).catch(() => {}),
  ])

  return merged
}
