import create from 'zustand';

type Workspace = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
};

type WorkspaceState = {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  setWorkspaces: (ws: Workspace[]) => void;
  setCurrentWorkspace: (id: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  currentWorkspaceId: null,
  setWorkspaces: (ws) => set({ workspaces: ws }),
  setCurrentWorkspace: (id) => set({ currentWorkspaceId: id })
}));
