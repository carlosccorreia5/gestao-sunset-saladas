// src/components/production/ProductionDashboard.tsx - VERSÃO COMPLETA E CORRIGIDA
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../common/Header';
import { getSaladTypes } from '../../data/saladTypes';

// Interfaces
interface SaladType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sale_price: number;
}

interface Store {
  id: string;
  name: string;
}

interface DailyShipment {
  shipment_id: string;
  shipment_number: string;
  store_id: string;
  store_name: string;
  status: string;
  shipment_date: string;
  production_date: string | null;
  created_at: string;
  total_items: number;
  items: Array<{
    salad_type_id: string;
    salad_name: string;
    salad_emoji: string;
    salad_color: string;
    requested_quantity: number;
    delivered_quantity: number;
    pending_quantity: number;
  }>;
}

interface ShipmentDelivery {
  id: string;
  shipment_id: string;
  salad_type_id: string;
  delivered_quantity: number;
  batch_number: string;
  delivered_at: string;
}

interface SaladSummary {
  salad_name: string;
  salad_emoji: string;
  salad_color: string;
  total_requested: number;
  total_delivered: number;
  total_pending: number;
  stores_count: number;
}

export default function ProductionDashboard() {
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [userDbId, setUserDbId] = useState<string>('');
  const [_saladTypes, setSaladTypes] = useState<SaladType[]>([]);
  const [_stores, setStores] = useState<Store[]>([]);
  
  // Data selecionada para visualização (data de entrega)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  // Dados do dashboard
  const [dailyShipments, setDailyShipments] = useState<DailyShipment[]>([]);
  const [shipmentDeliveries, setShipmentDeliveries] = useState<ShipmentDelivery[]>([]);
  const [saladSummaries, setSaladSummaries] = useState<SaladSummary[]>([]);
  
  // Modal de envio
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<DailyShipment | null>(null);
  const [batchNumber, setBatchNumber] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `LOTE-${year}${month}${day}`;
  });
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  
  // Estatísticas
  const [stats, setStats] = useState({
    totalStores: 0,
    totalShipments: 0,
    totalRequested: 0,
    totalDelivered: 0,
    totalPending: 0
  });

  useEffect(() => {
    initDashboard();
  }, [selectedDate]);

  const initDashboard = async () => {
    console.log('🚀 Iniciando dashboard de produção...');
    
    try {
      // 1. Verificar sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login/producao';
        return;
      }
      setUserEmail(session.user.email || '');
      
      // 2. Buscar ID do usuário no banco
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();
      
      if (userData) {
        setUserDbId(userData.id);
      }
      
      // 3. Buscar tipos de salada
      const saladTypesData = await getSaladTypes();
      setSaladTypes(saladTypesData);
      
      // 4. Buscar lojas
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      
      if (storesError) {
        console.error('Erro ao buscar lojas:', storesError);
      } else {
        setStores(storesData || []);
      }
      
      // 5. Buscar dados para a data selecionada
      await fetchDashboardData();
      
    } catch (error) {
      console.error('Erro ao inicializar:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      console.log('📊 Buscando pedidos para entrega em:', selectedDate);
      
      // 1. Buscar shipments para a data de entrega selecionada
      const { data: shipments, error: shipmentsError } = await supabase
        .from('production_shipments')
        .select(`
          id,
          shipment_number,
          store_id,
          status,
          shipment_date,
          production_date,
          created_at,
          total_items,
          stores!inner(name)
        `)
        .eq('shipment_date', selectedDate) // Filtrando pela DATA DE ENTREGA
        .in('status', ['pending', 'shipped'])
        .order('created_at');
      
      if (shipmentsError) {
        console.error('Erro ao buscar shipments:', shipmentsError);
        setDailyShipments([]);
        setSaladSummaries([]);
        return;
      }
      
      if (!shipments || shipments.length === 0) {
        setDailyShipments([]);
        setSaladSummaries([]);
        setStats({
          totalStores: 0,
          totalShipments: 0,
          totalRequested: 0,
          totalDelivered: 0,
          totalPending: 0
        });
        return;
      }
      
      // 2. Buscar deliveries para estes shipments
      const shipmentIds = shipments.map(s => s.id);
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('shipment_deliveries')
        .select('*')
        .in('shipment_id', shipmentIds);
      
      if (deliveriesError && deliveriesError.code !== 'PGRST116') {
        console.error('Erro ao buscar deliveries:', deliveriesError);
      }
      
      setShipmentDeliveries(deliveries || []);
      
      // 3. Processar cada shipment
      const shipmentsWithItems: DailyShipment[] = [];
      let totalRequested = 0;
      let totalDelivered = 0;
      const uniqueStores = new Set();
      
      for (const shipment of shipments) {
        uniqueStores.add(shipment.store_id);
        
        // Buscar itens do shipment
        const { data: items, error: itemsError } = await supabase
          .from('production_items')
          .select(`
            id,
            salad_type_id,
            quantity,
            unit_price,
            salad_types!inner(name, emoji, color)
          `)
          .eq('shipment_id', shipment.id);
        
        if (itemsError) {
          console.error('Erro ao buscar itens do shipment:', itemsError);
          continue;
        }
        
        // Processar itens
        const shipmentItems = (items || []).map(item => {
          const deliveredItem = (deliveries || []).find(
            d => d.shipment_id === shipment.id && d.salad_type_id === item.salad_type_id
          );
          
          const deliveredQuantity = deliveredItem?.delivered_quantity || 0;
          const pendingQuantity = item.quantity - deliveredQuantity;
          
          totalRequested += item.quantity;
          totalDelivered += deliveredQuantity;
          
          return {
            salad_type_id: item.salad_type_id,
            salad_name: item.salad_types?.[0]?.name || 'Salada',
            salad_emoji: item.salad_types?.[0]?.emoji || '🥗',
            salad_color: item.salad_types?.[0]?.color || '#4CAF50',
            requested_quantity: item.quantity,
            delivered_quantity: deliveredQuantity,
            pending_quantity: pendingQuantity
          };
        });
        
        shipmentsWithItems.push({
          shipment_id: shipment.id,
          shipment_number: shipment.shipment_number,
          store_id: shipment.store_id,
          store_name: shipment.stores?.[0]?.name || 'Loja',
          status: shipment.status,
          shipment_date: shipment.shipment_date,
          production_date: shipment.production_date,
          created_at: shipment.created_at,
          total_items: shipment.total_items,
          items: shipmentItems
        });
      }
      
      setDailyShipments(shipmentsWithItems);
      setStats({
        totalStores: uniqueStores.size,
        totalShipments: shipments.length,
        totalRequested,
        totalDelivered,
        totalPending: totalRequested - totalDelivered
      });
      
      // 4. Calcular resumo por tipo de salada
      const summaries = calculateSaladSummaries(shipmentsWithItems);
      setSaladSummaries(summaries);
      
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      setDailyShipments([]);
      setSaladSummaries([]);
      setStats({
        totalStores: 0,
        totalShipments: 0,
        totalRequested: 0,
        totalDelivered: 0,
        totalPending: 0
      });
    }
  };

  const calculateSaladSummaries = (shipments: DailyShipment[]): SaladSummary[] => {
    const summaryMap = new Map<string, SaladSummary>();
    
    shipments.forEach(shipment => {
      shipment.items.forEach(item => {
        const key = item.salad_type_id;
        
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            salad_name: item.salad_name,
            salad_emoji: item.salad_emoji,
            salad_color: item.salad_color,
            total_requested: 0,
            total_delivered: 0,
            total_pending: 0,
            stores_count: 0
          });
        }
        
        const summary = summaryMap.get(key)!;
        summary.total_requested += item.requested_quantity;
        summary.total_delivered += item.delivered_quantity;
        summary.total_pending += item.pending_quantity;
      });
    });
    
    // Contar lojas únicas para cada tipo de salada
    summaryMap.forEach((summary, saladTypeId) => {
      const storesSet = new Set<string>();
      shipments.forEach(shipment => {
        const hasThisSalad = shipment.items.some(item => item.salad_type_id === saladTypeId);
        if (hasThisSalad) {
          storesSet.add(shipment.store_id);
        }
      });
      summary.stores_count = storesSet.size;
    });
    
    return Array.from(summaryMap.values()).sort((a, b) => b.total_pending - a.total_pending);
  };

  const handleSendShipment = (shipment: DailyShipment) => {
    setSelectedShipment(shipment);
    
    // Gerar número de lote baseado na data atual
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setBatchNumber(`LOTE-${year}${month}${day}`);
    
    // Inicializar quantidades ajustadas com as pendentes
    const initialQuantities: Record<string, number> = {};
    shipment.items.forEach(item => {
      initialQuantities[item.salad_type_id] = item.pending_quantity;
    });
    
    setAdjustedQuantities(initialQuantities);
    setShowSendModal(true);
  };

  const updateAdjustedQuantity = (saladTypeId: string, quantity: number) => {
    if (quantity < 0) return;
    
    const item = selectedShipment?.items.find(i => i.salad_type_id === saladTypeId);
    if (item && quantity > item.requested_quantity) {
      alert(`Quantidade não pode ser maior que ${item.requested_quantity} (solicitado)`);
      return;
    }
    
    setAdjustedQuantities(prev => ({
      ...prev,
      [saladTypeId]: quantity
    }));
  };

  const markAsShipped = async (shipmentId: string, quantities: Record<string, number>, batchNumber: string) => {
    if (!userDbId) {
      alert('Erro: Usuário não identificado.');
      return;
    }

    try {
      setSending(true);
      
      // Para cada item, registrar a entrega com batch_number
      for (const [saladTypeId, quantity] of Object.entries(quantities)) {
        if (quantity > 0) {
          // Buscar quantidade solicitada
          const { data: itemData, error: itemError } = await supabase
            .from('production_items')
            .select('quantity')
            .eq('shipment_id', shipmentId)
            .eq('salad_type_id', saladTypeId)
            .single();
          
          if (itemError) {
            console.error('Erro ao buscar item:', itemError);
            continue;
          }
          
          const requestedQuantity = itemData?.quantity || 0;
          
          // Inserir/atualizar no shipment_deliveries
          const { error: deliveryError } = await supabase
            .from('shipment_deliveries')
            .upsert({
              shipment_id: shipmentId,
              salad_type_id: saladTypeId,
              requested_quantity: requestedQuantity,
              delivered_quantity: quantity,
              batch_number: batchNumber,
              delivered_by: userDbId,
              delivered_at: new Date().toISOString()
            }, {
              onConflict: 'shipment_id,salad_type_id'
            });
          
          if (deliveryError) {
            console.error('Erro ao registrar entrega:', deliveryError);
            throw deliveryError;
          }
        }
      }
      
      // Verificar se todas as quantidades foram entregues
      const { data: remainingItems, error: remainingError } = await supabase
        .from('production_items')
        .select(`
          quantity,
          salad_type_id,
          shipment_deliveries(delivered_quantity)
        `)
        .eq('shipment_id', shipmentId);
      
      if (remainingError) {
        console.error('Erro ao verificar itens restantes:', remainingError);
      }
      
      const allDelivered = remainingItems?.every(item => {
        const delivered = item.shipment_deliveries?.[0]?.delivered_quantity || 0;
        return delivered >= item.quantity;
      }) || false;
      
      // Atualizar status do shipment
      const updateData: any = {
        status: allDelivered ? 'shipped' : 'pending',
        updated_at: new Date().toISOString()
      };
      
      if (allDelivered) {
        updateData.production_date = new Date().toISOString().split('T')[0];
      }
      
      const { error: updateError } = await supabase
        .from('production_shipments')
        .update(updateData)
        .eq('id', shipmentId);
      
      if (updateError) {
        console.error('Erro ao atualizar shipment:', updateError);
        throw updateError;
      }
      
      alert(`✅ Pedido marcado como ${allDelivered ? 'enviado' : 'parcialmente enviado'}!`);
      
      // Atualizar dados
      setShowSendModal(false);
      setSelectedShipment(null);
      setAdjustedQuantities({});
      await fetchDashboardData();
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar pedido:', error);
      alert(`Erro ao enviar pedido: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSending(false);
    }
  };

  const markAllAsShipped = async () => {
    if (!userDbId || dailyShipments.length === 0) {
      alert('Nenhum pedido para enviar.');
      return;
    }

    if (!confirm(`Deseja marcar TODOS os ${dailyShipments.length} pedidos para entrega em ${new Date(selectedDate).toLocaleDateString('pt-BR')} como enviados?\n\nLote: ${batchNumber}\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setSending(true);
      
      for (const shipment of dailyShipments) {
        if (shipment.status === 'shipped') continue;
        
        // Para cada item do shipment, registrar entrega completa
        for (const item of shipment.items) {
          if (item.pending_quantity > 0) {
            const { error: deliveryError } = await supabase
              .from('shipment_deliveries')
              .upsert({
                shipment_id: shipment.shipment_id,
                salad_type_id: item.salad_type_id,
                requested_quantity: item.requested_quantity,
                delivered_quantity: item.requested_quantity, // Envia tudo
                batch_number: batchNumber,
                delivered_by: userDbId,
                delivered_at: new Date().toISOString()
              }, {
                onConflict: 'shipment_id,salad_type_id'
              });
            
            if (deliveryError) {
              console.error(`Erro ao registrar entrega para ${shipment.shipment_number}:`, deliveryError);
            }
          }
        }
        
        // Atualizar status do shipment
        const { error: updateError } = await supabase
          .from('production_shipments')
          .update({
            status: 'shipped',
            production_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', shipment.shipment_id);
        
        if (updateError) {
          console.error(`Erro ao atualizar shipment ${shipment.shipment_number}:`, updateError);
        }
      }
      
      alert(`✅ ${dailyShipments.length} pedidos marcados como enviados!\nLote: ${batchNumber}\nData de entrega: ${new Date(selectedDate).toLocaleDateString('pt-BR')}`);
      
      // Atualizar dados
      await fetchDashboardData();
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar todos os pedidos:', error);
      alert(`Erro ao enviar pedidos: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'shipped': return '#4CAF50'; // Verde
      case 'pending': return '#FF9800'; // Laranja
      default: return '#9E9E9E'; // Cinza
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'shipped': return 'Enviado';
      case 'pending': return 'Pendente';
      default: return status;
    }
  };

  // ========== RENDERIZAÇÃO ==========
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: 'bold',
          color: '#FF9800',
          textAlign: 'center'
        }}>
          🏭 Sunset Saladas - Produção
        </div>
        <div style={{ 
          fontSize: '18px', 
          color: '#666',
          textAlign: 'center'
        }}>
          Carregando dashboard de produção...
        </div>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #e0e0e0',
          borderTop: '5px solid #FF9800',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Header 
        title="Dashboard de Produção"
        userEmail={userEmail}
        profileType="producao"
      />
      
      <main style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* ========== CABEÇALHO COM SELEÇÃO DE DATA DE ENTREGA ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '25px',
          marginBottom: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#333' }}>
              🏭 Dashboard de Produção
            </h1>
            <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>
              Visualize e gerencie os pedidos das lojas organizados por data de entrega
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                📅 Data de Entrega Selecionada
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '12px 16px',
                  border: '2px solid #ddd',
                  borderRadius: '10px',
                  fontSize: '16px',
                  backgroundColor: 'white',
                  minWidth: '200px'
                }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Mostrando pedidos para: {new Date(selectedDate).toLocaleDateString('pt-BR')}
              </div>
            </div>
            
            {dailyShipments.length > 0 && (
              <button
                onClick={markAllAsShipped}
                disabled={sending}
                style={{
                  padding: '12px 24px',
                  backgroundColor: sending ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  marginTop: '28px'
                }}
              >
                {sending ? 'Processando...' : `✅ Enviar Todos (${dailyShipments.length})`}
              </button>
            )}
          </div>
        </div>

        {/* ========== RESUMO DO DIA (DATA DE ENTREGA) ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ 
            marginTop: 0, 
            color: '#333', 
            fontSize: '22px', 
            marginBottom: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📊 Produção para {new Date(selectedDate).toLocaleDateString('pt-BR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long',
              year: 'numeric' 
            })}
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{
              padding: '20px',
              backgroundColor: '#E3F2FD',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#1976D2', marginBottom: '8px' }}>
                Lojas com Pedidos
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1976D2' }}>
                {stats.totalStores}
              </div>
            </div>
            
            <div style={{
              padding: '20px',
              backgroundColor: '#E8F5E9',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#2E7D32', marginBottom: '8px' }}>
                Total Solicitado
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2E7D32' }}>
                {stats.totalRequested}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                unidades
              </div>
            </div>
            
            <div style={{
              padding: '20px',
              backgroundColor: '#FFF3E0',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#EF6C00', marginBottom: '8px' }}>
                Pendente de Envio
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#EF6C00' }}>
                {stats.totalPending}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                unidades
              </div>
            </div>
            
            <div style={{
              padding: '20px',
              backgroundColor: '#FCE4EC',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#C2185B', marginBottom: '8px' }}>
                Total de Pedidos
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#C2185B' }}>
                {stats.totalShipments}
              </div>
            </div>
          </div>
        </div>

        {/* ========== MONTANTE POR TIPO DE SALADA (PARA DATA DE ENTREGA) ========== */}
        {saladSummaries.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ 
              marginTop: 0, 
              color: '#333', 
              fontSize: '22px', 
              marginBottom: '25px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              🥗 Montante de Saladas para entrega em {new Date(selectedDate).toLocaleDateString('pt-BR')}
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '30px'
            }}>
              {saladSummaries.map((salad, index) => (
                <div key={index} style={{
                  padding: '20px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '12px',
                  borderLeft: `5px solid ${salad.salad_color}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '28px' }}>{salad.salad_emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{salad.salad_name}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {salad.stores_count} loja{salad.stores_count !== 1 ? 's' : ''} solicitou{salad.stores_count !== 1 ? 'ram' : ''}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '15px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Solicitado</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                        {salad.total_requested}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>unidades</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Pendente</div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        color: salad.total_pending > 0 ? '#FF9800' : '#4CAF50'
                      }}>
                        {salad.total_pending}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>unidades</div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '15px',
                    marginTop: '15px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Já Enviado</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
                        {salad.total_delivered}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>% Concluído</div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: salad.total_requested > 0 ? 
                          (salad.total_delivered / salad.total_requested * 100) >= 100 ? '#4CAF50' :
                          (salad.total_delivered / salad.total_requested * 100) >= 50 ? '#FF9800' : '#F44336'
                          : '#666'
                      }}>
                        {salad.total_requested > 0 ? 
                          Math.round(salad.total_delivered / salad.total_requested * 100) : 0}%
                      </div>
                    </div>
                  </div>
                  
                  {salad.total_pending > 0 && (
                    <div style={{
                      marginTop: '15px',
                      padding: '10px',
                      backgroundColor: salad.total_pending === salad.total_requested ? '#FFEBEE' : 
                                       salad.total_pending > salad.total_requested / 2 ? '#FFF3E0' : '#E8F5E9',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: salad.total_pending === salad.total_requested ? '#F44336' : 
                             salad.total_pending > salad.total_requested / 2 ? '#FF9800' : '#4CAF50'
                    }}>
                      {salad.total_pending === salad.total_requested ? (
                        <span>⚠️ <strong>TODAS {salad.total_pending} unidades</strong> pendentes!</span>
                      ) : salad.total_pending > salad.total_requested / 2 ? (
                        <span>⚠️ <strong>{salad.total_pending} unidades</strong> ainda pendentes</span>
                      ) : (
                        <span>✅ <strong>{salad.total_pending} unidades</strong> restantes</span>
                      )}
                    </div>
                  )}
                  
                  {salad.total_delivered >= salad.total_requested && salad.total_requested > 0 && (
                    <div style={{
                      marginTop: '15px',
                      padding: '10px',
                      backgroundColor: '#E8F5E9',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#2E7D32',
                      fontWeight: 'bold'
                    }}>
                      ✅ Produção COMPLETA para este tipo!
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* RESUMO GERAL DOS MONTANTES */}
            <div style={{
              marginTop: '20px',
              padding: '20px',
              backgroundColor: '#F5F5F5',
              borderRadius: '12px',
              borderTop: '2px solid #E0E0E0'
            }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#333' }}>
                📊 Resumo Geral dos Montantes
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '15px',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Solicitado</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196F3' }}>
                    {saladSummaries.reduce((sum, s) => sum + s.total_requested, 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>unidades totais</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Pendente</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#FF9800' }}>
                    {saladSummaries.reduce((sum, s) => sum + s.total_pending, 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>unidades pendentes</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Enviado</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>
                    {saladSummaries.reduce((sum, s) => sum + s.total_delivered, 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>unidades enviadas</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Progresso Geral</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196F3' }}>
                    {stats.totalRequested > 0 ? 
                      Math.round(stats.totalDelivered / stats.totalRequested * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>da produção</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== PEDIDOS POR LOJA (PARA DATA DE ENTREGA) ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '25px',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <h2 style={{ 
              margin: 0, 
              color: '#333', 
              fontSize: '22px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              🏪 Pedidos para entrega em {new Date(selectedDate).toLocaleDateString('pt-BR')}
              ({dailyShipments.length} pedido{dailyShipments.length !== 1 ? 's' : ''})
            </h2>
            
            {dailyShipments.length > 0 && (
              <div style={{
                padding: '10px 20px',
                backgroundColor: '#E8F5E9',
                color: '#2E7D32',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                📦 {stats.totalRequested} unidades totais
              </div>
            )}
          </div>
          
          {dailyShipments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: '#666' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#333' }}>
                Nenhum pedido para entrega em {new Date(selectedDate).toLocaleDateString('pt-BR')}
              </h3>
              <p style={{ margin: 0, fontSize: '16px' }}>
                Não há pedidos programados para entrega nesta data.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {dailyShipments.map((shipment) => {
                const totalPending = shipment.items.reduce((sum, item) => sum + item.pending_quantity, 0);
                const totalDelivered = shipment.items.reduce((sum, item) => sum + item.delivered_quantity, 0);
                const isPartiallyShipped = totalDelivered > 0 && totalPending > 0;
                const isFullyShipped = shipment.status === 'shipped';
                
                return (
                  <div key={shipment.shipment_id} style={{
                    padding: '25px',
                    backgroundColor: isFullyShipped ? '#E8F5E9' : isPartiallyShipped ? '#FFF8E1' : '#f9f9f9',
                    borderRadius: '12px',
                    borderLeft: `5px solid ${getStatusColor(shipment.status)}`,
                    borderTop: isPartiallyShipped ? '2px dashed #FFB74D' : 'none'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '20px',
                      flexWrap: 'wrap',
                      gap: '15px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                          <div style={{ 
                            fontWeight: 'bold', 
                            fontSize: '20px',
                            color: isPartiallyShipped ? '#FF9800' : isFullyShipped ? '#2E7D32' : '#333'
                          }}>
                            {shipment.store_name}
                          </div>
                          <div style={{
                            padding: '6px 14px',
                            backgroundColor: getStatusColor(shipment.status) + '20',
                            color: getStatusColor(shipment.status),
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {isPartiallyShipped ? '⚡ Parcialmente Enviado' : getStatusText(shipment.status)}
                          </div>
                        </div>
                        
                        <div style={{ fontSize: '14px', color: '#666', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <span>📋 {shipment.shipment_number}</span>
                          
                          <span>📅 Entrega para: {new Date(shipment.shipment_date).toLocaleDateString('pt-BR')}</span>
                          
                          <span>📦 {shipment.total_items} unidade{shipment.total_items !== 1 ? 's' : ''}</span>
                          
                          <span>📝 Pedido feito: {new Date(shipment.created_at).toLocaleDateString('pt-BR')}</span>
                          
                          {isFullyShipped && shipment.production_date && (
                            <span>✅ Enviado em: {new Date(shipment.production_date).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>
                      </div>
                      
                      {!isFullyShipped && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                            {totalPending} unidade{totalPending !== 1 ? 's' : ''} pendente{totalPending !== 1 ? 's' : ''}
                          </div>
                          
                          <button
                            onClick={() => handleSendShipment(shipment)}
                            style={{
                              padding: '12px 24px',
                              backgroundColor: totalPending === 0 ? '#4CAF50' : '#FF9800',
                              color: 'white',
                              border: 'none',
                              borderRadius: '10px',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            {totalPending === 0 ? '✅' : '🚚'} 
                            {totalPending === 0 ? 'Marcar como Enviado' : 'Enviar Pedido'}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Itens do pedido */}
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '15px',
                      marginTop: '15px'
                    }}>
                      {shipment.items.map((item, index) => {
                        const delivery = shipmentDeliveries.find(
                          d => d.shipment_id === shipment.shipment_id && d.salad_type_id === item.salad_type_id
                        );
                        
                        return (
                          <div key={index} style={{
                            padding: '15px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #eee',
                            borderLeft: `4px solid ${item.salad_color}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                              <span style={{ fontSize: '20px' }}>{item.salad_emoji}</span>
                              <div style={{ fontWeight: 'bold', flex: 1 }}>{item.salad_name}</div>
                            </div>
                            
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr 1fr', 
                              gap: '10px',
                              fontSize: '14px'
                            }}>
                              <div>
                                <div style={{ color: '#666', fontSize: '12px' }}>Solicitado</div>
                                <div style={{ fontWeight: 'bold' }}>{item.requested_quantity} un.</div>
                              </div>
                              <div>
                                <div style={{ color: '#666', fontSize: '12px' }}>Pendente</div>
                                <div style={{ 
                                  fontWeight: 'bold',
                                  color: item.pending_quantity > 0 ? '#FF9800' : '#4CAF50'
                                }}>
                                  {item.pending_quantity} un.
                                </div>
                              </div>
                            </div>
                            
                            {delivery && (
                              <div style={{
                                marginTop: '8px',
                                padding: '6px',
                                backgroundColor: '#E8F5E9',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#2E7D32',
                                textAlign: 'center'
                              }}>
                                ✅ {delivery.delivered_quantity} un. enviada{delivery.delivered_quantity !== 1 ? 's' : ''}
                                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                  Lote: {delivery.batch_number}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========== MODAL DE ENVIO COM LOTE ========== */}
        {showSendModal && selectedShipment && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '40px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#FF9800' }}>
                  🚚 Enviar Pedido
                </h2>
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    setSelectedShipment(null);
                    setAdjustedQuantities({});
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                  Loja: {selectedShipment.store_name}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  Pedido: {selectedShipment.shipment_number}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  Entrega para: {new Date(selectedShipment.shipment_date).toLocaleDateString('pt-BR')}
                </div>
              </div>

              {/* CAMPO DE LOTE */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                  📦 Número do Lote
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Ex: LOTE-20240115"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8fff8'
                  }}
                />
                <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                  Referência para controle de validade (formato: LOTE-AAAAMMDD)
                </div>
              </div>

              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '16px', color: '#333', marginBottom: '15px' }}>
                  Ajuste as quantidades a serem enviadas:
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {selectedShipment.items.map((item) => (
                    <div key={item.salad_type_id} style={{
                      padding: '15px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{item.salad_emoji}</span>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{item.salad_name}</div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              Pendente: {item.pending_quantity} un.
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ 
                          padding: '6px 12px',
                          backgroundColor: item.delivered_quantity > 0 ? '#E8F5E9' : '#FFF3E0',
                          color: item.delivered_quantity > 0 ? '#2E7D32' : '#FF9800',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}>
                          {item.delivered_quantity > 0 ? `✅ ${item.delivered_quantity} enviada` : '⏳ Pendente'}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                            Quantidade a enviar:
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              onClick={() => updateAdjustedQuantity(
                                item.salad_type_id, 
                                Math.max(0, (adjustedQuantities[item.salad_type_id] || item.pending_quantity) - 1)
                              )}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#e0e0e0',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '16px'
                              }}
                            >
                              -
                            </button>
                            
                            <input
                              type="number"
                              value={adjustedQuantities[item.salad_type_id] || item.pending_quantity}
                              onChange={(e) => updateAdjustedQuantity(
                                item.salad_type_id, 
                                Math.max(0, parseInt(e.target.value) || 0)
                              )}
                              min="0"
                              max={item.requested_quantity}
                              style={{
                                width: '80px',
                                padding: '10px',
                                border: '2px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '16px',
                                textAlign: 'center'
                              }}
                            />
                            
                            <button
                              onClick={() => updateAdjustedQuantity(
                                item.salad_type_id, 
                                Math.min(
                                  item.requested_quantity, 
                                  (adjustedQuantities[item.salad_type_id] || item.pending_quantity) + 1
                                )
                              )}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: '#e0e0e0',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '16px'
                              }}
                            >
                              +
                            </button>
                            
                            <div style={{ fontSize: '14px', color: '#666', marginLeft: '10px' }}>
                              de {item.requested_quantity} solicitada{item.requested_quantity !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo */}
              <div style={{
                padding: '20px',
                backgroundColor: '#FFF3E0',
                borderRadius: '12px',
                marginBottom: '25px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    Loja:
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>
                    {selectedShipment.store_name}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    Entrega para:
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF9800' }}>
                    {new Date(selectedShipment.shipment_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    Lote:
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
                    {batchNumber}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    Total a ser enviado:
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                    {Object.values(adjustedQuantities).reduce((sum, q) => sum + q, 0)} unidades
                  </div>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                  Esta ação registrará o envio com o lote informado para controle de validade.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    setSelectedShipment(null);
                    setAdjustedQuantities({});
                  }}
                  style={{
                    flex: 1,
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    color: '#666',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => markAsShipped(selectedShipment.shipment_id, adjustedQuantities, batchNumber)}
                  disabled={sending}
                  style={{
                    flex: 2,
                    padding: '15px',
                    backgroundColor: sending ? '#ccc' : '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: sending ? 'not-allowed' : 'pointer'
                  }}
                >
                  {sending ? 'Processando...' : '✅ Confirmar Envio com Lote'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
