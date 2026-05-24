# Secure Sandbox Execution

AetherDesk executes AI-generated code in a highly restricted, containerized environment to protect your host system.

## The Architecture
By default, when Swarm Agents attempt to execute code or run terminal commands:
- The execution is routed to a lightweight **Docker Container** or **WSL2 instance** (on Windows).
- The sandbox has NO network access by default unless explicitly granted.
- The sandbox can only access the directory of the current active Nexus workspace.

## Overriding the Sandbox
For certain workflows (like native mobile development), you may need to grant the agent host-level access. You can toggle this per-workspace in the **Workspace Settings** under the **Execution Environment** tab.

*Warning: Granting host-level access means the AI can execute any command your user account can.*
