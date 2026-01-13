// src/utils/debug.ts
import { supabase } from '../lib/supabase';

export async function debugUserData(userId: string) {
  console.log('🔍 DEBUG: Iniciando debug do usuário:', userId);
  
  try {
    // 1. Verifica estrutura da tabela users
    console.log('📋 Verificando estrutura da tabela users...');
    const { data: userStructure } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    console.log('📊 Estrutura da tabela users (primeiro registro):', userStructure?.[0]);
    
    // 2. Busca usuário específico
    console.log(`🔎 Buscando usuário com id: ${userId}`);
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      return null;
    }
    
    console.log('✅ Dados do usuário encontrados:', userData);
    
    // 3. Se tiver store_id, busca loja
    if (userData.store_id) {
      console.log(`🏪 Buscando loja com id: ${userData.store_id}`);
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', userData.store_id)
        .single();
      
      if (storeError) {
        console.error('❌ Erro ao buscar loja:', storeError);
      } else {
        console.log('✅ Dados da loja encontrados:', storeData);
        return { user: userData, store: storeData };
      }
    } else {
      console.log('⚠️ Usuário não tem store_id associado');
    }
    
    return { user: userData, store: null };
    
  } catch (err: any) {
    console.error('❌ Erro no debug:', err);
    return null;
  }
}