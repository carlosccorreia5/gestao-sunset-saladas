// src/components/common/ProtectedRoute.tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedProfiles: string[];
}

export default function ProtectedRoute({ children, allowedProfiles }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // 1. Verifica se tem sessão
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAuthenticated(false);
        return;
      }

      // 2. Busca o perfil do usuário
      const { data: userData } = await supabase
        .from('users')
        .select('profiles:profile_id(username)')
        .eq('email', session.user.email)
        .single();

      // CORREÇÃO: Acessar o primeiro item do array de profiles
      const profile = userData?.profiles?.[0]?.username; // CORREÇÃO AQUI
      setUserProfile(profile || null);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Erro na verificação de autenticação:', error);
      setIsAuthenticated(false);
    }
  };

  // Aguardando verificação
  if (isAuthenticated === null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Verificando acesso...</div>
        <div style={{ fontSize: '14px', color: '#666' }}>Sunset Saladas</div>
      </div>
    );
  }

  // Não autenticado → vai para seleção de perfil
  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // Perfil não permitido → vai para dashboard do perfil correto
  if (userProfile && !allowedProfiles.includes(userProfile)) {
    switch (userProfile) {
      case 'admin':
        return <Navigate to="/admin/dashboard" />;
      case 'producao':
        return <Navigate to="/production/dashboard" />;
      case 'lojas':
        return <Navigate to="/store/dashboard" />;
      default:
        return <Navigate to="/" />;
    }
  }

  // Tudo certo → renderiza o componente
  return <>{children}</>;
}