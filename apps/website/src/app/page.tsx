"use client";

import { motion } from "framer-motion";
import DownloadButton from "../components/ui/DownloadButton";
import { Globe as GithubIcon, Play, Layers, Code, Brain, Network, Terminal } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col items-center">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background -z-10" />
      <div className="absolute top-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent blur-[100px] -z-10" />

      {/* Navbar */}
      <nav className="w-full max-w-7xl flex items-center justify-between p-6 z-10 glass rounded-b-2xl mb-12">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white">A</div>
          <span className="text-xl font-bold tracking-tight">AetherDesk</span>
        </div>
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#orchestration" className="hover:text-white transition-colors">Orchestration</a>
          <a href="#security" className="hover:text-white transition-colors">Local-First</a>
        </div>
        <div className="flex items-center space-x-4">
          <a href="https://github.com/Shanjai110603/AetherDesk" target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white transition-colors">
            <GithubIcon className="w-6 h-6" />
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="w-full max-w-7xl flex flex-col items-center justify-center text-center px-4 pt-20 pb-32 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-block mb-4 px-4 py-1.5 rounded-full glass border-indigo-500/30 text-indigo-300 text-sm font-medium"
        >
          v1.0.0 Production Release Now Available
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8"
        >
          The <span className="text-gradient">AI-Native</span> <br className="hidden md:block" />
          Operating Environment
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-lg md:text-xl text-gray-400 max-w-3xl mb-12"
        >
          Where AI agents build software together. AetherDesk combines a semantic AI IDE, 
          advanced visual building, and runtime orchestration into one premium desktop workspace.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          <DownloadButton />
          <a href="#demo" className="inline-flex items-center px-8 py-4 rounded-xl glass hover:bg-white/5 transition-all duration-300 font-medium">
            <Play className="w-5 h-5 mr-2" />
            Watch Demo
          </a>
        </motion.div>

        {/* Product Preview Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          className="mt-24 w-full relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-purple-500/10 blur-3xl rounded-full" />
          <div className="relative rounded-2xl glass p-2 border border-white/10 shadow-2xl overflow-hidden">
            <div className="h-8 border-b border-white/10 flex items-center px-4 gap-2 bg-black/40">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <div className="ml-4 text-xs text-gray-500 font-mono">AetherDesk Mission Control</div>
            </div>
            {/* Mockup content representing AetherDesk UI */}
            <div className="aspect-video bg-[#0a0a0a] relative flex">
              {/* Sidebar */}
              <div className="w-64 border-r border-white/10 p-4 flex flex-col gap-4">
                <div className="h-8 glass rounded flex items-center px-3 text-sm text-gray-400"><Code className="w-4 h-4 mr-2"/> Forge IDE</div>
                <div className="h-8 glass rounded flex items-center px-3 text-sm text-gray-400"><Network className="w-4 h-4 mr-2"/> Loom Engine</div>
                <div className="h-8 glass rounded border-l-2 border-indigo-500 flex items-center px-3 text-sm text-white bg-indigo-500/10"><Layers className="w-4 h-4 mr-2"/> Nexus Workspace</div>
              </div>
              {/* Main Area */}
              <div className="flex-1 p-8 flex flex-col">
                 <div className="h-12 w-1/3 glass rounded-lg mb-8 flex items-center px-4">
                    <Brain className="w-5 h-5 text-indigo-400 mr-3" />
                    <span className="text-gray-300 text-sm">Semantic Intelligence Active...</span>
                 </div>
                 {/* Agent Orchestration Graph Mock */}
                 <div className="flex-1 border border-indigo-500/20 rounded-xl relative overflow-hidden bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]">
                    <div className="absolute top-1/4 left-1/4 w-32 h-16 glass rounded border-indigo-500/50 flex items-center justify-center text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">Architect Agent</div>
                    <div className="absolute top-1/2 left-1/2 w-32 h-16 glass rounded border-purple-500/50 flex items-center justify-center text-sm shadow-[0_0_15px_rgba(168,85,247,0.2)]">Builder Swarm</div>
                    <div className="absolute top-3/4 left-1/3 w-32 h-16 glass rounded border-emerald-500/50 flex items-center justify-center text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]">Validator</div>
                    {/* SVG lines connecting them */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <path d="M 200 150 Q 350 150 450 250" stroke="rgba(99,102,241,0.5)" fill="none" strokeWidth="2" strokeDasharray="5,5" />
                      <path d="M 450 300 Q 400 350 300 380" stroke="rgba(168,85,247,0.5)" fill="none" strokeWidth="2" />
                    </svg>
                 </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="w-full max-w-7xl px-4 py-24 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">A complete intelligent ecosystem</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">Not just an editor, but a cohesive suite of tools designed to accelerate software creation through multi-agent collaboration.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FeatureCard 
            icon={<Code className="w-8 h-8 text-blue-400" />}
            title="Forge AI IDE"
            description="A deeply integrated development environment that synchronizes seamlessly with AI agents, offering AST-level semantic understanding."
          />
          <FeatureCard 
            icon={<Network className="w-8 h-8 text-purple-400" />}
            title="Loom Orchestration"
            description="Visually construct and manage complex AI workflows. Route tasks between local and cloud models with deterministic execution."
          />
          <FeatureCard 
            icon={<Layers className="w-8 h-8 text-emerald-400" />}
            title="Artisan Visual Builder"
            description="Drag and drop React components with full bi-directional code synchronization. What you see is exactly what compiles."
          />
          <FeatureCard 
            icon={<Brain className="w-8 h-8 text-pink-400" />}
            title="Swarm Agents"
            description="Deploy specialized agents that share context and memory, collaborating securely within your local workspace."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 mt-auto py-12 glass">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div>&copy; 2026 AetherDesk. All rights reserved.</div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass p-8 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-white/5 hover:border-white/10 group">
      <div className="mb-6 p-4 rounded-xl bg-black/40 inline-block group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-2xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
