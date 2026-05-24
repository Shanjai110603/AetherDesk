import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useFilesystemStore } from '../../core/store/useFilesystemStore';

export const BuildDeployOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [target, setTarget] = useState<'windows' | 'android' | 'web'>('windows');
  const [framework, setFramework] = useState<'tauri' | 'capacitor' | 'react-native' | 'gradle' | 'custom'>('tauri');
  const [customCommand, setCustomCommand] = useState('npm run tauri build');
  const [isBuilding, setIsBuilding] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { activeFolderPath } = useFilesystemStore();

  useEffect(() => {
    // Auto-update default commands when target/framework changes
    if (framework !== 'custom') {
      if (target === 'windows' && framework === 'tauri') setCustomCommand('npm run tauri build');
      else if (target === 'android' && framework === 'tauri') setCustomCommand('npm run tauri android build');
      else if (target === 'android' && framework === 'capacitor') setCustomCommand('npx cap build android');
      else if (target === 'android' && framework === 'react-native') setCustomCommand('npx react-native run-android --variant=release');
      else if (target === 'android' && framework === 'gradle') setCustomCommand('./gradlew assembleDebug');
      else if (target === 'web') setCustomCommand('npm run build');
      else setCustomCommand('');
    }
  }, [target, framework]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleBuild = async () => {
    if (!activeFolderPath) {
      alert("No active workspace found.");
      return;
    }
    
    if (isBuilding) return;
    setIsBuilding(true);
    setLogs([`Starting build targeting ${target.toUpperCase()} using ${framework}...`, `Command: ${customCommand}`, `Directory: ${activeFolderPath}`, '---']);
    
    let unlisten: UnlistenFn | null = null;
    try {
      unlisten = await listen<string>('build-log', (event) => {
        setLogs(prev => [...prev, event.payload]);
      });

      await invoke('execute_build_command', { 
        command: customCommand,
        cwd: activeFolderPath
      });

      setLogs(prev => [...prev, '---', 'Build command completed.']);
    } catch (e) {
      setLogs(prev => [...prev, '---', `Error: ${e}`]);
    } finally {
      setIsBuilding(false);
      if (unlisten) unlisten();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="flex flex-col bg-surface-container-low border border-outline-variant rounded-xl shadow-2xl overflow-hidden w-full max-w-3xl"
        style={{ height: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">rocket_launch</span>
            <h2 className="text-title-lg font-bold text-on-surface">Universal Build & Deploy</h2>
          </div>
          <button onClick={onClose} className="material-symbols-outlined text-outline hover:text-on-surface">close</button>
        </div>

        {/* Configuration Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Settings Panel */}
          <div className="w-1/3 p-6 flex flex-col gap-6 border-r border-outline-variant overflow-y-auto bg-surface-container-lowest">
            <div>
              <label className="block text-label-caps text-outline mb-3 tracking-widest">Target Platform</label>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'windows', icon: 'desktop_windows', label: 'Windows (.exe)' },
                  { id: 'android', icon: 'android', label: 'Android (.apk)' },
                  { id: 'web', icon: 'language', label: 'Web (Dist)' }
                ].map(p => (
                  <button key={p.id} onClick={() => setTarget(p.id as any)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                      target === p.id 
                        ? 'border-secondary bg-secondary/10 text-secondary-fixed-dim shadow-[0_0_12px_rgba(47,217,244,0.15)]' 
                        : 'border-outline-variant text-on-surface-variant hover:border-outline hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined">{p.icon}</span>
                    <span className="font-semibold text-body-md">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-label-caps text-outline mb-3 tracking-widest">Build Framework</label>
              <select 
                value={framework} 
                onChange={e => setFramework(e.target.value as any)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-body-base text-on-surface focus:border-secondary outline-none appearance-none"
              >
                <option value="tauri">Tauri (Native Rust wrapper)</option>
                <option value="capacitor">Capacitor (Web to Native)</option>
                <option value="react-native">React Native</option>
                <option value="gradle">Native Android (Gradle)</option>
                <option value="custom">Custom Command</option>
              </select>
            </div>

            <div>
              <label className="block text-label-caps text-outline mb-3 tracking-widest">Build Command</label>
              <input 
                type="text" 
                value={customCommand} 
                onChange={e => { setCustomCommand(e.target.value); setFramework('custom'); }}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-body-sm font-mono text-secondary-fixed-dim focus:border-secondary outline-none"
                placeholder="npm run build"
              />
            </div>

            <div className="mt-auto pt-4 border-t border-outline-variant">
              <button 
                onClick={handleBuild}
                disabled={isBuilding || !activeFolderPath}
                className={`w-full flex justify-center items-center gap-2 py-3 rounded-lg font-bold text-body-base transition-colors ${
                  isBuilding 
                    ? 'bg-surface-container-highest text-outline cursor-not-allowed' 
                    : 'bg-secondary text-on-secondary hover:bg-[#1fb5cd]'
                }`}
              >
                <span className={`material-symbols-outlined ${isBuilding ? 'animate-spin' : ''}`}>
                  {isBuilding ? 'sync' : 'build'}
                </span>
                {isBuilding ? 'BUILDING...' : 'START BUILD'}
              </button>
              {!activeFolderPath && (
                <p className="text-error text-label-sm mt-2 text-center">No active workspace folder.</p>
              )}
            </div>
          </div>

          {/* Right Terminal Panel */}
          <div className="w-2/3 bg-black flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-10 bg-black/80 backdrop-blur-md flex items-center px-4 border-b border-white/10 z-10">
              <span className="text-label-caps text-outline tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Build Output
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-14 font-mono text-[13px] leading-relaxed text-[#c4c3d4]">
              {logs.length === 0 ? (
                <div className="text-outline text-center mt-20 italic">
                  Select your target and framework, then click Start Build to begin.
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {log.includes('Error') || log.includes('failed') || log.includes('ERR!') ? (
                      <span className="text-error">{log}</span>
                    ) : log.includes('success') || log.includes('Done') || log.includes('Built') ? (
                      <span className="text-green-400 font-bold">{log}</span>
                    ) : (
                      log
                    )}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
