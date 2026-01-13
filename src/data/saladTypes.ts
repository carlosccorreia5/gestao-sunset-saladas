// src/data/saladTypes.ts - VERSÃO INTEGRADA COM BANCO
import { supabase } from '../lib/supabase';

// Motivos de perda (fixos - não tem tabela no banco)
export const LOSS_REASONS = [
  { id: 'validade', name: 'Validade', emoji: '📅', color: '#F44336' },
  { id: 'qualidade', name: 'Qualidade da fruta', emoji: '🍎', color: '#FF5722' },
  { id: 'manuseio', name: 'Manuseio', emoji: '👐', color: '#FFC107' },
  { id: 'contaminacao', name: 'Contaminação', emoji: '⚠️', color: '#9C27B0' },
  { id: 'outros', name: 'Outros', emoji: '❓', color: '#607D8B' }
] as const;

// Status de pedidos
export const ORDER_STATUS = {
  REQUESTED: { id: 'requested', name: 'Solicitado', color: '#FF9800' },
  PROCESSING: { id: 'processing', name: 'Em produção', color: '#2196F3' },
  SHIPPED: { id: 'shipped', name: 'Enviado', color: '#4CAF50' },
  RECEIVED: { id: 'received', name: 'Recebido', color: '#2E7D32' }
} as const;

// Mapeamento de emojis para tipos de salada
const SALAD_EMOJIS: Record<string, string> = {
  'mix': '🥗',
  'verão': '☀️',
  'salada de frutas': '🍓',
  'tropical': '🥥',
  'Mix': '🥗',
  'Verão': '☀️',
  'Salada de Frutas': '🍓',
  'Tropical': '🥥'
};

// Mapeamento de cores para tipos de salada
const SALAD_COLORS: Record<string, string> = {
  'mix': '#4CAF50',
  'verão': '#FF9800',
  'salada de frutas': '#E91E63',
  'tropical': '#8BC34A',
  'Mix': '#4CAF50',
  'Verão': '#FF9800',
  'Salada de Frutas': '#E91E63',
  'Tropical': '#8BC34A'
};

// Função para buscar tipos de salada do banco
export async function getSaladTypes() {
  try {
    const { data, error } = await supabase
      .from('salad_types')
      .select('id, name, validity_days, sale_price')
      .order('name');
    
    if (error) {
      console.error('Erro ao buscar tipos de salada:', error);
      return getDefaultSaladTypes(); // Fallback
    }
    
    if (!data || data.length === 0) {
      return getDefaultSaladTypes(); // Fallback
    }
    
    // Transforma dados do banco para formato da aplicação
    return data.map(salad => ({
      id: salad.id,
      name: salad.name,
      emoji: SALAD_EMOJIS[salad.name.toLowerCase()] || '🥗',
      color: SALAD_COLORS[salad.name.toLowerCase()] || '#4CAF50',
      validity_days: salad.validity_days || 3,
      sale_price: salad.sale_price || 0
    }));
  } catch (error) {
    console.error('Erro inesperado ao buscar tipos de salada:', error);
    return getDefaultSaladTypes(); // Fallback
  }
}

// Tipos padrão (fallback se o banco falhar)
function getDefaultSaladTypes() {
  return [
    { id: 'default-mix', name: 'Mix', emoji: '🥗', color: '#4CAF50', validity_days: 3, sale_price: 0 },
    { id: 'default-verao', name: 'Verão', emoji: '☀️', color: '#FF9800', validity_days: 3, sale_price: 0 },
    { id: 'default-frutas', name: 'Salada de Frutas', emoji: '🍓', color: '#E91E63', validity_days: 3, sale_price: 0 },
    { id: 'default-tropical', name: 'Tropical', emoji: '🥥', color: '#8BC34A', validity_days: 3, sale_price: 0 }
  ];
}

// Gerar número sequencial para pedidos/perdas
export function generateSequenceNumber(prefix: string, lastNumber?: number): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const sequence = lastNumber ? lastNumber + 1 : 1;
  
  return `${prefix}-${year}${month}${day}-${String(sequence).padStart(4, '0')}`;
}