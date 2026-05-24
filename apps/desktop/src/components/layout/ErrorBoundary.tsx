import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

import { logger } from '../../core/services/logger';

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Uncaught error in ErrorBoundary:', error);
    logger.error('Component Stack:', errorInfo.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-background text-on-surface p-xl">
          <div className="bg-surface-container border border-error/30 rounded-xl p-lg max-w-2xl w-full">
            <div className="flex items-center gap-sm text-error mb-md">
              <span className="material-symbols-outlined text-[32px]">warning</span>
              <h1 className="text-title-lg font-bold">Workspace Error</h1>
            </div>
            <p className="text-body-md text-on-surface-variant mb-md">
              A critical error occurred while rendering this workspace. The workspace has been isolated to prevent a complete application crash.
            </p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-sm overflow-x-auto mb-lg">
              <pre className="text-[12px] font-code-md text-error-fixed-dim">
                {this.state.error?.message}
              </pre>
            </div>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
