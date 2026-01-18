import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedProfiles: string[];
}

interface UserProfile {
  username: string;
}

interface UserData {
  profiles?: UserProfile[];
}

export default function ProtectedRoute({
  children,
  allowedProfiles
}: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Verifica se existe sessão ativa
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
          setIsAuthenticated(false);
          return;
        }

        // 2. Busca o perfil do usuário
        const { data: userData, error } = await supabase
          .from('users')
          .select('profiles:profile_id(username)')
          .eq('email', session.user.email)
          .single<UserData>();

        if (error) {
          console.error('Erro ao buscar perfil:', error);
          setIsAuthenticated(false);
          return;
        }

        // 3. CORREÇÃO: profiles é um ARRAY
        const profile = userData?.profiles?.[0]?.username ?? null;

        setUserProfile(profile);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Erro na verificação de autenticação:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // ⏳ Aguardando verificação
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column'
        }}
      >
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
          Verificando acesso...
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Sunset Saladas
        </div>
      </div>
    );
  }

  // ❌ Não autenticado
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // ❌ Perfil não permitido
  if (userProfile && !allowedProfiles.includes(userProfile)) {
    switch (userProfile) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'producao':
        return <Navigate to="/production/dashboard" replace />;
      case 'lojas':
        return <Navigate to="/store/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  // ✅ Tudo certo
  return <>{children}</>;
}
