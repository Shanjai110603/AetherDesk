import React, { useEffect, useState } from 'react';
import { diagnosticsService, DiagnosticsResult } from '../../core/services/EnvironmentDiagnosticsService';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';
import { CheckCircle, XCircle, Loader2, Sparkles, Folder, ArrowRight } from 'lucide-react';

export function OnboardingFlow() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { completeOnboarding } = useWorkspaceStore();

  useEffect(() => {
    async function runChecks() {
      const result = await diagnosticsService.runDiagnostics();
      setDiagnostics(result);
      setLoading(false);
    }
    runChecks();
  }, []);

  if (loading || !diagnostics) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center text-white z-[9999]">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-xl font-medium text-gray-300">Initializing AetherDesk...</h2>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center text-white z-[9999] overflow-y-auto py-12">
      <div className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl p-8 shadow-2xl">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Welcome to AetherDesk</h1>
          <p className="text-gray-400">The AI-Native Operating Environment for Software Engineering.</p>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4 text-gray-200">System Diagnostics</h3>
          <div className="space-y-3">
            <DiagnosticItem 
              name="Node.js" 
              available={diagnostics.hasNode} 
              version={diagnostics.nodeVersion} 
              required={true} 
            />
            <DiagnosticItem 
              name="Python" 
              available={diagnostics.hasPython} 
              version={diagnostics.pythonVersion} 
              required={false} 
            />
            <DiagnosticItem 
              name="Git" 
              available={diagnostics.hasGit} 
              version={diagnostics.gitVersion} 
              required={true} 
            />
            <DiagnosticItem 
              name="Ollama (Local AI)" 
              available={diagnostics.hasOllama} 
              version={diagnostics.ollamaVersion} 
              required={false} 
            />
          </div>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5 mb-8 flex items-start gap-4">
          <Folder className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-indigo-300 mb-1">Create your first Workspace</h4>
            <p className="text-sm text-indigo-200/70 mb-3">AetherDesk organizes your projects into Nexus workspaces where agents can collaborate securely.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={completeOnboarding}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Launch AetherDesk
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DiagnosticItem({ name, available, version, required }: { name: string, available: boolean, version?: string, required: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
      <div className="flex items-center gap-3">
        {available ? (
          <CheckCircle className="w-5 h-5 text-emerald-500" />
        ) : (
          <XCircle className={`w-5 h-5 ${required ? 'text-red-500' : 'text-amber-500'}`} />
        )}
        <span className="font-medium text-gray-300">{name}</span>
        {required && <span className="text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-gray-400">Required</span>}
      </div>
      <div className="text-sm text-gray-500 font-mono">
        {available ? version : (required ? 'Missing - Please Install' : 'Optional')}
      </div>
    </div>
  );
}
