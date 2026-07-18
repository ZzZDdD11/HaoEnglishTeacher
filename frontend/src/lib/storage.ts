import type { GuestRecord } from "@/types";

const STORAGE_KEY = "shadowing_guest";

export const guestStorage = {
  getAll(): GuestRecord {
    if (typeof window === "undefined") return { material_ids: [], session_ids: [] };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { material_ids: [], session_ids: [] };
    try {
      return JSON.parse(raw);
    } catch {
      return { material_ids: [], session_ids: [] };
    }
  },

  addMaterial(id: string) {
    const data = this.getAll();
    if (!data.material_ids.includes(id)) {
      data.material_ids.push(id);
    }
    this._save(data);
  },

  addSession(id: string) {
    const data = this.getAll();
    if (!data.session_ids.includes(id)) {
      data.session_ids.push(id);
    }
    this._save(data);
  },

  _save(data: GuestRecord) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
