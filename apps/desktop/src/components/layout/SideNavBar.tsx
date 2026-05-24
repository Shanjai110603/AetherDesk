import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/nexus',    icon: 'smart_toy',       title: 'Intelligence' },
  { to: '/forge',    icon: 'terminal',         title: 'Forge' },
  { to: '/artisan',  icon: 'design_services',  title: 'Artisan' },
  { to: '/browser',  icon: 'language',         title: 'Browser' },
  { to: '/loom',     icon: 'hub',              title: 'Loom' },
  { to: '/swarm',    icon: 'groups',           title: 'Swarm Registry' },
];

const NavItem: React.FC<{ to: string; icon: string; title: string }> = ({ to, icon, title }) => (
  <NavLink
    to={to}
    title={title}
    className={({ isActive }) =>
      `relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 group
       ${isActive
         ? 'bg-secondary/15 text-secondary-fixed-dim shadow-[inset_0_0_0_1px_rgba(192,193,255,0.25)]'
         : 'text-outline hover:text-on-surface-variant hover:bg-surface-container-high'
       }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-secondary-fixed-dim" />
        )}
        <span className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
          {icon}
        </span>
      </>
    )}
  </NavLink>
);

export const SideNavBar: React.FC = () => {
  return (
    <aside className="bg-surface-dim h-full w-[52px] border-r border-outline-variant flex flex-col items-center py-3 gap-1 flex-shrink-0 overflow-hidden z-10">
      {/* Logo */}
      <div className="w-9 h-9 flex items-center justify-center mb-3 flex-shrink-0">
        <span
          className="material-symbols-outlined text-secondary-fixed-dim"
          style={{ fontSize: '26px', fontVariationSettings: "'FILL' 1" }}
        >
          smart_toy
        </span>
      </div>

      {/* Primary Nav */}
      <nav className="flex flex-col gap-1 flex-grow w-full items-center">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Bottom utilities */}
      <div className="flex flex-col gap-1 pb-1">
        <NavLink
          to="/features"
          title="What's New in 2.0"
          className={({ isActive }) =>
            `w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150
             ${isActive ? 'bg-secondary/15 text-secondary-fixed-dim shadow-[inset_0_0_0_1px_rgba(192,193,255,0.25)]' : 'text-outline hover:text-on-surface-variant hover:bg-surface-container-high'}`
          }
        >
          <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
        </NavLink>
        <NavLink
          to="/settings"
          title="Settings"
          className={({ isActive }) =>
            `w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150
             ${isActive ? 'bg-secondary/15 text-secondary-fixed-dim' : 'text-outline hover:text-on-surface-variant hover:bg-surface-container-high'}`
          }
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </NavLink>
        <NavLink
          to="/settings"
          title="Profile"
          className={({ isActive }) =>
            `w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150
             ${isActive ? 'bg-secondary/15 text-secondary-fixed-dim' : 'text-outline hover:text-on-surface-variant hover:bg-surface-container-high'}`
          }
        >
          <span className="material-symbols-outlined text-[20px]">account_circle</span>
        </NavLink>
      </div>
    </aside>
  );
};
