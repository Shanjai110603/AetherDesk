# Bring Your Own Key (BYOK)

AetherDesk is designed with privacy and flexibility in mind. We employ a Bring Your Own Key (BYOK) model for all cloud-based AI providers.

## How it works

1. Your API keys are stored securely in your operating system's native keychain (e.g., Windows Credential Manager, macOS Keychain) using Tauri's secure storage APIs.
2. Keys are NEVER transmitted to our servers.
3. Requests to AI providers (OpenAI, Anthropic, Gemini) are made directly from your local machine.

## Supported Providers
- OpenAI
- Anthropic
- Google Gemini
- Local (Ollama) - No key required!

To configure your keys, open the **Mission Control** tab in AetherDesk and select **Providers**.
