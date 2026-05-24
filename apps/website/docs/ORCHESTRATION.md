# Loom Orchestration Engine

The Loom Engine is the heart of AetherDesk's multi-agent capabilities. It allows you to visually map out workflows and agent communications.

## Visual Workflow Builder
Loom provides a node-based interface to define:
- **Triggers**: When should this workflow start? (e.g., File Save, Git Commit, Manual click)
- **Nodes**: Which agent should handle this step? Which LLM model should they use?
- **Edges**: How does data flow from one agent to the next?

## Deterministic Execution
Unlike chat-based IDEs where AI output is unpredictable, Loom enforces a state machine. You can view the exact state, memory, and output of each agent at any given node.
