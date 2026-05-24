import React from 'react';
import { SideNavBar } from './SideNavBar';
import { TopAppBar } from './TopAppBar';
import { BottomNavBar } from './BottomNavBar';
import { DiffReviewOverlay } from './DiffReviewOverlay';
import { AgentApprovalOverlay } from '../../workspaces/nexus/AgentApprovalOverlay';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '../../core/store/useUiStore';


export const Layout: React.FC = () => {
  const { isSidebarOpen } = useUiStore();

  return (
    <div className="flex flex-col h-screen w-screen font-body-base overflow-hidden bg-background text-on-surface dark">
      <TopAppBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {isSidebarOpen && <SideNavBar />}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Outlet />
        </main>
      </div>
      <BottomNavBar />
      <DiffReviewOverlay />
      <AgentApprovalOverlay />
    </div>
  );
};
