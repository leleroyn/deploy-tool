import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useProjects() {
  const { projects, loadProjects } = useAppStore();

  useEffect(() => {
    loadProjects();
  }, []);

  return { projects, reload: loadProjects };
}
