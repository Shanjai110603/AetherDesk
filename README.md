<div align="center">
  <img src="https://via.placeholder.com/150x150.png?text=AetherDesk" width="150" height="150" alt="AetherDesk Logo" />
  
  # AetherDesk
  
  **The Next-Generation AI-Native Workspace & IDE**

  AetherDesk is a powerful, desktop-native developer environment blending an advanced code editor, autonomous AI agents, visual workflow orchestration, and native build utilities into a single, cohesive experience. Built for speed and flexibility with React, Vite, and Tauri (Rust).

  <p>
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#build-deploy">Build & Deploy</a>
  </p>
</div>

---

## ✨ Features

- **The Forge (IDE):** A fully-featured code editor powered by Monaco. Includes native filesystem integration, embedded terminals, diff reviews, and seamless AI assistance (autocomplete, refactoring, and code generation).
- **The Nexus (AI Core):** Centralized hub for conversing with AI models. Features an **Agent Mode** that delegates complex, multi-step tasks to an autonomous ReAct loop capable of reading, writing, and executing code natively on your machine.
- **The Loom (Workflow Orchestration):** A visual node-based editor for designing and running complex AI and execution workflows. Drag and drop triggers, LLM prompts, and filesystem operations effortlessly.
- **Universal Build & Deploy:** Compile your workspaces into Windows (`.exe`), Android (`.apk`), or Web distributions instantly. Supports Tauri, Capacitor, React Native, Gradle, or fully custom build pipelines with real-time terminal streaming.
- **Intelligent Routing:** Smartly routes AI requests to the optimal provider (Ollama, OpenAI, Anthropic, Gemini, OpenRouter) based on cost, speed, or reasoning requirements.
- **Telemetry & Sandboxing:** Real-time metrics on token usage and inference speeds. Backend executions are sandboxed for security.

---

## 🏗️ Architecture

AetherDesk uses a modern web-to-native architecture to deliver desktop-class performance while remaining highly customizable.

- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, Zustand (State Management), Monaco Editor.
- **Backend:** Rust, Tauri 2.0, Tokio (Async Runtimes), Serde.
- **AI Integration:** Multi-provider API abstraction with support for streaming responses, function calling, and structured JSON outputs.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- Platform-specific build tools for Tauri (e.g., MSVC on Windows).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-repo/aetherdesk.git
   cd aetherdesk
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run the Application in Development Mode:**
   ```bash
   npm run tauri dev
   ```
   This will spin up the Vite development server and launch the native Rust application.

---

## 📦 Build & Deploy

AetherDesk isn't just an editor—it builds apps too. From the **Forge** workspace, simply click the **Deploy (🚀)** button to package your active project. 

- Automatically detect and bundle Tauri applications for Windows.
- Compile native Android apps using Gradle or Capacitor.
- Customize your own build scripts directly within the UI, while streaming live terminal logs securely from the Rust backend.

To build AetherDesk itself for production:
```bash
npm run tauri build
```

---

## 🛡️ Security
AetherDesk provides direct access to your local filesystem and terminal to enable autonomous AI agents. Please ensure you trust the codebase and AI models you run. Command execution is natively restricted to the active workspace directory to prevent arbitrary path traversals.

## 📄 License
This project is licensed under the MIT License.
