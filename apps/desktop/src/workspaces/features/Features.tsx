import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface FeatureCardProps {
  title: string;
  icon: string;
  badge?: string;
  description: string;
  color: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, icon, badge, description, color }) => (
  <div className="relative group overflow-hidden bg-surface-container/30 border border-outline-variant/30 hover:border-secondary/30 rounded-xl p-md backdrop-blur-xl transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_8px_30px_rgba(47,217,244,0.06)] flex flex-col justify-between h-48 select-none">
    {/* Glow effect */}
    <div className={`absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-all duration-300 ${color}`} />
    
    <div>
      <div className="flex justify-between items-start mb-sm">
        <div className="w-9 h-9 rounded-lg bg-surface-container-high/60 flex items-center justify-center border border-outline-variant/40 group-hover:border-secondary/20 transition-colors">
          <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
        </div>
        {badge && (
          <span className="bg-secondary/15 text-secondary border border-secondary/20 px-sm py-[2px] rounded-full text-label-caps font-bold">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-body-base font-bold text-on-surface font-headline-md tracking-tight group-hover:text-secondary transition-colors">
        {title}
      </h3>
      <p className="text-body-sm text-outline mt-xs leading-relaxed select-none">
        {description}
      </p>
    </div>
  </div>
);

export const Features: React.FC = () => {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);

  const featuresList = [
    {
      title: 'Unified Intelligence Router',
      icon: 'alt_route',
      badge: 'v2.0',
      description: 'Dynamically routes AI queries between local Ollama engines and cloud APIs based on target latency, cost efficiency, and accuracy rules.',
      color: 'text-secondary',
    },
    {
      title: 'Forge Code Workspace',
      icon: 'terminal',
      badge: 'IDE',
      description: 'Monaco-powered development environment with inline autocomplete, integrated shell runners, and live web preview annotation sharing.',
      color: 'text-primary',
    },
    {
      title: 'Artisan Visual Canvas',
      icon: 'palette',
      badge: 'Visual',
      description: 'Vector-like design interface offering generative palette creators, complementary layouts, and structural asset drafting.',
      color: 'text-tertiary',
    },
    {
      title: 'Loom Execution DAG',
      icon: 'hub',
      badge: 'Workflow',
      description: 'Visual workflow orchestrator allowing users to wire up trigger nodes, execution steps, and live debugging traces.',
      color: 'text-secondary-fixed-dim',
    },
    {
      title: 'Swarm Agents Registry',
      icon: 'groups',
      badge: 'Sandbox',
      description: 'Registry of specialized AI persona roles working in concurrent pipelines to solve complex system engineering tasks.',
      color: 'text-outline',
    },
    {
      title: 'Transient Key Security',
      icon: 'lock',
      badge: 'Secure',
      description: 'In-memory transient API key storage that clears completely on app close. Keys never touch your storage drive.',
      color: 'text-error',
    },
  ];

  const slides = [
    {
      title: 'Interactive Command Terminal Console',
      desc: 'Run arbitrary commands dynamically. Compile assets, run scripts, and manage dependencies directly inside the workspace.',
      preview: (
        <div className="bg-[#0b0b0e] border border-outline-variant/30 rounded-lg p-sm font-code-md text-[11px] leading-relaxed text-[#c4c3d4] flex flex-col h-full shadow-2xl">
          <div className="flex items-center justify-between pb-xs border-b border-outline-variant/20 mb-xs text-outline select-none">
            <span>Terminal console</span>
            <span className="material-symbols-outlined text-[14px]">terminal</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-xs font-semibold">
            <div><span className="text-secondary">PS AetherDesk ➜</span> git init</div>
            <div className="text-outline">Initialized empty Git repository in C:/Users/AetherDesk/.git/</div>
            <div><span className="text-secondary">PS AetherDesk ➜</span> npm install</div>
            <div className="text-secondary-fixed-dim">added 184 packages, and audited 185 packages in 3s</div>
            <div><span className="text-secondary">PS AetherDesk ➜</span> npm run dev</div>
            <div className="text-primary">➜  Local:   http://localhost:5173/</div>
          </div>
          <div className="flex items-center gap-xs pt-xs border-t border-outline-variant/20 select-none">
            <span className="text-secondary font-bold">AetherDesk ➜</span>
            <span className="text-on-surface animate-pulse font-bold">|</span>
          </div>
        </div>
      )
    },
    {
      title: 'OS-Native Telemetry & Diagnostics',
      desc: 'Keep track of real-time token speeds, execution latency, and network diagnostic metrics on every model run.',
      preview: (
        <div className="bg-[#0b0b0e] border border-outline-variant/30 rounded-lg p-sm text-[12px] text-[#c4c3d4] flex flex-col h-full justify-between shadow-2xl">
          <div className="flex items-center justify-between pb-xs border-b border-outline-variant/20 text-outline select-none">
            <span>Telemetry Dashboard</span>
            <span className="material-symbols-outlined text-[14px]">monitoring</span>
          </div>
          <div className="grid grid-cols-2 gap-sm my-sm">
            <div className="bg-surface-container/30 p-xs rounded border border-outline-variant/20">
              <div className="text-outline text-[9px] uppercase tracking-wider font-bold">Tokens / Sec</div>
              <div className="text-secondary font-bold font-code-md text-base">48.2 t/s</div>
            </div>
            <div className="bg-surface-container/30 p-xs rounded border border-outline-variant/20">
              <div className="text-outline text-[9px] uppercase tracking-wider font-bold">Latency</div>
              <div className="text-primary font-bold font-code-md text-base">640 ms</div>
            </div>
          </div>
          <div className="text-outline text-[10px] leading-relaxed">
            All models functioning within nominal boundaries. Live event bus wired successfully.
          </div>
        </div>
      )
    },
    {
      title: 'Generative Design Palettes',
      desc: 'Synthesize premium, matching CSS layouts and beautiful tailwind HSL palette configurations inside Artisan.',
      preview: (
        <div className="bg-[#0b0b0e] border border-outline-variant/30 rounded-lg p-sm text-[12px] text-[#c4c3d4] flex flex-col h-full justify-between shadow-2xl">
          <div className="flex items-center justify-between pb-xs border-b border-outline-variant/20 text-outline select-none">
            <span>Artisan Complementary Palette</span>
            <span className="material-symbols-outlined text-[14px]">palette</span>
          </div>
          <div className="flex gap-xs my-sm">
            <div className="flex-1 h-12 rounded bg-secondary flex items-center justify-center text-[10px] font-bold text-background shadow">#2fd9f4</div>
            <div className="flex-1 h-12 rounded bg-primary flex items-center justify-center text-[10px] font-bold text-background shadow">#c0c1ff</div>
            <div className="flex-1 h-12 rounded bg-tertiary flex items-center justify-center text-[10px] font-bold text-background shadow">#b9c8de</div>
            <div className="flex-1 h-12 rounded bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-outline shadow">#292932</div>
          </div>
          <div className="text-secondary text-[11px] font-bold text-center">
            Palette generated successfully in 230ms
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="flex-1 w-full h-full bg-background overflow-y-auto relative select-none pb-lg">
      {/* Background space glow */}
      <div className="absolute top-0 left-1/4 right-1/4 h-[500px] bg-[radial-gradient(circle_at_center,rgba(47,217,244,0.06)_0%,transparent_70%)] pointer-events-none z-0" />
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-[radial-gradient(circle_at_center,rgba(192,193,255,0.04)_0%,transparent_70%)] pointer-events-none z-0" />

      <div className="max-w-5xl mx-auto px-lg pt-xl relative z-10 space-y-xl">
        
        {/* Banner / Header */}
        <div className="text-center space-y-sm flex flex-col items-center">
          <div className="inline-flex items-center gap-xs bg-secondary/15 text-secondary border border-secondary/20 px-md py-1 rounded-full text-label-caps font-bold tracking-wider animate-pulse shadow-[0_0_15px_rgba(47,217,244,0.15)]">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            AETHER DESK v2.0 RELEASE
          </div>
          <h1 className="text-display-lg font-bold text-on-surface leading-tight tracking-tight font-headline-md max-w-xl">
            Welcome to <span className="bg-gradient-to-r from-secondary via-primary to-secondary bg-clip-text text-transparent filter drop-shadow-[0_0_10px_rgba(47,217,244,0.1)]">Aether Desk 2.0</span>
          </h1>
          <p className="text-body-base text-outline max-w-xl leading-relaxed select-none">
            An advanced AI-first desktop suite designed for professional engineers. Complete with local execution sandboxes, workflow automation DAGs, and multi-agent persona registries.
          </p>
          <div className="flex gap-md pt-sm">
            <button
              onClick={() => navigate('/forge')}
              className="bg-primary text-on-primary font-bold text-label-caps px-lg py-sm rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">terminal</span> Launch Forge IDE
            </button>
            <button
              onClick={() => navigate('/nexus')}
              className="bg-surface-container border border-outline-variant px-lg py-sm rounded-lg text-label-caps font-bold text-[#e4e3f4] hover:border-secondary transition-all active:scale-95 flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">smart_toy</span> Chat in Nexus
            </button>
          </div>
        </div>

        {/* Feature Showcase Grid */}
        <div className="space-y-md">
          <div className="flex justify-between items-end border-b border-outline-variant/20 pb-sm">
            <div>
              <h2 className="text-title-sm font-bold text-[#e4e3f4] font-headline-md tracking-tight">Core Workspace Modules</h2>
              <p className="text-body-sm text-outline select-none mt-xs">Explore the primary suites built into Aether Desk.</p>
            </div>
            <span className="text-label-caps text-secondary font-bold">ALL NOMINAL</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            {featuresList.map(feat => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>
        </div>

        {/* Interactive Feature Deep Dive (Slide Carousel) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-xl bg-surface-container-low/40 border border-outline-variant/30 rounded-2xl p-lg backdrop-blur-xl relative">
          <div className="md:col-span-5 flex flex-col justify-between h-72">
            <div>
              <div className="inline-block text-[10px] font-bold text-secondary tracking-widest uppercase mb-xs">Interactive Deep Dive</div>
              <h3 className="text-title-sm font-bold text-on-surface font-headline-md leading-tight">
                {slides[activeSlide].title}
              </h3>
              <p className="text-body-sm text-outline mt-sm leading-relaxed select-none">
                {slides[activeSlide].desc}
              </p>
            </div>
            <div className="flex gap-sm select-none">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeSlide === index ? 'w-8 bg-secondary' : 'w-2 bg-outline-variant'
                  }`}
                  title={`Slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="md:col-span-7 h-72 rounded-xl border border-outline-variant/20 bg-surface-container-lowest/80 p-md flex flex-col justify-between overflow-hidden shadow-inner select-none relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#13131b]/10 to-[#2fd9f4]/5 pointer-events-none" />
            <div className="flex-1 min-h-0 relative z-10">
              {slides[activeSlide].preview}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
