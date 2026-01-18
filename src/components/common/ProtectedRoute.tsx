// src/components/common/ProtectedRoute.tsx - VERSÃO CORRIGIDA
import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedProfiles: string[];
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
        console.log('🔐 ProtectedRoute: Verificando autenticação...');
        
        // 1. Verifica se existe sessão ativa
        const { data: { session } } = await supabase.auth.getSession();

        console.log('🔐 Sessão:', session);
        
        if (!session) {
          console.log('🔐 Nenhuma sessão encontrada');
          setIsAuthenticated(false);
          return;
        }

        // 2. Busca o perfil do usuário - CONSULTA CORRETA
        const { data: userData, error } = await supabase
          .from('users')
          .select('profile_type')
          .eq('auth_id', session.user.id)
          .single();

        console.log('🔐 Dados do usuário:', userData);
        console.log('🔐 Erro:', error);

        if (error) {
          console.error('❌ Erro ao buscar perfil:', error);
          setIsAuthenticated(false);
          return;
        }

        if (!userData) {
          console.log('❌ userData é null');
          setIsAuthenticated(false);
          return;
        }

        // 3. Armazena o perfil
        const profile = userData?.profile_type || null;
        
        console.log('🔐 Perfil encontrado:', profile);
        
        setUserProfile(profile);
        setIsAuthenticated(true);
        
      } catch (error) {
        console.error('❌ Erro na verificação de autenticação:', error);
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
    console.log('🔐 Redirecionando para login: Usuário não autenticado');
    return <Navigate to="/" replace />;
  }

  // ❌ Perfil não permitido
  if (userProfile && !allowedProfiles.includes(userProfile)) {
    console.log(`🔐 Perfil não permitido: ${userProfile}. Permitidos: ${allowedProfiles}`);
    
    // Redireciona baseado no perfil REAL do usuário
    switch (userProfile) {
      case 'admin':
        console.log('🔐 Redirecionando para admin');
        return <Navigate to="/admin/dashboard" replace />;
      case 'producao':
        console.log('🔐 Redirecionando para produção');
        return <Navigate to="/production/dashboard" replace />;
      case 'loja':
      case 'lojas':
        console.log('🔐 Redirecionando para loja');
        return <Navigate to="/store/dashboard" replace />;
      default:
        console.log('🔐 Redirecionando para home');
        return <Navigate to="/" replace />;
    }
  }

  // ✅ Tudo certo
  console.log(`🔐 Acesso permitido para perfil: ${userProfile}`);
  return <>{children}</>;
}