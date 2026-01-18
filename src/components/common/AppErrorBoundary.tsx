import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erro no React:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          background: '#fff3f3',
          minHeight: '100vh',
          color: '#d32f2f',
          textAlign: 'center'
        }}>
          <h1>⚠️ Erro no Sistema</h1>
          <pre style={{
            background: 'white',
            padding: '20px',
            borderRadius: '10px',
            margin: '20px auto',
            maxWidth: '800px',
            textAlign: 'left',
            overflow: 'auto'
          }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 24px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Voltar para Início
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}