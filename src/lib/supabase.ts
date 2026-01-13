// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Credenciais do seu projeto Supabase
const supabaseUrl = 'https://esheltphblbmidjvofpb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzaGVsdHBoYmxibWlkanZvZnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3OTQ3NDksImV4cCI6MjA4MjM3MDc0OX0.hZSeXdQD825Bab_kawwJ_-tw4V8ADBPuZan7oRLgHqg';

console.log('🔗 Conectando ao Supabase...');
console.log('📋 URL:', supabaseUrl.substring(0, 30) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'saladas-sunset-auth',
    flowType: 'pkce'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'saladas-sunset'
    }
  }
});

// Função para testar a conexão
export const testSupabaseConnection = async () => {
  try {
    console.log('🧪 Testando conexão com Supabase...');
    
    // Teste 1: Verificar se podemos acessar a tabela stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('count')
      .limit(1);
    
    if (storesError) {
      console.error('❌ Erro ao conectar com tabela stores:', storesError);
      return { success: false, error: storesError };
    }
    
    // Teste 2: Verificar tabela users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (usersError) {
      console.error('❌ Erro ao conectar com tabela users:', usersError);
      return { success: false, error: usersError };
    }
    
    // Teste 3: Verificar tabela profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Erro ao conectar com tabela profiles:', profilesError);
      return { success: false, error: profilesError };
    }
    
    console.log('✅ Conexão com Supabase estabelecida com sucesso!');
    console.log('📊 Tabelas acessíveis: stores, users, profiles');
    
    return { 
      success: true, 
      stores: stores?.[0]?.count || 0,
      users: users?.[0]?.count || 0,
      profiles: profiles?.[0]?.count || 0
    };
    
  } catch (error) {
    console.error('💥 Erro crítico na conexão:', error);
    return { success: false, error };
  }
};

// CORREÇÃO: Verificar se estamos em ambiente de desenvolvimento de forma segura
// Usamos typeof para evitar erros de tipo no TypeScript
const isDevEnvironment = () => {
  // Verifica se import.meta está disponível (Vite/ES modules)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.DEV === true || import.meta.env.MODE === 'development';
  }
  
  // Fallback para process.env (Node.js/Webpack)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }
  
  // Fallback para variáveis globais do Vercel
  if (typeof window !== 'undefined' && (window as any).__DEV__) {
    return true;
  }
  
  // Por padrão, não rodamos em produção
  return false;
};

// Testar conexão automaticamente em desenvolvimento - AGORA COM VERIFICAÇÃO SEGURA
if (isDevEnvironment()) {
  setTimeout(() => {
    testSupabaseConnection().then(result => {
      if (result.success) {
        console.log(`🏪 Lojas: ${result.stores}`);
        console.log(`👥 Usuários: ${result.users}`);
        console.log(`👤 Perfis: ${result.profiles}`);
      }
    });
  }, 1000);
}

// Exportar funções úteis
export const auth = supabase.auth;
export const from = supabase.from;
export const storage = supabase.storage;
export const rpc = supabase.rpc;