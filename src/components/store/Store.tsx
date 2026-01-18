// src/components/store/StoreDashboard.tsx - VERSÃO 100% FUNCIONAL
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../common/Header';
import { getSaladTypes, getSauces, LOSS_REASONS, ORDER_STATUS, formatDate } from '../../data/saladTypes';

// Interfaces
interface SaladType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  validity_days: number;
  sale_price: number;
  requires_sauce: boolean; // ← AGORA VEM DO BANCO!
}

interface Sauce {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  is_active: boolean;
}

interface CartItem {
  id: string;
  salad_type_id: string;
  name: string;
  emoji: string;
  quantity: number;
  sauce_id?: string;
  sauce_name?: string;
  sauce_emoji?: string;
}

interface LossItem {
  id: string;
  salad_type_id: string;
  name: string;
  emoji: string;
  quantity: number;
  batch_number: string;
  reason: string;
  loss_value?: number;
  notes?: string;
}

interface RecentOrder {
  id: string;
  shipment_number: string;
  created_at: string;
  status: string;
  total_items: number;
}

interface Store {
  id: string;
  name: string;
}

// Funções auxiliares
const generateSequenceNumber = (prefix: string, lastNumber: number): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const sequence = String(lastNumber + 1).padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${sequence}`;
};

const getDataAtualLocal = (): string => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const getDataAmanhaLocal = (): string => {
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const ano = amanha.getFullYear();
  const mes = String(amanha.getMonth() + 1).padStart(2, '0');
  const dia = String(amanha.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

const getDataMinimaLocal = (): string => getDataAtualLocal();

export default function StoreDashboard() {
  const [storeData, setStoreData] = useState<Store | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [userDbId, setUserDbId] = useState<string>('');
  
  // ESTADOS CRÍTICOS - COM MOLHOS
  const [saladTypes, setSaladTypes] = useState<SaladType[]>([]);
  const [sauces, setSauces] = useState<Sauce[]>([]);
  const [selectedSauce, setSelectedSauce] = useState<string>('');
  const [selectedSaladNeedsSauce, setSelectedSaladNeedsSauce] = useState<boolean>(true);
  const [sauceError, setSauceError] = useState<string>('');
  
  // Estados para modais
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  
  // Estados do carrinho
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  const [selectedSaladType, setSelectedSaladType] = useState<string>('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryDate, setDeliveryDate] = useState(getDataAmanhaLocal());
  const [dataMinimaEntrega, setDataMinimaEntrega] = useState('');
  
  // Estados de perdas
  const [lossCart, setLossCart] = useState<LossItem[]>([]);
  const [selectedLossType, setSelectedLossType] = useState<string>('');
  const [lossQuantity, setLossQuantity] = useState(1);
  const [batchNumber, setBatchNumber] = useState('');
  const [lossReason, setLossReason] = useState('validade');
  const [lossNotes, setLossNotes] = useState('');
  
  // Pedidos recentes
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lastOrderNumber, setLastOrderNumber] = useState(0);
  const [lastLossNumber, setLastLossNumber] = useState(0);

  useEffect(() => {
    setDataMinimaEntrega(getDataMinimaLocal());
    
    const initDashboard = async () => {
      console.log('🚀 Iniciando dashboard da loja COM MOLHOS...');
      
      try {
        // 1. Verificar sessão
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          window.location.href = '/login/lojas';
          return;
        }
        
        setUserEmail(session.user.email || '');
        
        // 2. Buscar dados da loja
        const { data: userData } = await supabase
          .from('users')
          .select(`id, full_name, store_id, stores (id, name)`)
          .eq('auth_id', session.user.id)
          .single();
          
        if (userData) {
          const store = (userData as any).stores;
          if (store) {
            setUserDbId(userData.id);
            setStoreData(store);
            fetchRecentOrders(store.id);
            fetchLastSequenceNumbers(store.id);
          }
        }
        
        // 3. BUSCAR TIPOS DE SALADA (COM requires_sauce)
        console.log('🥗 Buscando tipos de salada...');
        const saladTypesData = await getSaladTypes();
        console.log('✅ Saladas recebidas:', saladTypesData);
        setSaladTypes(saladTypesData);
        
        if (saladTypesData.length > 0) {
          const firstSalad = saladTypesData[0];
          setSelectedSaladType(firstSalad.id);
          setSelectedLossType(firstSalad.id);
          setSelectedSaladNeedsSauce(firstSalad.requires_sauce);
          console.log(`📝 Primeira salada: ${firstSalad.name}, precisa de molho: ${firstSalad.requires_sauce}`);
        }
        
        // 4. BUSCAR MOLHOS
        console.log('🧂 Buscando molhos...');
        const saucesData = await getSauces();
        console.log('✅ Molhos recebidos:', saucesData);
        setSauces(saucesData);
        setSelectedSauce('');
        
        // 5. Gerar lote padrão
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        setBatchNumber(`LOTE-${ano}${mes}${dia}`);
        
      } catch (err: any) {
        console.error('❌ Erro ao inicializar:', err);
        alert(`Erro: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  // Efeito para detectar mudança de salada
  useEffect(() => {
    const salad = saladTypes.find(s => s.id === selectedSaladType);
    if (salad) {
      console.log(`🎯 Salada selecionada: ${salad.name}, requires_sauce: ${salad.requires_sauce}`);
      setSelectedSaladNeedsSauce(salad.requires_sauce);
      setSelectedSauce('');
      setSauceError('');
    }
  }, [selectedSaladType, saladTypes]);

  // Buscar pedidos recentes
  const fetchRecentOrders = async (storeId: string) => {
    try {
      const { data } = await supabase
        .from('production_shipments')
        .select('id, shipment_number, created_at, status, total_items')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) {
        setRecentOrders(data.map(order => ({
          id: order.id,
          shipment_number: order.shipment_number,
          created_at: order.created_at,
          status: order.status,
          total_items: order.total_items
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos recentes:', error);
    }
  };

  const fetchLastSequenceNumbers = async (storeId: string) => {
    try {
      const { data: lastOrder } = await supabase
        .from('production_shipments')
        .select('shipment_number')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastOrder?.shipment_number) {
        const match = lastOrder.shipment_number.match(/-(\d{4})$/);
        if (match) setLastOrderNumber(parseInt(match[1]));
      }
    } catch (error) {
      console.error('Erro ao buscar números de sequência:', error);
    }
  };

  // ========== FUNÇÕES DO PEDIDO COM MOLHOS ==========
  const addToOrderCart = () => {
    const salad = saladTypes.find(s => s.id === selectedSaladType);
    const sauce = sauces.find(s => s.id === selectedSauce);
    
    if (!salad) {
      alert('Selecione uma salada!');
      return;
    }
    
    // VALIDAÇÃO CRÍTICA
    if (salad.requires_sauce && !selectedSauce) {
      setSauceError('⚠️ Por favor, selecione um molho para esta salada!');
      return;
    }
    
    setSauceError('');
    
    const existingItem = orderCart.find(item => 
      item.salad_type_id === selectedSaladType && 
      item.sauce_id === selectedSauce
    );
    
    if (existingItem) {
      setOrderCart(orderCart.map(item =>
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + orderQuantity }
          : item
      ));
    } else {
      const newItem: CartItem = {
        id: `${Date.now()}-${selectedSaladType}-${selectedSauce || 'sem-molho'}`,
        salad_type_id: selectedSaladType,
        name: salad.name,
        emoji: salad.emoji,
        quantity: orderQuantity,
        sauce_id: selectedSauce || undefined,
        sauce_name: sauce?.name,
        sauce_emoji: sauce?.emoji
      };
      setOrderCart([...orderCart, newItem]);
    }
    
    setOrderQuantity(1);
  };

  const removeOrderItem = (id: string) => {
    setOrderCart(orderCart.filter(item => item.id !== id));
  };

  const updateOrderQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setOrderCart(orderCart.map(item =>
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
  };

  const submitOrder = async () => {
    if (orderCart.length === 0) {
      alert('Adicione pelo menos um item ao pedido!');
      return;
    }

    if (!storeData?.id) {
      alert('Erro: Loja não identificada.');
      return;
    }

    try {
      const totalItems = orderCart.reduce((sum, item) => sum + item.quantity, 0);
      const shipmentNumber = generateSequenceNumber('PED', lastOrderNumber);
      
      const { data: shipment, error: shipmentError } = await supabase
        .from('production_shipments')
        .insert({
          shipment_number: shipmentNumber,
          store_id: storeData.id,
          status: 'pending',
          total_items: totalItems,
          notes: `Entrega desejada: ${formatDate(deliveryDate)}`,
          created_by: userDbId,
          shipment_date: deliveryDate
        })
        .select()
        .single();
      
      if (shipmentError) throw shipmentError;
      
      for (const item of orderCart) {
        const salad = saladTypes.find(s => s.id === item.salad_type_id);
        const unitPrice = salad?.sale_price || 0;
        
        const today = new Date();
        const productionDate = today.toISOString().slice(0, 10);
        const expirationDate = new Date(today);
        expirationDate.setDate(expirationDate.getDate() + 3);
        
        const itemData: any = {
          shipment_id: shipment.id,
          salad_type_id: item.salad_type_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          production_date: productionDate,
          expiration_date: expirationDate.toISOString().slice(0, 10)
        };
        
        if (item.sauce_id) {
          itemData.sauce_id = item.sauce_id;
        }
        
        const { error: itemError } = await supabase
          .from('production_items')
          .insert(itemData);

        if (itemError) throw itemError;
      }
      
      alert(`✅ Pedido ${shipmentNumber} enviado com sucesso!\nData de entrega: ${formatDate(deliveryDate)}`);
      
      setLastOrderNumber(prev => prev + 1);
      setOrderCart([]);
      setShowOrderModal(false);
      setSelectedSauce('');
      setSauceError('');
      setDeliveryDate(getDataAmanhaLocal());
      
      const newOrder: RecentOrder = {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        created_at: new Date().toISOString(),
        status: shipment.status,
        total_items: shipment.total_items
      };
      setRecentOrders([newOrder, ...recentOrders]);
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar pedido:', error);
      alert(`Erro: ${error.message || 'Erro desconhecido'}`);
    }
  };

  // ========== FUNÇÕES DE PERDAS (mantidas) ==========
  const addToLossCart = () => {
    const salad = saladTypes.find(s => s.id === selectedLossType);
    const reason = LOSS_REASONS.find(r => r.id === lossReason);
    
    if (!salad || !reason) return;
    
    const lossValue = salad.sale_price * lossQuantity;
    
    const newItem: LossItem = {
      id: Date.now().toString(),
      salad_type_id: selectedLossType,
      name: salad.name,
      emoji: salad.emoji,
      quantity: lossQuantity,
      batch_number: batchNumber,
      reason: reason.name,
      loss_value: lossValue,
      notes: lossNotes
    };
    
    setLossCart([...lossCart, newItem]);
    setLossQuantity(1);
    setLossNotes('');
  };
  
  const removeLossItem = (id: string) => {
    setLossCart(lossCart.filter(item => item.id !== id));
  };
  
  const submitLosses = async () => {
    if (lossCart.length === 0) {
      alert('Adicione pelo menos uma perda!');
      return;
    }

    if (!storeData?.id) {
      alert('Erro: Loja não identificada.');
      return;
    }

    try {
      const lossNumber = generateSequenceNumber('PER', lastLossNumber);
      const totalLossValue = lossCart.reduce((sum, item) => sum + (item.loss_value || 0), 0);
      
      const { data: lossRecord, error } = await supabase
        .from('losses')
        .insert({
          loss_number: lossNumber,
          store_id: storeData.id,
          total_value: totalLossValue,
          created_by: userDbId
        })
        .select()
        .single();

      if (error) throw error;

      for (const item of lossCart) {
        const salad = saladTypes.find(s => s.id === item.salad_type_id);
        await supabase
          .from('loss_items')
          .insert({
            loss_id: lossRecord.id,
            salad_type_id: item.salad_type_id,
            quantity: item.quantity,
            batch_number: item.batch_number,
            reason: item.reason,
            unit_value: salad?.sale_price || 0,
            total_value: item.loss_value || 0,
            notes: item.notes
          });
      }

      alert(`✅ Perdas registradas!\nNúmero: ${lossNumber}\nValor: R$ ${totalLossValue.toFixed(2)}`);
      
      setLastLossNumber(prev => prev + 1);
      setLossCart([]);
      setShowLossModal(false);
      
    } catch (error: any) {
      console.error('Erro ao registrar perdas:', error);
      alert(`Erro: ${error.message}`);
    }
  };

  // ========== RENDERIZAÇÃO ==========
  if (loading || saladTypes.length === 0) {
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
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2196F3' }}>
          🌅 Sunset Saladas
        </div>
        <div>Carregando dashboard da loja...</div>
        <div style={{ width: '50px', height: '50px', border: '5px solid #e0e0e0',
          borderTop: '5px solid #2196F3', borderRadius: '50%', animation: 'spin 1s linear infinite' }}>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Header 
        title={`Dashboard - ${storeData?.name || 'Minha Loja'}`}
        userEmail={userEmail}
        storeName={storeData?.name}
        profileType="lojas"
      />
      
      <main style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* CARDS PRINCIPAIS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px', marginBottom: '50px' }}>
          <div style={{ padding: '35px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            border: '2px solid #4CAF50', cursor: 'pointer', transition: 'all 0.3s ease', textAlign: 'center' }}
            onClick={() => setShowOrderModal(true)}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🥗🧂</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', color: '#2E7D32' }}>Solicitar Saladas</h2>
            <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.5', marginBottom: '25px' }}>
              Faça pedidos de saladas para produção. Escolha os tipos, quantidades e molhos.
            </p>
            <div style={{ padding: '12px 25px', backgroundColor: '#4CAF50', color: 'white', border: 'none',
              borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-block' }}>
              + Novo Pedido
            </div>
          </div>

          <div style={{ padding: '35px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            border: '2px solid #F44336', cursor: 'pointer', transition: 'all 0.3s ease', textAlign: 'center' }}
            onClick={() => setShowLossModal(true)}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>📉</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', color: '#C62828' }}>Registrar Perdas</h2>
            <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.5', marginBottom: '25px' }}>
              Registre perdas diárias por validade, qualidade, manuseio ou outros motivos.
            </p>
            <div style={{ padding: '12px 25px', backgroundColor: '#F44336', color: 'white', border: 'none',
              borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-block' }}>
              + Registrar Perdas
            </div>
          </div>
        </div>

        {/* PEDIDOS RECENTES */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginTop: '20px' }}>
          <h2 style={{ marginTop: 0, color: '#333', fontSize: '20px', marginBottom: '25px' }}>📦 Pedidos Recentes</h2>
          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Nenhum pedido realizado ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {recentOrders.map(order => {
                const status = Object.values(ORDER_STATUS).find(s => s.id === order.status);
                return (
                  <div key={order.id} style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '12px',
                    borderLeft: `4px solid ${status?.color || '#999'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{order.shipment_number}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ padding: '4px 12px', backgroundColor: (status?.color || '#999') + '20',
                          color: status?.color || '#999', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                          {status?.name || order.status}
                        </span>
                        <span style={{ color: '#666', fontSize: '14px' }}>
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>Total: {order.total_items} unidades</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL: SOLICITAR SALADAS - COM MOLHOS */}
        {showOrderModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px',
              width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#2E7D32' }}>🥗 Solicitar Saladas</h2>
                <button onClick={() => { setShowOrderModal(false); setSelectedSauce(''); setSauceError(''); }}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>
                  ✕
                </button>
              </div>

              {/* FORMULÁRIO COM MOLHOS */}
              <div style={{ padding: '25px', backgroundColor: '#f8f9fa', borderRadius: '12px', marginBottom: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Tipo de Salada
                    </label>
                    <select value={selectedSaladType} onChange={(e) => setSelectedSaladType(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '2px solid #ddd',
                        borderRadius: '8px', fontSize: '16px' }}>
                      {saladTypes.map(salad => (
                        <option key={salad.id} value={salad.id}>
                          {salad.emoji} {salad.name}
                          {!salad.requires_sauce && ' (sem molho)'}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                      {selectedSaladNeedsSauce ? '🔵 Precisa de molho' : '🟢 Não precisa de molho'}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Quantidade
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                        style={{ padding: '10px 15px', backgroundColor: '#f0f0f0', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '18px' }}>-</button>
                      <input type="number" value={orderQuantity}
                        onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)} min="1"
                        style={{ width: '80px', padding: '12px', border: '2px solid #ddd',
                          borderRadius: '8px', fontSize: '16px', textAlign: 'center' }} />
                      <button onClick={() => setOrderQuantity(orderQuantity + 1)}
                        style={{ padding: '10px 15px', backgroundColor: '#f0f0f0', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '18px' }}>+</button>
                    </div>
                  </div>
                </div>

                {/* CAMPO DE MOLHO - DINÂMICO */}
                {selectedSaladNeedsSauce ? (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      🧂 Molho para a Salada <span style={{ color: '#f44336' }}>*</span>
                    </label>
                    <select value={selectedSauce} onChange={(e) => { setSelectedSauce(e.target.value); setSauceError(''); }}
                      style={{ width: '100%', padding: '12px', border: `2px solid ${sauceError ? '#f44336' : '#ddd'}`,
                        borderRadius: '8px', fontSize: '16px', backgroundColor: selectedSauce ? '#f8fff8' : '#fff8f8' }}>
                      <option value="">-- Selecione um molho --</option>
                      {sauces.map(sauce => (
                        <option key={sauce.id} value={sauce.id}>{sauce.emoji} {sauce.name}</option>
                      ))}
                    </select>
                    {sauceError && (
                      <div style={{ color: '#f44336', fontSize: '14px', marginTop: '5px',
                        padding: '8px', backgroundColor: '#ffebee', borderRadius: '6px' }}>⚠️ {sauceError}</div>
                    )}
                    {selectedSauce && (
                      <div style={{ fontSize: '14px', color: '#2e7d32', marginTop: '5px',
                        padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '6px' }}>
                        ✅ {sauces.find(s => s.id === selectedSauce)?.description}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px',
                    marginBottom: '20px', fontSize: '14px', color: '#2e7d32', display: 'flex',
                    alignItems: 'center', gap: '10px', border: '1px solid #c8e6c9' }}>
                    <span style={{ fontSize: '18px' }}>✅</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Esta salada não precisa de molho</div>
                      <div style={{ fontSize: '13px', marginTop: '3px' }}>Salada de frutas é servida natural, sem molhos.</div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                    📅 Data de Entrega Desejada
                  </label>
                  <input type="date" min={dataMinimaEntrega} value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={{ width: '100%', padding: '12px', border: '2px solid #ddd',
                      borderRadius: '8px', fontSize: '16px', backgroundColor: '#f8fff8' }} />
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    Data selecionada: <strong>{formatDate(deliveryDate)}</strong>
                  </div>
                </div>

                <button onClick={addToOrderCart}
                  style={{ width: '100%', padding: '15px', backgroundColor: '#4CAF50',
                    color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px',
                    fontWeight: 'bold', cursor: 'pointer' }}>➕ Adicionar ao Carrinho</button>
              </div>

              {/* CARRINHO COM MOLHOS */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '15px' }}>
                  Resumo do Pedido ({orderCart.length} itens)
                </h3>
                {orderCart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#999',
                    backgroundColor: '#f9f9f9', borderRadius: '12px' }}>Carrinho vazio</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {orderCart.map(item => {
                      const salad = saladTypes.find(s => s.id === item.salad_type_id);
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', padding: '15px', backgroundColor: '#f9f9f9',
                          borderRadius: '10px', borderLeft: `4px solid ${salad?.color || '#4CAF50'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '24px' }}>{salad?.emoji}</span>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{salad?.name}</div>
                              {item.sauce_name ? (
                                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                                  <span style={{ marginRight: '5px' }}>{item.sauce_emoji || '🧂'}</span>
                                  <strong>{item.sauce_name}</strong>
                                </div>
                              ) : (
                                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px', fontStyle: 'italic' }}>
                                  (sem molho)
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                                <button onClick={() => updateOrderQuantity(item.id, item.quantity - 1)}
                                  style={{ padding: '5px 10px', backgroundColor: '#e0e0e0',
                                    border: 'none', borderRadius: '4px', cursor: 'pointer' }}>-</button>
                                <span style={{ fontWeight: 'bold' }}>{item.quantity} un.</span>
                                <button onClick={() => updateOrderQuantity(item.id, item.quantity + 1)}
                                  style={{ padding: '5px 10px', backgroundColor: '#e0e0e0',
                                    border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => removeOrderItem(item.id)}
                            style={{ padding: '8px 12px', backgroundColor: '#ffebee',
                              color: '#f44336', border: 'none', borderRadius: '6px',
                              cursor: 'pointer', fontSize: '14px' }}>Remover</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {orderCart.length > 0 && (
                <div style={{ padding: '20px', backgroundColor: '#e8f5e9',
                  borderRadius: '12px', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Total de Unidades:</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E7D32' }}>
                      {orderCart.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Data de Entrega:</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2E7D32' }}>
                      {formatDate(deliveryDate)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => { setShowOrderModal(false); setOrderCart([]);
                  setSelectedSauce(''); setSauceError(''); }}
                  style={{ flex: 1, padding: '15px', backgroundColor: '#f5f5f5',
                    color: '#666', border: 'none', borderRadius: '10px', fontSize: '16px',
                    fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={submitOrder} disabled={orderCart.length === 0}
                  style={{ flex: 2, padding: '15px', backgroundColor: orderCart.length === 0 ? '#ccc' : '#4CAF50',
                    color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px',
                    fontWeight: 'bold', cursor: orderCart.length === 0 ? 'not-allowed' : 'pointer' }}>
                  🚀 Enviar Pedido para Produção
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REGISTRAR PERDAS (mantido igual) */}
        {showLossModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px',
              width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#C62828' }}>📉 Registrar Perdas</h2>
                <button onClick={() => setShowLossModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>
                  ✕
                </button>
              </div>

              <div style={{ padding: '25px', backgroundColor: '#fff8f8', borderRadius: '12px', marginBottom: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Tipo de Salada</label>
                    <select value={selectedLossType} onChange={(e) => setSelectedLossType(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '16px' }}>
                      {saladTypes.map(salad => <option key={salad.id} value={salad.id}>{salad.emoji} {salad.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Quantidade</label>
                    <input type="number" value={lossQuantity} onChange={(e) => setLossQuantity(parseInt(e.target.value) || 1)} min="1"
                      style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '16px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Lote</label>
                    <input type="text" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="LOTE-AAAAMMDD"
                      style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '16px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Motivo</label>
                    <select value={lossReason} onChange={(e) => setLossReason(e.target.value)}
                      style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '8px', fontSize: '16px' }}>
                      {LOSS_REASONS.map(reason => <option key={reason.id} value={reason.id}>{reason.emoji} {reason.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>Observações</label>
                  <textarea value={lossNotes} onChange={(e) => setLossNotes(e.target.value)} placeholder="Detalhes..."
                    style={{ width: '100%', padding: '12px', border: '2px solid #ddd', borderRadius: '8px',
                      fontSize: '16px', minHeight: '80px', resize: 'vertical' }} />
                </div>
                <button onClick={addToLossCart}
                  style={{ width: '100%', padding: '15px', backgroundColor: '#F44336',
                    color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px',
                    fontWeight: 'bold', cursor: 'pointer' }}>➕ Adicionar ao Registro</button>
              </div>

              {lossCart.length > 0 && (
                <>
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '15px' }}>Perdas a Registrar ({lossCart.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {lossCart.map(item => {
                        const salad = saladTypes.find(s => s.id === item.salad_type_id);
                        const reason = LOSS_REASONS.find(r => r.name === item.reason);
                        return (
                          <div key={item.id} style={{ padding: '15px', backgroundColor: '#fff8f8',
                            borderRadius: '10px', borderLeft: `4px solid ${reason?.color || '#999'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>{salad?.emoji}</span>
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{salad?.name}</div>
                                  <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                                    {item.quantity} un. • Lote: {item.batch_number}
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#C62828' }}>
                                  R$ {item.loss_value?.toFixed(2) || '0.00'}
                                </div>
                                <button onClick={() => removeLossItem(item.id)}
                                  style={{ padding: '6px 10px', backgroundColor: '#ffebee',
                                    color: '#f44336', border: 'none', borderRadius: '6px',
                                    cursor: 'pointer', fontSize: '13px', marginTop: '5px' }}>Remover</button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                              <span style={{ padding: '4px 10px', backgroundColor: (reason?.color || '#999') + '20',
                                color: reason?.color || '#999', borderRadius: '20px',
                                fontSize: '12px', fontWeight: 'bold' }}>{reason?.emoji} {item.reason}</span>
                              {item.notes && <span style={{ fontSize: '13px', color: '#666', fontStyle: 'italic' }}>"{item.notes}"</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ padding: '20px', backgroundColor: '#ffebee', borderRadius: '12px', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Total de Perdas:</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#C62828' }}>
                        {lossCart.reduce((sum, item) => sum + item.quantity, 0)} unidades
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Valor Total:</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#C62828' }}>
                        R$ {lossCart.reduce((sum, item) => sum + (item.loss_value || 0), 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => { setShowLossModal(false); setLossCart([]); }}
                  style={{ flex: 1, padding: '15px', backgroundColor: '#f5f5f5',
                    color: '#666', border: 'none', borderRadius: '10px', fontSize: '16px',
                    fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={submitLosses} disabled={lossCart.length === 0}
                  style={{ flex: 2, padding: '15px', backgroundColor: lossCart.length === 0 ? '#ccc' : '#F44336',
                    color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px',
                    fontWeight: 'bold', cursor: lossCart.length === 0 ? 'not-allowed' : 'pointer' }}>
                  ✅ Concluir Perdas do Dia
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}