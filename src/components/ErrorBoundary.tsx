import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reloadOnceForChunkLoadError } from '../utils/chunkLoadRecovery';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (reloadOnceForChunkLoadError(error)) return;
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            backgroundColor: '#282c34',
            color: 'white',
            padding: '2rem',
            height: '100vh',
            overflow: 'auto',
            fontFamily: 'monospace',
          }}
        >
          <h1>Culture Map 애플리케이션 오류</h1>
          <p>오류가 발생하여 앱을 렌더링할 수 없습니다. 개발자 콘솔(F12)을 확인해주세요.</p>
          <pre
            style={{
              backgroundColor: '#1e1e1e',
              padding: '1rem',
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {this.state.error?.stack || String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
