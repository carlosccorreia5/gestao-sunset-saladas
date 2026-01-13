// src/App.tsx - VERSÃO FINAL COM REDIRECIONAMENTO AUTOMÁTICO
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import ProfileSelector from './components/auth/ProfileSelector';
import Login from './components/auth/Login';
import AdminDashboard from './components/admin/Dashboard';
import ProductionDashboard from './components/production/Production';
import StoreDashboard from './components/store/Store';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardRedirect from './components/common/DashboardRedirect';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🚀 App.tsx - Iniciando verificação de sessão');
    
    // Verifica sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('✅ Sessão obtida:', session?.user?.email);
      setSession(session);
      setLoading(false);
    }).catch(error => {
      console.error('❌ Erro na sessão:', error);
      setLoading(false);
    });

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log('🔄 Auth mudou:', session?.user?.email);
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  console.log('🔄 App renderizando, loading:', loading, 'session:', !!session);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ fontSize: '20px' }}>Sunset Saladas</div>
        <div style={{ fontSize: '14px', color: '#666' }}>Carregando...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* ROTA INICIAL */}
          <Route path="/" element={
            !session ? <ProfileSelector /> : <DashboardRedirect />
          } />
          
          {/* ROTA DE LOGIN */}
          <Route path="/login/:profileType" element={
            !session ? <Login /> : <DashboardRedirect />
          } />
          
          {/* ROTA REDIRECIONADORA */}
          <Route path="/dashboard" element={<DashboardRedirect />} />
          
          {/* DASHBOARDS PROTEGIDOS */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedProfiles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/production/dashboard" element={
            <ProtectedRoute allowedProfiles={['producao']}>
              <ProductionDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/store/dashboard" element={
            <ProtectedRoute allowedProfiles={['lojas']}>
              <StoreDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;