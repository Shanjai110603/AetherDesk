import React, { useState, useEffect } from 'react';
import { SideNavBar } from './SideNavBar';
import { TopAppBar } from './TopAppBar';
import { BottomNavBar } from './BottomNavBar';
import { CommandPalette } from '../command-palette/CommandPalette';
import { Outlet } from 'react-router-dom';
import { AgentApprovalOverlay } from '../../workspaces/nexus/AgentApprovalOverlay';

export const Layout: React.FC = () => {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen font-body-base overflow-hidden bg-background text-on-surface dark">
      <TopAppBar onCommandPaletteOpen={() => setIsPaletteOpen(true)} />
      
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <SideNavBar />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Outlet />
        </main>
      </div>

      <BottomNavBar />
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      <AgentApprovalOverlay />
    </div>
  );
};
