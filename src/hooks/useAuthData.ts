// src/hooks/useAuthData.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserData {
  email: string;
  profile: string;
  fullName?: string;
  storeId?: string;
  storeName?: string;
}

// CORREÇÃO: profiles e stores são arrays
interface DatabaseUser {
  full_name?: string;
  profile_id?: string;
  store_id?: string;
  profiles?: Array<{
    username: string;
  }>;
  stores?: Array<{
    name: string;
  }>;
}

export function useAuthData() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthData();
  }, []);

  const fetchAuthData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Verifica sessão
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw new Error('Erro na sessão: ' + sessionError.message);
      if (!session) {
        setUserData(null);
        setLoading(false);
        return;
      }

      const email = session.user.email || '';

      // 2. Busca dados do usuário na tabela users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          full_name,
          profile_id,
          store_id,
          profiles (username),
          stores (name)
        `)
        .eq('email', email)
        .single();

      if (userError) {
        // Se o usuário não existe na tabela users, cria dados básicos
        console.warn('Usuário não encontrado na tabela users, criando dados básicos');
        
        setUserData({
          email,
          profile: 'user', // Perfil padrão
          fullName: session.user.user_metadata?.full_name || email.split('@')[0]
        });
        return;
      }

      // 3. Extrai os dados com verificação segura
      const dbUser = userData as DatabaseUser;
      
      // CORREÇÃO: Acessando propriedades de forma segura (arrays)
      const userProfile = dbUser.profiles?.[0]?.username || 'user'; // CORREÇÃO AQUI
      const storeName = dbUser.stores?.[0]?.name || undefined; // CORREÇÃO AQUI
      const fullName = dbUser.full_name || email.split('@')[0];
      const storeId = dbUser.store_id || undefined;

      setUserData({
        email,
        profile: userProfile,
        fullName,
        storeId,
        storeName
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados de autenticação:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchAuthData();
  };

  return { userData, loading, error, refetch };
}