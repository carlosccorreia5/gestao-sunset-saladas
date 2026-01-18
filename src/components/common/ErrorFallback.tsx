// src/components/common/ErrorFallback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export default function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const navigate = useNavigate();

  useEffect(() => {
    console.error('❌ Erro capturado pelo Error Boundary:', error);
  }, [error]);

  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      backgroundColor: '#fff3f3',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1 style={{ color: '#d32f2f', fontSize: '32px', marginBottom: '20px' }}>
        ⚠️ Oops! Algo deu errado
      </h1>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        margin: '20px 0',
        maxWidth: '600px',
        textAlign: 'left'
      }}>
        <p style={{ margin: '10px 0' }}><strong>Erro:</strong> {error.message}</p>
        <p style={{ margin: '10px 0', color: '#666', fontSize: '14px' }}>
          {error.stack}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
        <button
          onClick={resetErrorBoundary}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Tentar novamente
        </button>
        <button
          onClick={() => navigate('/reset')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🔄 Resetar Aplicação
        </button>
        <button
          onClick={() => navigate('/login/production')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Voltar para Login
        </button>
      </div>
    </div>
  );
}