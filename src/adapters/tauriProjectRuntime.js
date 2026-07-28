import { invoke as tauriInvoke, isTauri as detectTauri } from '@tauri-apps/api/core';

export function createTauriProjectRuntime({
  invoke = tauriInvoke,
  isTauri = detectTauri
} = {}) {
  if (!isTauri()) return null;

  return {
    fileSystem: {
      readText: (projectPath) => invoke('read_project_text', { projectPath }),
      writeTextAtomic: (
        projectPath,
        content,
        { backupLimit = 10 } = {}
      ) => invoke('write_project_text_atomic', {
        projectPath,
        content,
        backupLimit
      })
    },
    chooseOpenPath: () => invoke('choose_open_project_path'),
    chooseSavePath: ({ currentPath = null } = {}) => (
      invoke('choose_save_project_path', { currentPath })
    ),
    loadRecentPaths: () => invoke('load_recent_project_paths'),
    saveRecentPaths: (recentPaths) => invoke('save_recent_project_paths', { recentPaths })
  };
}
