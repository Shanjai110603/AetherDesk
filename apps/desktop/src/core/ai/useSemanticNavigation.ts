import { useRef } from 'react';
import * as monaco from 'monaco-editor';
import { invoke } from '@tauri-apps/api/core';

export function useSemanticNavigation() {
  const providerRef = useRef<monaco.IDisposable | null>(null);

  const registerSemanticProvider = (monacoInstance: typeof monaco, editor?: any) => {
    if (providerRef.current) {
      providerRef.current.dispose();
    }

    const languages = ['typescript', 'javascript', 'rust', 'python'];
    
    // Register semantic Go To Definition for supported languages
    providerRef.current = monacoInstance.languages.registerDefinitionProvider(languages, {
      provideDefinition: async (model, position, _token) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        try {
          const results = await invoke<any[]>('semantic_query_symbols', { query: word.word });
          if (!results || results.length === 0) return null;

          const definitions = results.filter(sym => 
            sym.name === word.word && 
            ['function', 'class', 'struct', 'interface', 'method', 'type', 'enum'].includes(sym.kind.toLowerCase())
          );

          if (definitions.length === 0) return null;

          return definitions.map(def => {
            let uriPath = def.file_path;
            if (uriPath.match(/^[a-zA-Z]:\\/)) {
              uriPath = '/' + uriPath.replace(/\\/g, '/');
            } else if (!uriPath.startsWith('/')) {
              uriPath = '/' + uriPath.replace(/\\/g, '/');
            }

            return {
              uri: monacoInstance.Uri.parse(`file://${uriPath}`),
              range: new monacoInstance.Range(
                def.start_line + 1,
                1,
                def.start_line + 1,
                1
              )
            };
          });
        } catch (error) {
          console.error("Semantic definition resolution failed:", error);
          return null;
        }
      }
    });

    // If we have the editor instance, we can override the F12 behavior to ensure it opens the tab
    if (editor) {
      editor.addAction({
        id: 'aether.semantic.gotoDefinition',
        label: 'Go to Definition (Semantic)',
        keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.F12],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: async (ed: any) => {
          const position = ed.getPosition();
          const model = ed.getModel();
          if (!position || !model) return;
          
          const word = model.getWordAtPosition(position);
          if (!word) return;

          try {
            const results = await invoke<any[]>('semantic_query_symbols', { query: word.word });
            const def = results?.find(sym => 
              sym.name === word.word && 
              ['function', 'class', 'struct', 'interface', 'method', 'type', 'enum'].includes(sym.kind.toLowerCase())
            );

            if (def) {
              // Custom event that Forge.tsx can listen to and open the tab
              window.dispatchEvent(new CustomEvent('aether:open_file', { 
                detail: { path: def.file_path, line: def.start_line + 1 }
              }));
            }
          } catch (e) {
            console.error("Semantic Go to Definition failed", e);
          }
        }
      });
    }
  };

  const unregisterSemanticProvider = () => {
    if (providerRef.current) {
      providerRef.current.dispose();
      providerRef.current = null;
    }
  };

  return { registerSemanticProvider, unregisterSemanticProvider };
}
