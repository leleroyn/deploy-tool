import { create } from 'zustand';
import { Project, Task, SSHConfig } from '../types';
import { api } from '../api/http';

interface AppState {
  projects: Project[];
  tasks: Task[];
  sshConfig: SSHConfig | null;
  serverOnline: boolean;
  user: any | null;
  loadProjects: () => Promise<void>;
  loadTasks: () => Promise<void>;
  loadSSHConfig: () => Promise<void>;
  checkHealth: () => Promise<void>;
  setUser: (user: any | null) => void;
  updateTask: (task: Task) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  tasks: [],
  sshConfig: null,
  serverOnline: false,
  user: null,

  loadProjects: async () => {
    const res = await api.getProjects();
    if (res.success && res.data) {
      set({ projects: res.data });
    }
  },

  loadTasks: async () => {
    const res = await api.getTasks();
    if (res.success && res.data) {
      set({ tasks: res.data });
    }
  },

  loadSSHConfig: async () => {
    const res = await api.getSSHConfig();
    if (res.success && res.data) {
      set({ sshConfig: res.data });
    }
  },

  checkHealth: async () => {
    try {
      const res = await api.health();
      set({ serverOnline: res.success });
    } catch {
      set({ serverOnline: false });
    }
  },

  setUser: (user) => set({ user }),

  updateTask: (task: Task) => {
    const { tasks } = get();
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      const updated = [...tasks];
      updated[idx] = task;
      set({ tasks: updated });
    } else {
      set({ tasks: [task, ...tasks] });
    }
  },
}));
