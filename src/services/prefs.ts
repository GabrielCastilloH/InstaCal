import {
  PREF_KEY,
  DEFAULT_DURATION,
  DEFAULT_START_TIME,
  DEFAULT_LOCATION,
  DEFAULT_AVAILABILITY_START,
  DEFAULT_AVAILABILITY_END,
} from '../constants';

export interface Prefs {
  userName: string;
  autoReview: boolean;
  tasksAsAllDayEvents: boolean;
  smartDefaults: boolean;
  defaultDuration: number;
  defaultStartTime: string;
  defaultLocation: string;
  availabilityStart: string;
  availabilityEnd: string;
  notifyAttendees: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  userName: '',
  autoReview: true,
  tasksAsAllDayEvents: true,
  smartDefaults: true,
  defaultDuration: DEFAULT_DURATION,
  defaultStartTime: DEFAULT_START_TIME,
  defaultLocation: DEFAULT_LOCATION,
  availabilityStart: DEFAULT_AVAILABILITY_START,
  availabilityEnd: DEFAULT_AVAILABILITY_END,
  notifyAttendees: true,
};

export function loadPrefs(): Promise<Prefs> {
  return new Promise((resolve) => {
    chrome.storage.local.get([PREF_KEY], (result) => {
      resolve({ ...DEFAULT_PREFS, ...((result[PREF_KEY] as Partial<Prefs>) ?? {}) });
    });
  });
}

export function savePrefs(prefs: Prefs): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [PREF_KEY]: prefs }, resolve);
  });
}
