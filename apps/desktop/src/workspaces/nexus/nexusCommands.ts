export interface SlashCommand {
  id: 'agent' | 'read' | 'run' | 'clear' | 'search' | 'model';
  icon: string;
  label: string;
  description: string;
  insert: string;
  color: string;
}

export const NEXUS_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'agent',
    icon: 'smart_toy',
    label: '/agent',
    description: 'Delegate the next request to a Swarm persona',
    insert: '/agent ',
    color: '#8b5cf6',
  },
  {
    id: 'read',
    icon: 'folder_open',
    label: '/read',
    description: 'Attach a workspace file as hidden context',
    insert: '/read ',
    color: '#2fd9f4',
  },
  {
    id: 'run',
    icon: 'terminal',
    label: '/run',
    description: 'Run a command and append its output',
    insert: '/run ',
    color: '#4ade80',
  },
  {
    id: 'clear',
    icon: 'delete_sweep',
    label: '/clear',
    description: 'Clear messages in the current session',
    insert: '/clear',
    color: '#f87171',
  },
  {
    id: 'search',
    icon: 'manage_search',
    label: '/search',
    description: 'Add a research-focused prompt',
    insert: '/search ',
    color: '#f59e0b',
  },
  {
    id: 'model',
    icon: 'tune',
    label: '/model',
    description: 'Open the model picker',
    insert: '/model',
    color: '#a78bfa',
  },
];
