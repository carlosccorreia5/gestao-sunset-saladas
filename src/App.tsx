// src/App.tsx - VERSÃO FINAL SIMPLIFICADA E FUNCIONAL
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

// Importe os componentes
import Login from './components/auth/Login';
import ProfileSelector from './components/auth/ProfileSelector';
import Production from './components/production/Production';
import Store from './components/store/Store';
import Dashboard from './components/admin/Dashboard';

// Componente de Loading
function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <h1 style={{ color: '#FF9800', fontSize: '32px' }}>🏭 Sunset Saladas</h1>
      <div
        style={{
          width: '50px',
          height: '50px',
          border: '5px solid #e0e0e0',
          borderTop: '5px solid #FF9800',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      ></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Componente SIMPLES para verificar autenticação - APENAS VERIFICA SE ESTÁ LOGADO
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      console.log('🔐 ProtectedRoute: Verificando sessão...');
      console.log('🔐 Sessão:', session?.user?.email);

      if (error) {
        console.error('❌ Erro ao verificar sessão:', error);
        navigate('/');
        return;
      }

      if (!session) {
        console.log('❌ Usuário não autenticado, redirecionando para home...');
        navigate('/');
        return;
      }

      console.log('✅ Usuário autenticado:', session.user.email);
      setAuthenticated(true);
    } catch (error) {
      console.error('❌ Erro na verificação de autenticação:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return null; // Já redirecionou no useEffect
  }

  return <>{children}</>;
}

// Componente Principal App
function AppContent() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🚀 App iniciando...');

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        console.log('📋 Sessão inicial:', session?.user?.email || 'Nenhuma sessão');
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao obter sessão:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Evento de auth:', event, 'Usuário:', session?.user?.email);
      
      // Se usuário deslogar, redireciona para home
      if (event === 'SIGNED_OUT') {
        console.log('👋 Usuário deslogado, limpando sessão...');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* ROTA INICIAL - Seleção de Perfil */}
      <Route path="/" element={<ProfileSelector />} />

      {/* ROTA DE LOGIN */}
      <Route path="/login/:profileType" element={<Login />} />

      {/* DASHBOARDS PROTEGIDOS - APENAS VERIFICA SE ESTÁ AUTENTICADO */}
      {/* O Login.tsx já garante que cada perfil vai para seu dashboard correto */}
      {/* Cada dashboard faz sua própria validação específica */}
      
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/production/dashboard"
        element={
          <ProtectedRoute>
            <Production />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/dashboard"
        element={
          <ProtectedRoute>
            <Store />
          </ProtectedRoute>
        }
      />

      {/* ROTA DE FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Componente principal que envolve tudo
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;