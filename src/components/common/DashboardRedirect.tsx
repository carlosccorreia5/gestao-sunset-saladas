// src/components/common/DashboardRedirect.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Interface para os dados do usuário - CORREÇÃO: profiles é um array
interface UserProfileData {
  profiles: Array<{
    username: string;
  }>;
}

export default function DashboardRedirect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    redirectToDashboard();
  }, [navigate]);

  const redirectToDashboard = async () => {
    try {
      // 1. Verifica sessão
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }

      // 2. Busca perfil do usuário - CORREÇÃO: corrigido acesso ao array
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          profiles:profile_id (
            username
          )
        `)
        .eq('email', session.user.email)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        navigate('/');
        return;
      }

      // CORREÇÃO: Acessar propriedade de forma segura
      const profileData = userData as UserProfileData;
      const profile = profileData.profiles?.[0]?.username; // CORREÇÃO AQUI: [0] para acessar primeiro item do array

      // 3. Redireciona baseado no perfil
      switch (profile) {
        case 'admin':
          navigate('/admin/dashboard');
          break;
        case 'producao':
          navigate('/production/dashboard');
          break;
        case 'lojas':
          navigate('/store/dashboard');
          break;
        default:
          navigate('/');
      }
    } catch (error) {
      console.error('Erro no redirecionamento:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Redirecionando...</div>
        <div style={{ fontSize: '14px', color: '#666' }}>Sunset Saladas</div>
      </div>
    );
  }

  return null;
}