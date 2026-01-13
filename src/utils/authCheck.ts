// src/utils/authCheck.ts
import { supabase } from '../lib/supabase';

// Interface para os dados retornados
interface AuthData {
  email: string;
  profile: string;
  fullName?: string;
  storeName?: string;
}

// CORREÇÃO: Interface para os dados do usuário do banco
interface DatabaseUser {
  full_name?: string;
  profile_id?: string;
  store_id?: string;
  profiles?: Array<{ // CORREÇÃO: Array em vez de objeto
    username: string;
  }>;
  stores?: Array<{ // CORREÇÃO: Array em vez de objeto
    name: string;
  }>;
}

// Função que ESPERA até a sessão estar realmente carregada
export async function waitForAuth(): Promise<AuthData> {
  return new Promise(async (resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 10; // 5 segundos no total
    
    const checkAuth = async () => {
      attempts++;
      
      try {
        // 1. Verifica sessão NO SUPABASE (não no cache)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro na sessão:', error);
          throw error;
        }
        
        if (!session || !session.user?.email) {
          console.log(`Tentativa ${attempts}: Sessão ainda não carregada`);
          if (attempts < maxAttempts) {
            setTimeout(checkAuth, 500); // Tenta novamente em 500ms
            return;
          } else {
            throw new Error('Timeout: Sessão não carregada após 5 segundos');
          }
        }
        
        // 2. Sessão encontrada, busca dados do usuário
        const email = session.user.email;
        console.log('✅ Sessão carregada para:', email);
        
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
          console.error('Erro ao buscar dados do usuário:', userError);
          
          // Se o usuário não existe na tabela users, retorna dados básicos
          console.warn('Usuário não encontrado na tabela users, retornando dados básicos');
          
          resolve({
            email,
            profile: 'user', // Perfil padrão
            fullName: session.user.user_metadata?.full_name || email.split('@')[0]
          });
          return;
        }
        
        if (!userData) {
          // Usuário não encontrado, mas não é erro - retorna dados básicos
          resolve({
            email,
            profile: 'user',
            fullName: session.user.user_metadata?.full_name || email.split('@')[0]
          });
          return;
        }
        
        // CORREÇÃO: Acessando propriedades de forma segura
        const dbUser = userData as DatabaseUser;
        const profile = dbUser.profiles?.[0]?.username || 'user'; // CORREÇÃO: [0] para array
        const storeName = dbUser.stores?.[0]?.name || undefined; // CORREÇÃO: [0] para array
        const fullName = dbUser.full_name || session.user.user_metadata?.full_name || email.split('@')[0];
        
        console.log('✅ Dados do usuário carregados:', { email, profile, storeName });
        
        resolve({
          email,
          profile,
          fullName,
          storeName
        });
        
      } catch (error: any) {
        console.error('Erro no waitForAuth:', error);
        if (attempts < maxAttempts) {
          setTimeout(checkAuth, 500);
        } else {
          // Se falhar após todas as tentativas, rejeita com erro específico
          reject(new Error(`Falha na autenticação: ${error.message || 'Erro desconhecido'}`));
        }
      }
    };
    
    // Inicia a verificação
    checkAuth();
  });
}

// Função auxiliar para verificar se usuário está autenticado
export async function checkUserAuth(): Promise<{
  isAuthenticated: boolean;
  userData?: AuthData;
  error?: string;
}> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return { isAuthenticated: false, error: error.message };
    }
    
    if (!session || !session.user) {
      return { isAuthenticated: false, error: 'Nenhuma sessão encontrada' };
    }
    
    // Tenta buscar dados completos
    try {
      const authData = await waitForAuth();
      return { isAuthenticated: true, userData: authData };
    } catch (waitError: any) {
      // Se waitForAuth falhar, retorna pelo menos dados básicos da sessão
      return {
        isAuthenticated: true,
        userData: {
          email: session.user.email || '',
          profile: 'user',
          fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
        }
      };
    }
    
  } catch (error: any) {
    console.error('Erro ao verificar autenticação:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

// Função para redirecionar se não autenticado
export async function requireAuth(profileType?: string): Promise<AuthData> {
  try {
    const authData = await waitForAuth();
    
    // Se um tipo de perfil específico foi solicitado, verifica
    if (profileType && authData.profile !== profileType) {
      throw new Error(`Acesso não autorizado. Perfil necessário: ${profileType}`);
    }
    
    return authData;
  } catch (error: any) {
    console.error('Erro na autenticação:', error);
    
    // Redireciona para a página de login apropriada
    if (typeof window !== 'undefined') {
      const redirectPath = profileType ? `/login/${profileType}` : '/login';
      window.location.href = redirectPath;
    }
    
    throw error;
  }
}

// Função simples para obter email atual
export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.email || null;
  } catch (error) {
    console.error('Erro ao obter email do usuário:', error);
    return null;
  }
}