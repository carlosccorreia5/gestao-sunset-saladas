// src/components/store/Store.tsx - VERSÃO COMPLETA E CORRIGIDA
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../common/Header';
import { getSaladTypes, LOSS_REASONS, ORDER_STATUS } from '../../data/saladTypes';

// Interfaces
interface SaladType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  validity_days: number;
  sale_price: number;
}

interface CartItem {
  id: string;
  salad_type_id: string;
  name: string;
  emoji: string;
  quantity: number;
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

// Função para gerar números de sequência
const generateSequenceNumber = (prefix: string, lastNumber: number): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const sequence = String(lastNumber + 1).padStart(4, '0');
  return `${prefix}-${year}${month}${day}-${sequence}`;
};

export default function StoreDashboard() {
  const [storeData, setStoreData] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  
  // CORREÇÃO: Adicionado _ para variável não usada
  const [_userId, setUserId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [userDbId, setUserDbId] = useState<string>('');
  const [saladTypes, setSaladTypes] = useState<SaladType[]>([]);
  
  // Estados para os modais
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  
  // Estados do carrinho de pedidos
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  const [selectedSaladType, setSelectedSaladType] = useState<string>('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const today = new Date();
    // Adiciona 1 dia por padrão (entrega para amanhã)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  
  // Estados do registro de perdas
  const [lossCart, setLossCart] = useState<LossItem[]>([]);
  const [selectedLossType, setSelectedLossType] = useState<string>('');
  const [lossQuantity, setLossQuantity] = useState(1);
  const [batchNumber, setBatchNumber] = useState('');
  
  // CORREÇÃO: Mudado para um valor específico
  const [lossReason, setLossReason] = useState('validade');
  
  const [lossNotes, setLossNotes] = useState('');
  
  // Pedidos recentes
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lastOrderNumber, setLastOrderNumber] = useState(0);
  const [lastLossNumber, setLastLossNumber] = useState(0);

  useEffect(() => {
    const initDashboard = async () => {
      console.log('🚀 Iniciando dashboard da loja...');
      
      try {
        // 1. Verifica sessão
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
          console.error('❌ Nenhuma sessão encontrada');
          window.location.href = '/login/lojas';
          return;
        }
        
        console.log('✅ Sessão encontrada para:', session.user.email);
        setUserEmail(session.user.email || '');
        setUserId(session.user.id);
        
        // 2. Busca dados da loja (já associada ao usuário)
        const { data: userData, error } = await supabase
          .from('users')
          .select(`id, full_name, store_id, stores!inner (id, name)`)
          .eq('auth_id', session.user.id)
          .single();
          
        if (error) {
          console.error('❌ Erro ao buscar dados da loja:', error);
        } else if (userData) {
          // CORREÇÃO: Acessando array corretamente
          const store = userData.stores?.[0];
          console.log('✅ Loja encontrada:', store?.name);
          setUserDbId(userData.id);
          setStoreData(store);
          
          // 3. Buscar pedidos recentes desta loja
          if (store?.id) {
            fetchRecentOrders(store.id);
            
            // 4. Buscar últimos números de sequência
            fetchLastSequenceNumbers(store.id);
          }
        }
        
        // 5. Buscar tipos de salada do banco
        const saladTypesData = await getSaladTypes();
        setSaladTypes(saladTypesData);
        
        if (saladTypesData.length > 0) {
          setSelectedSaladType(saladTypesData[0].id);
          setSelectedLossType(saladTypesData[0].id);
        }
        
        // 6. Gerar número de lote padrão (data atual)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setBatchNumber(`LOTE-${year}${month}${day}`);
        
      } catch (err: any) {
        console.error('❌ Erro ao inicializar dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  // Buscar pedidos recentes
  const fetchRecentOrders = async (storeId: string) => {
    try {
      const { data, error } = await supabase
        .from('production_shipments')
        .select('id, shipment_number, created_at, status, total_items')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
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

  // Buscar últimos números de sequência
  const fetchLastSequenceNumbers = async (storeId: string) => {
    try {
      // Último pedido
      const { data: lastOrder, error: orderError } = await supabase
        .from('production_shipments')
        .select('shipment_number')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (orderError) {
        console.error('Erro ao buscar último pedido:', orderError);
      }
      
      if (lastOrder?.shipment_number) {
        const match = lastOrder.shipment_number.match(/-(\d{4})$/);
        if (match) {
          setLastOrderNumber(parseInt(match[1]));
        }
      }
      
      // Última perda
      const { data: lastLoss, error: lossError } = await supabase
        .from('losses')
        .select('loss_number')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lossError) {
        console.error('Erro ao buscar última perda:', lossError);
      }
      
      if (lastLoss?.loss_number) {
        const match = lastLoss.loss_number.match(/-(\d{4})$/);
        if (match) {
          setLastLossNumber(parseInt(match[1]));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar números de sequência:', error);
    }
  };

  // Validação do formato do lote
  const validateBatchNumber = (batch: string): boolean => {
    // Verifica se tem o formato básico LOTE-YYYYMMDD
    const pattern = /^LOTE-\d{8}$/;
    if (!pattern.test(batch)) {
      alert('❌ Formato do lote inválido! Use: LOTE-AAAAMMDD\nEx: LOTE-20240115');
      return false;
    }
    
    // Verifica se a data é válida
    const dateStr = batch.replace('LOTE-', '');
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const date = new Date(year, month, day);
    
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      alert('❌ Data do lote inválida!');
      return false;
    }
    
    return true;
  };

  // ========== FUNÇÕES DO PEDIDO DE SALADAS ==========
  const addToOrderCart = () => {
    const salad = saladTypes.find(s => s.id === selectedSaladType);
    if (!salad) return;
    
    const existingItem = orderCart.find(item => item.salad_type_id === selectedSaladType);
    
    if (existingItem) {
      // Atualiza quantidade se já existe
      setOrderCart(orderCart.map(item =>
        item.salad_type_id === selectedSaladType
          ? { ...item, quantity: item.quantity + orderQuantity }
          : item
      ));
    } else {
      // Adiciona novo item
      const newItem: CartItem = {
        id: Date.now().toString(),
        salad_type_id: selectedSaladType,
        name: salad.name,
        emoji: salad.emoji,
        quantity: orderQuantity
      };
      setOrderCart([...orderCart, newItem]);
    }
    
    // Reseta quantidade
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
      
      console.log('📦 Salvando pedido no banco...', {
        storeId: storeData.id,
        totalItems,
        shipmentNumber,
        deliveryDate
      });
      
      // 1. Criar registro principal em production_shipments
      const { data: shipment, error: shipmentError } = await supabase
        .from('production_shipments')
        .insert({
          shipment_number: shipmentNumber,
          store_id: storeData.id,
          status: 'pending',
          total_items: totalItems,
          notes: `Entrega desejada: ${deliveryDate}`,
          created_by: userDbId,
          production_date: null, // ← IMPORTANTE: NULL inicialmente (produção preenche)
          shipment_date: deliveryDate // ← Data que a loja quer receber
        })
        .select()
        .single();
      
      if (shipmentError) throw shipmentError;
      
      console.log('✅ Pedido principal criado:', shipment.id);
      
      // 2. Criar itens em production_items
      for (const item of orderCart) {
        const salad = saladTypes.find(s => s.id === item.salad_type_id);
        const unitPrice = salad?.sale_price || 0;
        
        // Usar a data atual + 3 dias para validade (padrão)
        const today = new Date();
        const productionDate = today.toISOString().slice(0, 10);
        const expirationDate = new Date(today);
        expirationDate.setDate(expirationDate.getDate() + 3);
        
        const { error: itemError } = await supabase
          .from('production_items')
          .insert({
            shipment_id: shipment.id,
            salad_type_id: item.salad_type_id,
            quantity: item.quantity,
            unit_price: unitPrice,
            production_date: productionDate, // ← Data atual (padrão de validade)
            expiration_date: expirationDate.toISOString().slice(0, 10)
          });

        if (itemError) {
          console.error('Erro ao salvar item:', itemError);
          throw itemError;
        }
      }
      
      console.log('✅ Todos os itens salvos');
      
      alert(`✅ Pedido ${shipmentNumber} enviado com sucesso!\nData de entrega solicitada: ${new Date(deliveryDate).toLocaleDateString('pt-BR')}\nA produção foi notificada.`);
      
      // Atualizar estado
      setLastOrderNumber(prev => prev + 1);
      
      // Limpar e fechar
      setOrderCart([]);
      setShowOrderModal(false);
      
      // Resetar data para amanhã (padrão)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDeliveryDate(tomorrow.toISOString().split('T')[0]);
      
      // Atualizar lista de pedidos
      const newOrder: RecentOrder = {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        created_at: new Date().toISOString(),
        status: shipment.status,
        total_items: shipment.total_items
      };
      setRecentOrders([newOrder, ...recentOrders]);
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar pedido (raw):', error);
      console.error('❌ code:', error?.code);
      console.error('❌ message:', error?.message);
      
      alert(
        `Erro ao enviar pedido:\n` +
        `Código: ${error?.code || 'N/A'}\n` +
        `Mensagem: ${error?.message || 'Erro desconhecido'}`
      );
    }
  };

  // ========== FUNÇÕES DO REGISTRO DE PERDAS ==========
  const addToLossCart = () => {
    const salad = saladTypes.find(s => s.id === selectedLossType);
    const reason = LOSS_REASONS.find(r => r.id === lossReason);
    
    if (!salad || !reason) return;
    
    // Calcula o valor da perda
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
    
    // Reseta campos
    setLossQuantity(1);
    setLossNotes('');
  };
  
  const removeLossItem = (id: string) => {
    setLossCart(lossCart.filter(item => item.id !== id));
  };
  
  const submitLosses = async () => {
    if (lossCart.length === 0) {
      alert('Adicione pelo menos um item de perda!');
      return;
    }

    if (!storeData?.id) {
      alert('Erro: Loja não identificada.');
      return;
    }

    // Validação dos lotes
    for (const item of lossCart) {
      if (!validateBatchNumber(item.batch_number)) {
        return; // Para a execução
      }
    }

    try {
      const totalItems = lossCart.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = lossCart.reduce((sum, item) => {
        return sum + (item.loss_value || 0);
      }, 0);
      
      const today = new Date().toISOString().split('T')[0];
      
      console.log('📉 Verificando perdas existentes para hoje...', {
        storeId: storeData.id,
        date: today
      });
      
      // 1. PRIMEIRO: Verificar se já existe uma perda "completed" hoje
      const { data: existingLoss, error: checkError } = await supabase
        .from('losses')
        .select('id, loss_number, total_items, total_value')
        .eq('store_id', storeData.id)
        .eq('loss_date', today)
        .eq('status', 'completed')
        .maybeSingle();
      
      if (checkError) {
        console.error('Erro ao verificar perdas existentes:', checkError);
      }
      
      let lossId: string;
      let lossNumber: string;
      let isNewLoss = false;
      
      if (existingLoss) {
        // 2A. JÁ EXISTE PERDA HOJE: Usar a existente
        console.log('✅ Perda existente encontrada:', existingLoss);
        lossId = existingLoss.id;
        lossNumber = existingLoss.loss_number;
        
        // Atualizar totais na perda existente
        const newTotalItems = existingLoss.total_items + totalItems;
        const newTotalValue = existingLoss.total_value + totalValue;
        
        const { error: updateError } = await supabase
          .from('losses')
          .update({
            total_items: newTotalItems,
            total_value: newTotalValue,
            notes: `Atualização automática. ${lossNotes ? `Observações: ${lossNotes}` : ''}`
          })
          .eq('id', lossId);
        
        if (updateError) {
          console.error('Erro ao atualizar perda existente:', updateError);
          throw updateError;
        }
        
        console.log('✅ Perda existente atualizada');
        
      } else {
        // 2B. NÃO EXISTE PERDA HOJE: Criar nova
        isNewLoss = true;
        lossNumber = generateSequenceNumber('PER', lastLossNumber);
        
        console.log('📝 Criando nova perda para hoje...', {
          storeId: storeData.id,
          totalItems,
          totalValue,
          lossNumber
        });
        
        const { data: newLoss, error: lossError } = await supabase
          .from('losses')
          .insert({
            loss_number: lossNumber,
            store_id: storeData.id,
            loss_date: today,
            status: 'completed',
            total_items: totalItems,
            total_value: totalValue,
            notes: `Registro automático da loja. ${lossNotes ? `Observações: ${lossNotes}` : ''}`,
            created_by: userDbId
          })
          .select()
          .single();
        
        if (lossError) {
          console.error('❌ Erro ao criar perda principal:', lossError);
          throw lossError;
        }
        
        lossId = newLoss.id;
        console.log('✅ Nova perda criada:', lossId);
      }
      
      // 3. Criar itens em loss_items
      for (const item of lossCart) {
        console.log('📝 Salvando item de perda:', item);
        
        // Calcula o valor da perda se não tiver
        const salad = saladTypes.find(s => s.id === item.salad_type_id);
        const lossValue = item.loss_value || (salad?.sale_price || 10.00) * item.quantity;
        
        const itemData: any = {
          loss_id: lossId,
          salad_type_id: item.salad_type_id,
          quantity: item.quantity,
          batch_number: item.batch_number,
          reason: item.reason,
          loss_value: lossValue
        };
        
        // Adiciona campo opcional de notas
        if (item.notes) {
          itemData.notes = item.notes;
        }
        
        console.log('📤 Dados do item a serem enviados:', itemData);
        
        const { error: itemError } = await supabase
          .from('loss_items')
          .insert(itemData);
        
        if (itemError) {
          console.error('❌ Erro ao salvar item de perda:', itemError);
          
          // Verifica se é erro de duplicidade também em loss_items
          if (itemError.code === '23505') {
            alert(`⚠️ Item "${item.name}" do lote "${item.batch_number}" já foi registrado hoje. Pulando...`);
            continue; // Pula para o próximo item
          } else {
            throw itemError;
          }
        }
        
        console.log('✅ Item de perda salvo com sucesso');
      }
      
      console.log('✅ Todos os itens de perda processados');
      
      if (isNewLoss) {
        alert(`✅ Novas perdas registradas com sucesso!\nNúmero: ${lossNumber}\nTotal: ${totalItems} unidades\nValor: R$ ${totalValue.toFixed(2)}`);
        // Atualizar estado apenas se for nova perda
        setLastLossNumber(prev => prev + 1);
      } else {
        alert(`✅ Perdas adicionadas ao registro do dia!\nItens adicionados: ${totalItems}\nValor adicional: R$ ${totalValue.toFixed(2)}`);
      }
      
      // Limpar e fechar
      setLossCart([]);
      setShowLossModal(false);
      
    } catch (error: any) {
      console.error('❌ Erro completo ao registrar perdas:', error);
      
      // Mensagem mais detalhada para o usuário
      const errorMessage = error.message || 'Erro desconhecido';
      const errorCode = error.code || 'N/A';
      
      let userMessage = `❌ Erro ao registrar perdas:\n\nCódigo: ${errorCode}\nMensagem: ${errorMessage}`;
      
      // Mensagens específicas para códigos conhecidos
      if (errorCode === '23505') {
        userMessage += '\n\n⚠️ Já existe um registro de perda completado hoje.\nSe precisar adicionar mais itens, feche e abra novamente o modal.';
      }
      
      alert(userMessage);
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
        <div style={{ 
          fontSize: '28px', 
          fontWeight: 'bold',
          color: '#2196F3',
          textAlign: 'center'
        }}>
          🌅 Sunset Saladas
        </div>
        <div style={{ 
          fontSize: '18px', 
          color: '#666',
          textAlign: 'center',
          maxWidth: '300px'
        }}>
          {saladTypes.length === 0 ? 'Carregando tipos de salada...' : 'Carregando dashboard da loja...'}
        </div>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #e0e0e0',
          borderTop: '5px solid #2196F3',
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
        title={`Dashboard - ${storeData?.name || 'Minha Loja'}`}
        userEmail={userEmail}
        storeName={storeData?.name}
        profileType="lojas"
      />
      
      <main style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* ========== CARDS PRINCIPAIS ========== */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '30px',
          marginBottom: '50px'
        }}>
          {/* CARD: SOLICITAR SALADAS */}
          <div style={{
            padding: '35px',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            border: '2px solid #4CAF50',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textAlign: 'center'
          }}
            onClick={() => setShowOrderModal(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(76, 175, 80, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)';
            }}
          >
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🥗</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', color: '#2E7D32' }}>
              Solicitar Saladas
            </h2>
            <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.5', marginBottom: '25px' }}>
              Faça pedidos de saladas para produção. Escolha os tipos, quantidades e data de entrega.
            </p>
            <div style={{
              padding: '12px 25px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-block'
            }}>
              + Novo Pedido
            </div>
          </div>

          {/* CARD: REGISTRAR PERDAS */}
          <div style={{
            padding: '35px',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
            border: '2px solid #F44336',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            textAlign: 'center'
          }}
            onClick={() => setShowLossModal(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(244, 67, 54, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)';
            }}
          >
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>📉</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', color: '#C62828' }}>
              Registrar Perdas
            </h2>
            <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.5', marginBottom: '25px' }}>
              Registre perdas diárias por validade, qualidade, manuseio ou outros motivos.
            </p>
            <div style={{
              padding: '12px 25px',
              backgroundColor: '#F44336',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-block'
            }}>
              + Registrar Perdas
            </div>
          </div>
        </div>

        {/* ========== PEDIDOS RECENTES ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginTop: '20px'
        }}>
          <h2 style={{ marginTop: 0, color: '#333', fontSize: '20px', marginBottom: '25px' }}>
            📦 Pedidos Recentes
          </h2>
          
          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Nenhum pedido realizado ainda. Clique em "Solicitar Saladas" para começar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {recentOrders.map(order => {
                const status = Object.values(ORDER_STATUS).find(s => s.id === order.status);
                return (
                  <div key={order.id} style={{
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${status?.color || '#999'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        {order.shipment_number}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          padding: '4px 12px',
                          backgroundColor: (status?.color || '#999') + '20',
                          color: status?.color || '#999',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {status?.name || order.status}
                        </span>
                        <span style={{ color: '#666', fontSize: '14px' }}>
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      Total: {order.total_items} unidade{order.total_items !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========== MODAL: SOLICITAR SALADAS ========== */}
        {showOrderModal && (
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
                <h2 style={{ margin: 0, fontSize: '24px', color: '#2E7D32' }}>🥗 Solicitar Saladas</h2>
                <button
                  onClick={() => setShowOrderModal(false)}
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

              {/* Formulário de adição */}
              <div style={{
                padding: '25px',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                marginBottom: '30px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Tipo de Salada
                    </label>
                    <select
                      value={selectedSaladType}
                      onChange={(e) => setSelectedSaladType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      {saladTypes.map(salad => (
                        <option key={salad.id} value={salad.id}>
                          {salad.emoji} {salad.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Quantidade
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                        style={{
                          padding: '10px 15px',
                          backgroundColor: '#f0f0f0',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                        min="1"
                        style={{
                          width: '80px',
                          padding: '12px',
                          border: '2px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '16px',
                          textAlign: 'center'
                        }}
                      />
                      <button
                        onClick={() => setOrderQuantity(orderQuantity + 1)}
                        style={{
                          padding: '10px 15px',
                          backgroundColor: '#f0f0f0',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* CAMPO NOVO: DATA DE ENTREGA */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                    📅 Data de Entrega Desejada
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
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
                    Data em que a loja deseja receber as saladas
                  </div>
                </div>

                <button
                  onClick={addToOrderCart}
                  style={{
                    width: '100%',
                    padding: '15px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Adicionar ao Carrinho
                </button>
              </div>

              {/* Carrinho */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '15px' }}>
                  Resumo do Pedido ({orderCart.length} {orderCart.length === 1 ? 'item' : 'itens'})
                </h3>
                
                {orderCart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                    Carrinho vazio. Adicione saladas acima.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {orderCart.map(item => {
                      const salad = saladTypes.find(s => s.id === item.salad_type_id);
                      return (
                        <div key={item.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '15px',
                          backgroundColor: '#f9f9f9',
                          borderRadius: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '24px' }}>{salad?.emoji || '🥗'}</span>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{salad?.name || 'Salada'}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                                <button
                                  onClick={() => updateOrderQuantity(item.id, item.quantity - 1)}
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#e0e0e0',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 'bold' }}>{item.quantity} un.</span>
                                <button
                                  onClick={() => updateOrderQuantity(item.id, item.quantity + 1)}
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#e0e0e0',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeOrderItem(item.id)}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#ffebee',
                              color: '#f44336',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total e botão enviar */}
              {orderCart.length > 0 && (
                <div style={{
                  padding: '20px',
                  backgroundColor: '#e8f5e9',
                  borderRadius: '12px',
                  marginBottom: '25px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      Total de Unidades:
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2E7D32' }}>
                      {orderCart.reduce((sum, item) => sum + item.quantity, 0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      Data de Entrega:
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2E7D32' }}>
                      {new Date(deliveryDate).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => {
                    setShowOrderModal(false);
                    setOrderCart([]);
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
                  onClick={submitOrder}
                  disabled={orderCart.length === 0}
                  style={{
                    flex: 2,
                    padding: '15px',
                    backgroundColor: orderCart.length === 0 ? '#ccc' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: orderCart.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  🚀 Enviar Pedido para Produção
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== MODAL: REGISTRAR PERDAS ========== */}
        {showLossModal && (
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
              maxWidth: '700px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#C62828' }}>📉 Registrar Perdas</h2>
                <button
                  onClick={() => setShowLossModal(false)}
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

              {/* Formulário de adição de perdas */}
              <div style={{
                padding: '25px',
                backgroundColor: '#fff8f8',
                borderRadius: '12px',
                marginBottom: '30px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Tipo de Salada
                    </label>
                    <select
                      value={selectedLossType}
                      onChange={(e) => setSelectedLossType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      {saladTypes.map(salad => (
                        <option key={salad.id} value={salad.id}>
                          {salad.emoji} {salad.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Quantidade Perdida
                    </label>
                    <input
                      type="number"
                      value={lossQuantity}
                      onChange={(e) => setLossQuantity(parseInt(e.target.value) || 1)}
                      min="1"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Número do Lote
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
                        fontSize: '16px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Motivo da Perda
                    </label>
                    <select
                      value={lossReason}
                      onChange={(e) => setLossReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      {LOSS_REASONS.map(reason => (
                        <option key={reason.id} value={reason.id}>
                          {reason.emoji} {reason.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                    Observações (opcional)
                  </label>
                  <textarea
                    value={lossNotes}
                    onChange={(e) => setLossNotes(e.target.value)}
                    placeholder="Detalhes adicionais sobre a perda..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '16px',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                  />
                </div>
                <button
                  onClick={addToLossCart}
                  style={{
                    width: '100%',
                    padding: '15px',
                    backgroundColor: '#F44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Adicionar ao Registro
                </button>
              </div>

              {/* Lista de perdas registradas */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '15px' }}>
                  Perdas a Registrar ({lossCart.length} {lossCart.length === 1 ? 'item' : 'itens'})
                </h3>
                
                {lossCart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                    Nenhuma perda adicionada ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {lossCart.map(item => {
                      const salad = saladTypes.find(s => s.id === item.salad_type_id);
                      const reason = LOSS_REASONS.find(r => r.name === item.reason);
                      return (
                        <div key={item.id} style={{
                          padding: '15px',
                          backgroundColor: '#fff8f8',
                          borderRadius: '10px',
                          borderLeft: `4px solid ${reason?.color || '#999'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '20px' }}>{salad?.emoji || '🥗'}</span>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{salad?.name || 'Salada'}</div>
                                <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                                  {item.quantity} un. • Lote: {item.batch_number}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#C62828' }}>
                                R$ {item.loss_value?.toFixed(2) || '0.00'}
                              </div>
                              <button
                                onClick={() => removeLossItem(item.id)}
                                style={{
                                  padding: '6px 10px',
                                  backgroundColor: '#ffebee',
                                  color: '#f44336',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  marginTop: '5px'
                                }}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                            <span style={{
                              padding: '4px 10px',
                              backgroundColor: (reason?.color || '#999') + '20',
                              color: reason?.color || '#999',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {reason?.emoji || ''} {item.reason}
                            </span>
                            {item.notes && (
                              <span style={{ fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                                "{item.notes}"
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total e botão concluir */}
              {lossCart.length > 0 && (
                <div style={{
                  padding: '20px',
                  backgroundColor: '#ffebee',
                  borderRadius: '12px',
                  marginBottom: '25px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      Total de Perdas:
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#C62828' }}>
                      {lossCart.reduce((sum, item) => sum + item.quantity, 0)} unidades
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      Valor Total:
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#C62828' }}>
                      R$ {lossCart.reduce((sum, item) => sum + (item.loss_value || 0), 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                    Esta ação não pode ser desfeita. As perdas serão registradas permanentemente.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => {
                    setShowLossModal(false);
                    setLossCart([]);
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
                  onClick={submitLosses}
                  disabled={lossCart.length === 0}
                  style={{
                    flex: 2,
                    padding: '15px',
                    backgroundColor: lossCart.length === 0 ? '#ccc' : '#F44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: lossCart.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
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