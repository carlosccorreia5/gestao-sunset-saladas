// src/components/admin/Dashboard.tsx - VERSÃO CORRIGIDA (ERROS FIXADOS)
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../common/Header';
import { loadPDFLibraries, isPDFReady, createPDFDocument, addAutoTable } from '../../utils/pdfExporter';

// Interfaces
interface Store {
  id: string;
  name: string;
}

interface DaySummary {
  date: string;
  salads_requested: number;
  salads_produced: number;
  salads_sent: number;
  difference: number;
  total_lost?: number;
  total_value_lost?: number;
  salads_by_type: Array<{
    salad_type: string;
    requested: number;
    produced: number;
    sent: number;
    difference: number;
  }>;
  divergences_by_store: Array<{
    store_name: string;
    salad_type: string;
    requested: number;
    sent: number;
    difference: number;
  }>;
}

interface LossReport {
  total_lost: number;
  total_value: number;
  losses_by_store: Array<{
    store_name: string;
    quantity: number;
    value: number;
  }>;
  losses_by_reason: Array<{
    reason: string;
    quantity: number;
  }>;
  detailed_losses: Array<{
    store_name: string;
    salad_type: string;
    batch_number: string;
    reason: string;
    quantity: number;
    date: string;
    value?: number;
  }>;
}

interface ProfitLossEfficiency {
  store_name: string;
  sent: number;
  lost: number;
  efficiency: number;
  estimated_sales: number;
}

interface BatchLossReport {
  batch_number: string;
  produced: number;
  sold: number;
  lost: number;
  loss_percentage: number;
  affected_stores: string[];
  production_date: string;
}

interface ComparativeReport {
  store_id: string;
  store_name: string;
  period: string;
  requested: number;
  produced: number;
  sent: number;
  difference: number;
  efficiency_rate: number;
}

interface AuditLog {
  id: string;
  adjustment_type: string;
  original_table: string;
  adjustment_reason: string;
  created_at: string;
  adjusted_by_name: string;
}

export default function AdminDashboard() {
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [, setUserDbId] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  
  // Filtros
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<string>('day-summary');
  
  // Estados para relatórios
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [lossReport, setLossReport] = useState<LossReport | null>(null);
  const [profitLossEfficiency, setProfitLossEfficiency] = useState<ProfitLossEfficiency[]>([]);
  const [batchLossReport, setBatchLossReport] = useState<BatchLossReport[]>([]);
  const [comparativeReport, setComparativeReport] = useState<ComparativeReport[]>([]);
  const [, setAuditLog] = useState<AuditLog[]>([]);
  const [correctionsList, setCorrectionsList] = useState<any[]>([]);
  
  // Estados para lojas
  const [stores, setStores] = useState<Store[]>([]);
  
  // Modos de visualização
  const [viewMode, setViewMode] = useState<'consolidated' | 'detailed'>('consolidated');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Carregar bibliotecas PDF
  useEffect(() => {
    const initializePDFLibraries = async () => {
      try {
        console.log('Inicializando bibliotecas PDF...');
        const loaded = await loadPDFLibraries();
        setPdfReady(loaded);
        
        if (loaded) {
          console.log('✅ Bibliotecas PDF carregadas com sucesso!');
        } else {
          console.warn('⚠️ Bibliotecas PDF não carregadas automaticamente');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar bibliotecas PDF:', error);
      }
    };

    initializePDFLibraries();
  }, []);

  useEffect(() => {
    initDashboard();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadSelectedReport();
    }
  }, [selectedReport, startDate, endDate, selectedStore, selectedDate, viewMode]);

  const initDashboard = async () => {
    try {
      // 1. Verificar sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login/admin';
        return;
      }
      setUserEmail(session.user.email || '');
      
      // 2. Buscar ID do usuário
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();
      
      if (userData) setUserDbId(userData.id);
      
      // 3. Buscar lojas
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      
      if (storesError) throw storesError;
      
      if (storesData) {
        setStores(storesData);
      }
      
      // 4. Carregar dados iniciais
      await loadAllReports();
      await loadAuditLog();
      
    } catch (error) {
      console.error('Erro ao inicializar admin:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllReports = async () => {
    try {
      await Promise.all([
        loadDaySummary(),
        loadLossReport(),
        loadProfitLossEfficiency(),
        loadBatchLossReport(),
        loadComparativeReport(),
        loadCorrectionsList()
      ]);
    } catch (error) {
      console.error('Erro ao carregar todos os relatórios:', error);
    }
  };

  const loadSelectedReport = async () => {
    try {
      switch (selectedReport) {
        case 'day-summary':
          await loadDaySummary();
          break;
        case 'losses':
          await loadLossReport();
          break;
        case 'profit-loss':
          await loadProfitLossEfficiency();
          break;
        case 'batch-loss':
          await loadBatchLossReport();
          break;
        case 'comparative':
          await loadComparativeReport();
          break;
        case 'audit':
          await loadAuditLog();
          break;
        case 'corrections-list':
          await loadCorrectionsList();
          break;
      }
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
    }
  };

  const loadDaySummary = async () => {
    try {
      const today = selectedDate;
      
      // 1. Buscar pedidos das lojas
      const { data: ordersData, error: ordersError } = await supabase
        .from('production_shipments')
        .select('id, total_items, store_id')
        .eq('production_date', today);
      
      if (ordersError) throw ordersError;
      
      const salads_requested = (ordersData || []).reduce((sum, item) => sum + item.total_items, 0) || 0;
      
      // 2. Buscar envios da produção
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('production_deliveries')
        .select('id, total_items, store_id')
        .eq('production_date', today);
      
      if (deliveriesError) throw deliveriesError;
      
      const salads_sent = (deliveriesData || []).reduce((sum, item) => sum + item.total_items, 0) || 0;
      
      // 3. Buscar perdas
      const { data: lossesData, error: lossesError } = await supabase
        .from('losses')
        .select('total_items, total_value')
        .eq('loss_date', today)
        .eq('status', 'completed');
      
      if (lossesError) throw lossesError;
      
      const total_lost = (lossesData || []).reduce((sum, item) => sum + item.total_items, 0) || 0;
      const total_value_lost = (lossesData || []).reduce((sum, item) => sum + item.total_value, 0) || 0;
      
      // 4. Buscar detalhes por tipo de salada
      const salads_by_type = await getSaladsByType(today);
      
      // 5. Buscar divergências por loja
      const divergences_by_store = await getStoreDivergences(today, ordersData || []);
      
      setDaySummary({
        date: today,
        salads_requested,
        salads_produced: salads_sent,
        salads_sent,
        difference: salads_requested - salads_sent,
        total_lost,
        total_value_lost,
        salads_by_type,
        divergences_by_store
      });
      
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
      setDaySummary(null);
    }
  };

  const getSaladsByType = async (date: string): Promise<any[]> => {
    try {
      // Primeiro, buscar IDs dos shipments para esta data
      const { data: shipments } = await supabase
        .from('production_shipments')
        .select('id')
        .eq('production_date', date);
      
      const shipmentIds = (shipments || []).map(s => s.id) || [];
      
      // Buscar itens de pedidos por tipo
      let orderItems: any[] = [];
      if (shipmentIds.length > 0) {
        const { data: items, error } = await supabase
          .from('production_items')
          .select(`
            quantity,
            salad_types!inner (id, name)
          `)
          .in('shipment_id', shipmentIds);
        
        if (error) throw error;
        orderItems = items || [];
      }
      
      // Buscar IDs dos deliveries para esta data
      const { data: deliveries } = await supabase
        .from('production_deliveries')
        .select('id')
        .eq('production_date', date);
      
      const deliveryIds = (deliveries || []).map(d => d.id) || [];
      
      // Buscar itens de envios por tipo
      let deliveryItems: any[] = [];
      if (deliveryIds.length > 0) {
        const { data: items, error } = await supabase
          .from('delivery_items')
          .select(`
            quantity,
            salad_types!inner (id, name)
          `)
          .in('delivery_id', deliveryIds);
        
        if (error) throw error;
        deliveryItems = items || [];
      }
      
      // Agrupar por tipo de salada
      const saladMap = new Map<string, {
        salad_type: string;
        requested: number;
        produced: number;
        sent: number;
        difference: number;
      }>();
      
      // Processar pedidos
      orderItems.forEach(item => {
        const saladId = item.salad_types.id;
        const saladName = item.salad_types.name;
        
        if (!saladMap.has(saladId)) {
          saladMap.set(saladId, {
            salad_type: saladName,
            requested: 0,
            produced: 0,
            sent: 0,
            difference: 0
          });
        }
        
        const current = saladMap.get(saladId)!;
        current.requested += item.quantity;
        saladMap.set(saladId, current);
      });
      
      // Processar envios
      deliveryItems.forEach(item => {
        const saladId = item.salad_types.id;
        const saladName = item.salad_types.name;
        
        if (!saladMap.has(saladId)) {
          saladMap.set(saladId, {
            salad_type: saladName,
            requested: 0,
            produced: 0,
            sent: 0,
            difference: 0
          });
        }
        
        const current = saladMap.get(saladId)!;
        current.sent += item.quantity;
        current.produced += item.quantity;
        current.difference = current.requested - current.sent;
        saladMap.set(saladId, current);
      });
      
      return Array.from(saladMap.values());
    } catch (error) {
      console.error('Erro ao buscar saladas por tipo:', error);
      return [];
    }
  };

  const getStoreDivergences = async (date: string, orders: any[]): Promise<any[]> => {
    try {
      const divergences: any[] = [];
      
      // Para cada loja que fez pedido
      for (const order of orders) {
        // Buscar nome da loja
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('name')
          .eq('id', order.store_id)
          .single();
        
        if (storeError || !store) continue;
        
        // Buscar itens deste pedido
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('production_items')
          .select(`
            quantity,
            salad_types!inner (name)
          `)
          .eq('shipment_id', order.id);
        
        if (orderItemsError) continue;
        
        // Buscar deliveries para esta loja hoje
        const { data: storeDeliveries, error: deliveriesError } = await supabase
          .from('production_deliveries')
          .select('id')
          .eq('store_id', order.store_id)
          .eq('production_date', date);
        
        if (deliveriesError) continue;
        
        const deliveryIds = (storeDeliveries || []).map(d => d.id) || [];
        
        // Buscar itens enviados
        let deliveryItems: any[] = [];
        if (deliveryIds.length > 0) {
          const { data: items, error: deliveryItemsError } = await supabase
            .from('delivery_items')
            .select(`
              quantity,
              salad_types!inner (name)
            `)
            .in('delivery_id', deliveryIds);
          
          if (deliveryItemsError) continue;
          deliveryItems = items || [];
        }
        
        // Comparar por tipo de salada
        if (orderItems) {
          for (const orderItem of orderItems) {
            // CORREÇÃO AQUI: salad_types é um array, então precisamos acessar [0]
            const saladType = orderItem.salad_types?.[0]?.name || 'Salada';
            const requested = orderItem.quantity;
            
            // Encontrar quanto foi enviado deste tipo
            const sentItem = deliveryItems.find(di => di.salad_types?.[0]?.name === saladType);
            const sent = sentItem?.quantity || 0;
            
            const difference = sent - requested;
            
            // Só adiciona se houver diferença
            if (difference !== 0) {
              divergences.push({
                store_name: store.name,
                salad_type: saladType,
                requested,
                sent,
                difference
              });
            }
          }
        }
      }
      
      return divergences;
    } catch (error) {
      console.error('Erro ao buscar divergências:', error);
      return [];
    }
  };

  const loadLossReport = async () => {
    try {
      // Query base para perdas
      let query = supabase
        .from('losses')
        .select(`
          id,
          loss_date,
          total_items,
          total_value,
          store_id,
          stores!inner(name),
          loss_items!inner (
            quantity,
            reason,
            batch_number,
            loss_value,
            salad_types!inner(name)
          )
        `)
        .gte('loss_date', startDate)
        .lte('loss_date', endDate)
        .eq('status', 'completed');
      
      // Filtrar por loja se necessário
      if (selectedStore !== 'all') {
        query = query.eq('store_id', selectedStore);
      }
      
      const { data: losses, error } = await query;
      
      if (error) throw error;
      
      // Processar dados para o formato esperado
      const total_lost = (losses || []).reduce((sum, loss) => sum + loss.total_items, 0) || 0;
      const total_value = (losses || []).reduce((sum, loss) => sum + loss.total_value, 0) || 0;
      
      // Agrupar perdas por loja
      const losses_by_store: any[] = [];
      const storeMap = new Map();
      
      (losses || []).forEach((loss: any) => {
        if (storeMap.has(loss.store_id)) {
          const existing = storeMap.get(loss.store_id);
          existing.quantity += loss.total_items;
          existing.value += loss.total_value;
        } else {
          storeMap.set(loss.store_id, {
            store_name: loss.stores.name,
            quantity: loss.total_items,
            value: loss.total_value
          });
        }
      });
      
      storeMap.forEach(value => {
        losses_by_store.push(value);
      });
      
      // Agrupar perdas por motivo
      const losses_by_reason: any[] = [];
      const reasonMap = new Map();
      
      (losses || []).forEach((loss: any) => {
        (loss.loss_items || []).forEach((item: any) => {
          if (reasonMap.has(item.reason)) {
            reasonMap.set(item.reason, reasonMap.get(item.reason) + item.quantity);
          } else {
            reasonMap.set(item.reason, item.quantity);
          }
        });
      });
      
      reasonMap.forEach((quantity, reason) => {
        losses_by_reason.push({ reason, quantity });
      });
      
      // Lista detalhada
      const detailed_losses: any[] = [];
      (losses || []).forEach((loss: any) => {
        (loss.loss_items || []).forEach((item: any) => {
          detailed_losses.push({
            store_name: loss.stores.name,
            salad_type: item.salad_types?.name || 'Salada',
            batch_number: item.batch_number,
            reason: item.reason,
            quantity: item.quantity,
            date: loss.loss_date,
            value: item.loss_value
          });
        });
      });
      
      setLossReport({
        total_lost,
        total_value,
        losses_by_store,
        losses_by_reason,
        detailed_losses
      });
      
    } catch (error) {
      console.error('Erro ao carregar relatório de perdas:', error);
      setLossReport(null);
    }
  };

  const loadProfitLossEfficiency = async () => {
    try {
      // Buscar todas as lojas
      const { data: allStores, error: storesError } = await supabase
        .from('stores')
        .select('id, name');
      
      if (storesError) throw storesError;
      
      if (!allStores) {
        setProfitLossEfficiency([]);
        return;
      }
      
      const efficiencyData: ProfitLossEfficiency[] = [];
      
      for (const store of allStores) {
        // Buscar envios para esta loja no período
        const { data: deliveries, error: deliveriesError } = await supabase
          .from('production_deliveries')
          .select('total_items, total_value')
          .eq('store_id', store.id)
          .gte('production_date', startDate)
          .lte('production_date', endDate);
        
        if (deliveriesError) throw deliveriesError;
        
        const sent = (deliveries || []).reduce((sum, d) => sum + d.total_items, 0) || 0;
        const estimated_sales = (deliveries || []).reduce((sum, d) => sum + d.total_value, 0) || 0;
        
        // Buscar perdas desta loja no período
        const { data: losses, error: lossesError } = await supabase
          .from('losses')
          .select('total_items')
          .eq('store_id', store.id)
          .eq('status', 'completed')
          .gte('loss_date', startDate)
          .lte('loss_date', endDate);
        
        if (lossesError) throw lossesError;
        
        const lost = (losses || []).reduce((sum, l) => sum + l.total_items, 0) || 0;
        
        // Calcular eficiência
        const efficiency = sent > 0 ? Math.round(((sent - lost) / sent) * 100) : 0;
        
        efficiencyData.push({
          store_name: store.name,
          sent,
          lost,
          efficiency,
          estimated_sales
        });
      }
      
      // Ordenar por eficiência (maior para menor)
      setProfitLossEfficiency(efficiencyData.sort((a, b) => b.efficiency - a.efficiency));
      
    } catch (error) {
      console.error('Erro ao carregar eficiência:', error);
      setProfitLossEfficiency([]);
    }
  };

  const loadBatchLossReport = async () => {
    try {
      // Buscar perdas agrupadas por lote
      const { data: batchLosses, error } = await supabase
        .from('loss_items')
        .select(`
          batch_number,
          quantity,
          loss_value,
          losses!inner(loss_date, stores!inner(name))
        `)
        .gte('losses.loss_date', startDate)
        .lte('losses.loss_date', endDate);
      
      if (error) {
        console.warn('Erro ao buscar perdas por lote:', error);
        setBatchLossReport([]);
        return;
      }
      
      // Agrupar por lote manualmente
      const groupedData: { [key: string]: BatchLossReport } = {};
      
      (batchLosses || []).forEach((item: any) => {
        const batch = item.batch_number;
        if (!groupedData[batch]) {
          groupedData[batch] = {
            batch_number: batch,
            produced: 0,
            sold: 0,
            lost: 0,
            loss_percentage: 0,
            affected_stores: [],
            production_date: item.losses?.loss_date || startDate
          };
        }
        
        groupedData[batch].lost += item.quantity;
        
        // Adicionar loja à lista de lojas afetadas
        const storeName = item.losses?.stores?.name;
        if (storeName && !groupedData[batch].affected_stores.includes(storeName)) {
          groupedData[batch].affected_stores.push(storeName);
        }
      });
      
      // Calcular porcentagens (simplificado)
      const reportData = Object.values(groupedData).map(batch => ({
        ...batch,
        produced: batch.lost * 2, // Simulação
        sold: batch.lost, // Simulação
        loss_percentage: Math.round((batch.lost / (batch.lost * 2)) * 100) || 0
      }));
      
      setBatchLossReport(reportData);
    } catch (error) {
      console.error('Erro ao carregar perdas por lote:', error);
      setBatchLossReport([]);
    }
  };

  const loadComparativeReport = async () => {
    try {
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id, name');
      
      if (storesError) throw storesError;
      
      if (!stores) {
        setComparativeReport([]);
        return;
      }
      
      // Filtrar por loja se necessário
      const filteredStores = selectedStore !== 'all' 
        ? stores.filter(store => store.id === selectedStore)
        : stores;
      
      const comparativeData: ComparativeReport[] = [];
      
      for (const store of filteredStores) {
        // Buscar pedidos desta loja no período
        const { data: orders, error: ordersError } = await supabase
          .from('production_shipments')
          .select('total_items')
          .eq('store_id', store.id)
          .gte('production_date', startDate)
          .lte('production_date', endDate);
        
        if (ordersError) throw ordersError;
        
        const requested = (orders || []).reduce((sum, order) => sum + order.total_items, 0) || 0;
        
        // Buscar envios para esta loja no período
        const { data: deliveries, error: deliveriesError } = await supabase
          .from('production_deliveries')
          .select('total_items')
          .eq('store_id', store.id)
          .gte('production_date', startDate)
          .lte('production_date', endDate);
        
        if (deliveriesError) throw deliveriesError;
        
        const sent = (deliveries || []).reduce((sum, delivery) => sum + delivery.total_items, 0) || 0;
        
        // Calcular eficiência
        const efficiency_rate = requested > 0 ? Math.round((sent / requested) * 100) : 0;
        
        comparativeData.push({
          store_id: store.id,
          store_name: store.name,
          period: `${startDate} a ${endDate}`,
          requested,
          produced: sent,
          sent,
          difference: sent - requested,
          efficiency_rate
        });
      }
      
      // Ordenar por nome da loja
      setComparativeReport(comparativeData.sort((a, b) => a.store_name.localeCompare(b.store_name)));
      
    } catch (error) {
      console.error('Erro ao carregar relatório comparativo:', error);
      setComparativeReport([]);
    }
  };

  const loadAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_audit_report')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.warn('Erro ao carregar auditoria (tabela pode não existir):', error);
        setAuditLog([]);
        return;
      }
      
      setAuditLog(data || []);
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error);
    }
  };
  
  const loadCorrectionsList = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_corrections_simple')
        .select('*')
        .order('correction_date', { ascending: false })
        .limit(50);
      
      if (error) {
        console.warn('Erro ao carregar correções (tabela pode não existir):', error);
        setCorrectionsList([]);
        return;
      }
      
      setCorrectionsList(data || []);
    } catch (error) {
      console.error('Erro ao carregar correções:', error);
    }
  };
  
  const exportCorrectionsToExcel = async () => {
    setExportLoading(true);
    try {
      if (!window.XLSX || !window.saveAs) {
        throw new Error('Bibliotecas não carregadas');
      }

      const exportData = correctionsList.map(item => ({
        'ID': item.loss_id,
        'Data Perda': item.loss_date,
        'Loja': item.store_name,
        'Itens': item.total_items,
        'Valor': `R$ ${item.total_value?.toFixed(2) || '0.00'}`,
        'Motivo Correção': item.correction_reason,
        'Atraso (dias)': item.delay_days,
        'Corrigido por': item.corrected_by,
        'Data Correção': item.correction_date,
        'Observações': item.adjustment_notes
      }));

      const ws = window.XLSX.utils.json_to_sheet(exportData);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Correções');
      
      const excelBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      window.saveAs(blob, `correcoes_admin_${new Date().toISOString().split('T')[0]}.xlsx`);
      
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  const exportToExcel = async (data: any[], fileName: string, sheetName = 'Relatório') => {
    setExportLoading(true);
    try {
      if (!window.XLSX || !window.saveAs) {
        throw new Error('Bibliotecas de exportação não carregadas. Recarregue a página.');
      }

      if (!data || data.length === 0) {
        alert('Nenhum dado para exportar!');
        return;
      }

      const ws = window.XLSX.utils.json_to_sheet(data);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      const excelBuffer = window.XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array' 
      });
      
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      window.saveAs(blob, fileName);
      
    } catch (error: any) {
      console.error('Erro ao exportar Excel:', error);
      alert(`Erro ao exportar: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  const exportToPDF = async (reportType: string) => {
    setPdfLoading(true);
    
    try {
      // 1. Verificar se as bibliotecas estão prontas
      if (!isPDFReady()) {
        console.log('Tentando carregar bibliotecas PDF...');
        const loaded = await loadPDFLibraries();
        if (!loaded) {
          throw new Error('Não foi possível carregar as bibliotecas de PDF. Tente recarregar a página.');
        }
      }
      
      // 2. Criar documento PDF
      const doc = createPDFDocument();
      
      // 3. Adicionar logo e cabeçalho
      doc.setFontSize(20);
      doc.setTextColor(33, 150, 243);
      doc.text('Sunset Saladas', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Relatório: ${getReportTitle(reportType)}`, 105, 30, { align: 'center' });
      
      // Adicionar período conforme o tipo de relatório
      if (reportType === 'day-summary') {
        doc.text(`Data: ${selectedDate}`, 105, 37, { align: 'center' });
      } else {
        doc.text(`Período: ${startDate} à ${endDate}`, 105, 37, { align: 'center' });
      }
      
      doc.text(`Gerado por: ${userEmail}`, 105, 44, { align: 'center' });
      doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 105, 51, { align: 'center' });
  
      let yPosition = 60;

      // 4. Adicionar conteúdo específico do relatório
      switch (reportType) {
        case 'day-summary':
          if (daySummary) {
            // Bloco 1 - Consolidado Geral
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Resumo Consolidado do Dia', 20, yPosition);
            yPosition += 10;

            const summaryData = [
              ['Saladas Solicitadas', daySummary.salads_requested.toString()],
              ['Saladas Produzidas', daySummary.salads_produced.toString()],
              ['Saladas Enviadas', daySummary.salads_sent.toString()],
              ['Diferença', daySummary.difference.toString()],
              ['Perdas Registradas', (daySummary.total_lost || 0).toString()],
              ['Valor Perdas', `R$ ${(daySummary.total_value_lost || 0).toFixed(2)}`]
            ];

            // USANDO A FUNÇÃO DO HELPER
            addAutoTable(doc, {
              startY: yPosition,
              head: [['Item', 'Total']],
              body: summaryData,
              theme: 'grid',
              headStyles: { fillColor: [33, 150, 243] }
            });

            // Obter posição Y final da tabela
            yPosition = doc.lastAutoTable?.finalY || yPosition + (summaryData.length * 10) + 20;

            // Bloco 2 - Por tipo de salada (se houver)
            if (daySummary.salads_by_type?.length > 0) {
              // Verificar se precisa de nova página
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              
              doc.setFontSize(14);
              doc.setTextColor(0, 0, 0);
              doc.text('Consolidado por Tipo de Salada', 20, yPosition);
              yPosition += 10;
              
              const typeData = daySummary.salads_by_type.map(item => [
                item.salad_type,
                item.requested.toString(),
                item.produced.toString(),
                item.sent.toString(),
                item.difference.toString()
              ]);

              addAutoTable(doc, {
                startY: yPosition,
                head: [['Tipo', 'Solicitado', 'Produzido', 'Enviado', 'Diferença']],
                body: typeData,
                theme: 'grid',
                headStyles: { fillColor: [76, 175, 80] }
              });

              yPosition = doc.lastAutoTable?.finalY || yPosition + (typeData.length * 10) + 20;
            }

            // Bloco 3 - Divergências por loja (se modo detalhado)
            if (viewMode === 'detailed' && daySummary.divergences_by_store?.length > 0) {
              // Verificar se precisa de nova página
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              
              doc.setFontSize(14);
              doc.setTextColor(0, 0, 0);
              doc.text('Divergências por Loja', 20, yPosition);
              yPosition += 10;
              
              const divergenceData = daySummary.divergences_by_store.map(item => [
                item.store_name,
                item.salad_type,
                item.requested.toString(),
                item.sent.toString(),
                item.difference.toString()
              ]);

              addAutoTable(doc, {
                startY: yPosition,
                head: [['Loja', 'Salada', 'Pedido', 'Enviado', 'Diferença']],
                body: divergenceData,
                theme: 'grid',
                headStyles: { fillColor: [244, 67, 54] },
                columnStyles: {
                  0: { cellWidth: 40 },
                  1: { cellWidth: 40 },
                  4: { 
                    cellWidth: 30,
                    halign: 'center'
                  }
                }
              });
            }
          } else {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhum dado disponível para esta data.', 20, yPosition);
          }
          break;

        case 'losses':
          if (lossReport) {
            // Bloco 1 - Consolidado
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Consolidado Geral de Perdas', 20, yPosition);
            yPosition += 10;

            const lossSummary = [
              ['Total Perdido', `${lossReport.total_lost} saladas`],
              ['Valor Total', `R$ ${lossReport.total_value.toFixed(2)}`]
            ];

            addAutoTable(doc, {
              startY: yPosition,
              head: [['Item', 'Valor']],
              body: lossSummary,
              theme: 'grid',
              headStyles: { fillColor: [244, 67, 54] }
            });

            yPosition = doc.lastAutoTable?.finalY || yPosition + 30;

            // Bloco 2 - Perdas por Loja
            if (lossReport.losses_by_store?.length > 0) {
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              
              doc.setFontSize(12);
              doc.text('Perdas por Loja', 20, yPosition);
              yPosition += 10;

              const storeData = lossReport.losses_by_store.map(item => [
                item.store_name,
                item.quantity.toString(),
                `R$ ${item.value.toFixed(2)}`
              ]);

              addAutoTable(doc, {
                startY: yPosition,
                head: [['Loja', 'Quantidade', 'Valor']],
                body: storeData,
                theme: 'grid',
                headStyles: { fillColor: [255, 152, 0] }
              });

              yPosition = doc.lastAutoTable?.finalY || yPosition + 40;
            }

            // Bloco 3 - Perdas por Motivo
            if (lossReport.losses_by_reason?.length > 0) {
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              
              doc.setFontSize(12);
              doc.text('Perdas por Motivo', 20, yPosition);
              yPosition += 10;

              const reasonData = lossReport.losses_by_reason.map(item => [
                item.reason,
                item.quantity.toString()
              ]);

              addAutoTable(doc, {
                startY: yPosition,
                head: [['Motivo', 'Quantidade']],
                body: reasonData,
                theme: 'grid',
                headStyles: { fillColor: [156, 39, 176] }
              });

              yPosition = doc.lastAutoTable?.finalY || yPosition + 40;
            }

            // Bloco 4 - Detalhamento (opcional, limitado a 20 itens)
            if (lossReport.detailed_losses?.length > 0) {
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              
              doc.setFontSize(12);
              doc.text('Detalhamento das Perdas (20 primeiros)', 20, yPosition);
              yPosition += 10;

              const detailedData = lossReport.detailed_losses.slice(0, 20).map(item => [
                item.store_name,
                item.salad_type,
                item.batch_number,
                item.reason,
                item.quantity.toString(),
                item.date
              ]);

              addAutoTable(doc, {
                startY: yPosition,
                head: [['Loja', 'Salada', 'Lote', 'Motivo', 'Qtd', 'Data']],
                body: detailedData,
                theme: 'grid',
                headStyles: { fillColor: [96, 125, 139] },
                columnStyles: {
                  0: { cellWidth: 35 },
                  1: { cellWidth: 35 },
                  2: { cellWidth: 25 },
                  3: { cellWidth: 40 },
                  4: { cellWidth: 15, halign: 'center' },
                  5: { cellWidth: 25 }
                }
              });
            }
          } else {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhum dado disponível para o período selecionado.', 20, yPosition);
          }
          break;

        case 'profit-loss':
          if (profitLossEfficiency.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Eficiência Operacional', 20, yPosition);
            yPosition += 10;

            const efficiencyData = profitLossEfficiency.map(item => [
              item.store_name,
              item.sent.toString(),
              item.lost.toString(),
              `${item.efficiency}%`,
              `R$ ${item.estimated_sales.toFixed(2)}`
            ]);

            addAutoTable(doc, {
              startY: yPosition,
              head: [['Loja', 'Enviado', 'Perdido', 'Aproveitamento', 'Vendas Estimadas']],
              body: efficiencyData,
              theme: 'grid',
              headStyles: { fillColor: [76, 175, 80] },
              columnStyles: {
                3: { 
                  cellWidth: 30,
                  halign: 'center'
                },
                4: { cellWidth: 40, halign: 'right' }
              }
            });
          } else {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhum dado disponível para o período selecionado.', 20, yPosition);
          }
          break;
          
        case 'batch-loss':
          if (batchLossReport.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Perdas por Lote', 20, yPosition);
            yPosition += 10;

            const batchData = batchLossReport.map(item => [
              item.batch_number,
              item.produced.toString(),
              item.sold.toString(),
              item.lost.toString(),
              `${item.loss_percentage}%`,
              item.production_date,
              item.affected_stores.join(', ').substring(0, 30) + (item.affected_stores.join(', ').length > 30 ? '...' : '')
            ]);

            addAutoTable(doc, {
              startY: yPosition,
              head: [['Lote', 'Produzido', 'Vendido', 'Perdido', '% Perda', 'Data Produção', 'Lojas Afetadas']],
              body: batchData,
              theme: 'grid',
              headStyles: { fillColor: [255, 152, 0] },
              columnStyles: {
                4: { 
                  cellWidth: 20,
                  halign: 'center'
                },
                6: { cellWidth: 50 }
              }
            });
          } else {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhum dado disponível para o período selecionado.', 20, yPosition);
          }
          break;
          
        case 'comparative':
          if (comparativeReport.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Envio × Solicitação por Loja', 20, yPosition);
            yPosition += 10;

            const compData = comparativeReport.map(item => [
              item.store_name,
              item.requested.toString(),
              item.produced.toString(),
              item.sent.toString(),
              item.difference.toString(),
              `${item.efficiency_rate}%`
            ]);

            addAutoTable(doc, {
              startY: yPosition,
              head: [['Loja', 'Solicitado', 'Produzido', 'Enviado', 'Diferença', 'Eficiência']],
              body: compData,
              theme: 'grid',
              headStyles: { fillColor: [156, 39, 176] },
              columnStyles: {
                4: { 
                  cellWidth: 25,
                  halign: 'center'
                },
                5: { 
                  cellWidth: 25,
                  halign: 'center'
                }
              }
            });
          } else {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhum dado disponível para o período selecionado.', 20, yPosition);
          }
          break;
          
        case 'corrections-list':
          if (correctionsList.length > 0) {
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Lista de Correções', 20, yPosition);
            yPosition += 10;

            // Estatísticas
            const totalCorrections = correctionsList.length;
            const totalValue = correctionsList.reduce((sum, item) => sum + (item.total_value || 0), 0);
            const avgDelay = correctionsList.length > 0 
              ? (correctionsList.reduce((sum, item) => sum + (item.delay_days || 0), 0) / correctionsList.length).toFixed(1)
              : '0';

            const statsData = [
              ['Total Correções', totalCorrections.toString()],
              ['Valor Total', `R$ ${totalValue.toFixed(2)}`],
              ['Média Atraso', `${avgDelay} dias`]
            ];

            addAutoTable(doc, {
              startY: yPosition,
              head: [['Estatística', 'Valor']],
              body: statsData,
              theme: 'grid',
              headStyles: { fillColor: [156, 39, 176] }
            });

            yPosition = doc.lastAutoTable?.finalY || yPosition + 30;

            // Tabela de correções
            if (yPosition > 200) {
              doc.addPage();
              yPosition = 20;
            }

            doc.setFontSize(12);
            doc.text('Detalhamento das Correções', 20, yPosition);
            yPosition += 10;

            const correctionsData = correctionsList.slice(0, 20).map(item => [
              new Date(item.loss_date).toLocaleDateString('pt-BR'),
              item.store_name,
              item.total_items.toString(),
              `R$ ${item.total_value?.toFixed(2) || '0.00'}`,
              item.correction_reason || 'Não informado',
              item.delay_days > 0 ? `+${item.delay_days} dias` : 'No prazo',
              item.corrected_by || 'Sistema',
              new Date(item.correction_date).toLocaleDateString('pt-BR')
            ]);

            addAutoTable(doc, {
              startY: yPosition,
              head: [['Data Perda', 'Loja', 'Itens', 'Valor', 'Motivo', 'Atraso', 'Corrigido por', 'Data Correção']],
              body: correctionsData,
              theme: 'grid',
              headStyles: { fillColor: [96, 125, 139] },
              columnStyles: {
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 25, halign: 'right' },
                5: { 
                  cellWidth: 25
                }
              }
            });
          } else {
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text('Nenhuma correção registrada.', 20, yPosition);
          }
          break;

        default:
          doc.setFontSize(14);
          doc.setTextColor(100, 100, 100);
          doc.text('Relatório não implementado para PDF.', 20, yPosition);
          break;
      }

      // 5. Adicionar rodapé em todas as páginas
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
        doc.text('Sunset Saladas - Sistema de Gestão', 105, 292, { align: 'center' });
      }

      // 6. Salvar o PDF
      doc.save(`relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
      
      // 7. Feedback para o usuário
      console.log(`✅ PDF gerado com sucesso: ${reportType}`);
      setPdfReady(true);

    } catch (error: any) {
      console.error('❌ Erro ao gerar PDF:', error);
      
      // Mensagens de erro mais amigáveis
      if (error.message.includes('Não foi possível carregar')) {
        alert('📚 Erro: Bibliotecas de PDF não disponíveis.\n\nSoluções:\n1. Recarregue a página\n2. Verifique se instalou: npm install jspdf jspdf-autotable');
      } else {
        alert(`📄 Erro ao gerar PDF:\n${error.message}\n\nVerifique o console para mais detalhes.`);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const getReportTitle = (reportType: string): string => {
    const titles: { [key: string]: string } = {
      'day-summary': 'Resumo do Dia (Pedidos × Envios)',
      'losses': 'Perdas de Saladas',
      'profit-loss': 'Eficiência Operacional',
      'batch-loss': 'Perdas por Lote',
      'comparative': 'Envio × Solicitação por Loja',
      'audit': 'Auditoria de Ajustes',
      'corrections-list': 'Lista de Correções'
    };
    return titles[reportType] || 'Relatório';
  };

  const exportReport = async (type: 'excel' | 'pdf') => {
    if (type === 'pdf') {
      await exportToPDF(selectedReport);
      return;
    }

    switch (selectedReport) {
      case 'day-summary':
        if (daySummary) {
          const summaryData = [
            { 
              'Data': selectedDate, 
              'Solicitadas': daySummary.salads_requested, 
              'Produzidas': daySummary.salads_produced, 
              'Enviadas': daySummary.salads_sent, 
              'Diferença': daySummary.difference,
              'Perdas': daySummary.total_lost || 0,
              'Valor Perdas': `R$ ${(daySummary.total_value_lost || 0).toFixed(2)}`
            }
          ];
          await exportToExcel(summaryData, `resumo_dia_${selectedDate}.xlsx`, 'Resumo Geral');
          
          if (daySummary.salads_by_type?.length > 0) {
            const typeData = daySummary.salads_by_type.map(item => ({
              'Tipo': item.salad_type,
              'Solicitado': item.requested,
              'Produzido': item.produced,
              'Enviado': item.sent,
              'Diferença': item.difference
            }));
            await exportToExcel(typeData, `resumo_tipo_${selectedDate}.xlsx`, 'Por Tipo');
          }
        }
        break;
        
      case 'losses':
        if (lossReport) {
          const lossData = lossReport.detailed_losses?.map(item => ({
            'Loja': item.store_name,
            'Salada': item.salad_type,
            'Lote': item.batch_number,
            'Motivo': item.reason,
            'Quantidade': item.quantity,
            'Valor': `R$ ${(item.value || 0).toFixed(2)}`,
            'Data': item.date
          })) || [];
          const fileName = `relatorio_perdas_${startDate}_a_${endDate}.xlsx`;
          await exportToExcel(lossData, fileName, 'Perdas Detalhadas');
        }
        break;
        
      case 'profit-loss':
        const profitData = profitLossEfficiency.map(item => ({
          'Loja': item.store_name,
          'Enviado': item.sent,
          'Perdido': item.lost,
          'Aproveitamento': `${item.efficiency}%`,
          'Vendas Estimadas': `R$ ${item.estimated_sales.toFixed(2)}`
        }));
        const profitFileName = `lucro_perda_${startDate}_a_${endDate}.xlsx`;
        await exportToExcel(profitData, profitFileName, 'Eficiência');
        break;
        
      case 'batch-loss':
        const batchData = batchLossReport.map(item => ({
          'Lote': item.batch_number,
          'Produzido': item.produced,
          'Vendido': item.sold,
          'Perdido': item.lost,
          '% Perda': `${item.loss_percentage}%`,
          'Data Produção': item.production_date,
          'Lojas Afetadas': item.affected_stores.join(', ')
        }));
        const batchFileName = `perdas_lote_${startDate}_a_${endDate}.xlsx`;
        await exportToExcel(batchData, batchFileName, 'Perdas por Lote');
        break;
        
      case 'comparative':
        const compData = comparativeReport.map(item => ({
          'Loja': item.store_name,
          'Período': item.period,
          'Solicitado': item.requested,
          'Produzido': item.produced,
          'Enviado': item.sent,
          'Diferença': item.difference,
          'Eficiência': `${item.efficiency_rate}%`
        }));
        const compFileName = `comparativo_${startDate}_a_${endDate}.xlsx`;
        await exportToExcel(compData, compFileName, 'Comparativo');
        break;
        
      case 'corrections-list':
        await exportCorrectionsToExcel();
        break;
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
          color: '#2196F3',
          textAlign: 'center'
        }}>
          👨‍💼 Sunset Saladas - Administração
        </div>
        <div style={{ 
          fontSize: '18px', 
          color: '#666',
          textAlign: 'center'
        }}>
          Carregando dashboard administrativo...
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
        title="Dashboard Administrativo"
        userEmail={userEmail}
        profileType="admin"
      />
      
      <main style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* ========== MENU DE RELATÓRIOS ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '25px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginBottom: '30px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '15px',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => setSelectedReport('day-summary')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'day-summary' ? '#2196F3' : '#f5f5f5',
              color: selectedReport === 'day-summary' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📊 Resumo do Dia
          </button>
          
          <button
            onClick={() => setSelectedReport('losses')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'losses' ? '#F44336' : '#f5f5f5',
              color: selectedReport === 'losses' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📉 Perdas de Saladas
          </button>
          
          <button
            onClick={() => setSelectedReport('profit-loss')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'profit-loss' ? '#4CAF50' : '#f5f5f5',
              color: selectedReport === 'profit-loss' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            💰 Lucro × Perda
          </button>
          
          <button
            onClick={() => setSelectedReport('batch-loss')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'batch-loss' ? '#FF9800' : '#f5f5f5',
              color: selectedReport === 'batch-loss' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🏷️ Perdas por Lote
          </button>
          
          <button
            onClick={() => setSelectedReport('comparative')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'comparative' ? '#9C27B0' : '#f5f5f5',
              color: selectedReport === 'comparative' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ⚖️ Envio × Solicitação
          </button>
          
          <button
            onClick={() => setSelectedReport('audit')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'audit' ? '#607D8B' : '#f5f5f5',
              color: selectedReport === 'audit' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📝 Auditoria
          </button>

          <button
            onClick={() => setSelectedReport('corrections-list')}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedReport === 'corrections-list' ? '#9C27B0' : '#f5f5f5',
              color: selectedReport === 'corrections-list' ? 'white' : '#666',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📋 Lista de Correções
          </button>

        </div>

        {/* ========== FILTROS E CONTROLES ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px',
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          {/* Filtro de data específico para Resumo do Dia */}
          {selectedReport === 'day-summary' && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Data
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}
          
          {/* Filtros gerais para outros relatórios */}
          {selectedReport !== 'day-summary' && selectedReport !== 'audit' && selectedReport !== 'corrections-list' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                  Loja
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  style={{
                    padding: '10px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minWidth: '200px'
                  }}
                >
                  <option value="all">Todas as Lojas</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '10px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                  Data Final
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '10px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </>
          )}
          
          {/* Modo de visualização para Resumo do Dia */}
          {selectedReport === 'day-summary' && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Modo de Visualização
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setViewMode('consolidated')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: viewMode === 'consolidated' ? '#2196F3' : '#f5f5f5',
                    color: viewMode === 'consolidated' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Modo A - Consolidado
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: viewMode === 'detailed' ? '#4CAF50' : '#f5f5f5',
                    color: viewMode === 'detailed' ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Modo B - Detalhado
                </button>
              </div>
            </div>
          )}
          
          <div style={{ flex: 1, display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => exportReport('excel')}
              disabled={exportLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: exportLoading ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {exportLoading ? '⏳ Exportando...' : '📗 Excel'}
            </button>
            
            <button
              onClick={() => exportReport('pdf')}
              disabled={pdfLoading || !pdfReady}
              style={{
                padding: '10px 20px',
                backgroundColor: pdfLoading || !pdfReady ? '#ccc' : '#F44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: pdfLoading || !pdfReady ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {pdfLoading ? '⏳ Gerando...' : 
               !pdfReady ? '📚 Carregando...' : '📕 PDF'}
            </button>
          </div>
        </div>

        {/* ========== CONTEÚDO DOS RELATÓRIOS ========== */}
        <div style={{ marginBottom: '40px' }}>
          
          {/* 1️⃣ RESUMO DO DIA */}
          {selectedReport === 'day-summary' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                  📊 Resumo Operacional - {new Date(selectedDate).toLocaleDateString('pt-BR')}
                </h3>
                <span style={{
                  padding: '6px 12px',
                  backgroundColor: viewMode === 'consolidated' ? '#2196F3' : '#4CAF50',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {viewMode === 'consolidated' ? 'Modo A - Consolidado' : 'Modo B - Detalhado'}
                </span>
              </div>
              
              {!daySummary ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nenhum dado encontrado para esta data.
                </div>
              ) : (
                <>
                  {/* Bloco 1 — Consolidado Geral */}
                  <div style={{ marginBottom: '30px' }}>
                    <h4 style={{ color: '#2196F3', marginBottom: '15px' }}>Consolidado Geral</h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '20px'
                    }}>
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Saladas Solicitadas</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{daySummary.salads_requested}</div>
                      </div>
                      
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Saladas Produzidas</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{daySummary.salads_produced}</div>
                      </div>
                      
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Saladas Enviadas</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{daySummary.salads_sent}</div>
                      </div>
                      
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Diferença</div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: daySummary.difference < 0 ? '#F44336' : '#4CAF50'
                        }}>
                          {daySummary.difference > 0 ? '+' : ''}{daySummary.difference}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center',
                        borderLeft: '4px solid #F44336'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Perdas Registradas</div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: '#F44336'
                        }}>
                          {daySummary.total_lost || 0}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center',
                        borderLeft: '4px solid #FF9800'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Valor Perdas</div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: '#FF9800'
                        }}>
                          R$ {(daySummary.total_value_lost || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2 — Consolidado por tipo de salada */}
                  {daySummary.salads_by_type && daySummary.salads_by_type.length > 0 && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ color: '#4CAF50', marginBottom: '15px' }}>Consolidado por Tipo de Salada</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8f9fa' }}>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Tipo de Salada</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Solicitado</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Produzido</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Enviado</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Diferença</th>
                            </tr>
                          </thead>
                          <tbody>
                            {daySummary.salads_by_type.map((item, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.salad_type}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{item.requested}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{item.produced}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{item.sent}</td>
                                <td style={{ 
                                  padding: '12px', 
                                  textAlign: 'center',
                                  color: item.difference < 0 ? '#F44336' : '#4CAF50',
                                  fontWeight: 'bold'
                                }}>
                                  {item.difference > 0 ? '+' : ''}{item.difference}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Bloco 3 — Divergências por Loja (apenas no Modo B) */}
                  {viewMode === 'detailed' && daySummary.divergences_by_store && daySummary.divergences_by_store.length > 0 && (
                    <div>
                      <h4 style={{ color: '#F44336', marginBottom: '15px' }}>Divergências por Loja</h4>
                      <div style={{ 
                        padding: '20px', 
                        backgroundColor: '#FFF3E0',
                        borderRadius: '8px',
                        borderLeft: '4px solid #F44336'
                      }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#FFEBEE' }}>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #FFCDD2' }}>Loja</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #FFCDD2' }}>Salada</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #FFCDD2' }}>Pedido</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #FFCDD2' }}>Enviado</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #FFCDD2' }}>Diferença</th>
                              </tr>
                            </thead>
                            <tbody>
                              {daySummary.divergences_by_store.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #FFE0E0' }}>
                                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.store_name}</td>
                                  <td style={{ padding: '12px' }}>{item.salad_type}</td>
                                  <td style={{ padding: '12px', textAlign: 'center' }}>{item.requested}</td>
                                  <td style={{ padding: '12px', textAlign: 'center' }}>{item.sent}</td>
                                  <td style={{ 
                                    padding: '12px', 
                                    textAlign: 'center',
                                    color: '#F44336',
                                    fontWeight: 'bold'
                                  }}>
                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 2️⃣ PERDAS DE SALADAS */}
          {selectedReport === 'losses' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                  📉 Perdas de Saladas - {startDate} a {endDate}
                </h3>
              </div>
              
              {!lossReport ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nenhum dado encontrado para o período selecionado.
                </div>
              ) : (
                <>
                  {/* Bloco 1 — Consolidado Geral de Perdas */}
                  <div style={{ marginBottom: '30px' }}>
                    <h4 style={{ color: '#F44336', marginBottom: '15px' }}>Consolidado Geral de Perdas</h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '20px'
                    }}>
                      <div style={{
                        padding: '25px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center',
                        borderLeft: '4px solid #F44336'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Total Perdido</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#F44336' }}>
                          {lossReport.total_lost} saladas
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '25px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        textAlign: 'center',
                        borderLeft: '4px solid #FF9800'
                      }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Valor Total</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#FF9800' }}>
                          R$ {lossReport.total_value.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2 — Perdas por Loja */}
                  {lossReport.losses_by_store && lossReport.losses_by_store.length > 0 && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ color: '#FF9800', marginBottom: '15px' }}>Perdas por Loja</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#FFF3E0' }}>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #FFE0B2' }}>Loja</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #FFE0B2' }}>Quantidade</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #FFE0B2' }}>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lossReport.losses_by_store.map((item, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid #FFECB3' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.store_name}</td>
                                <td style={{ 
                                  padding: '12px', 
                                  textAlign: 'center',
                                  color: '#F44336',
                                  fontWeight: 'bold'
                                }}>
                                  {item.quantity}
                                </td>
                                <td style={{ 
                                  padding: '12px', 
                                  textAlign: 'center',
                                  fontWeight: 'bold'
                                }}>
                                  R$ {item.value.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Bloco 3 — Perdas por Motivo */}
                  {lossReport.losses_by_reason && lossReport.losses_by_reason.length > 0 && (
                    <div style={{ marginBottom: '30px' }}>
                      <h4 style={{ color: '#9C27B0', marginBottom: '15px' }}>Perdas por Motivo</h4>
                      <div style={{ 
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '20px'
                      }}>
                        {lossReport.losses_by_reason.map((item, index) => (
                          <div key={index} style={{
                            padding: '20px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ fontWeight: 'bold' }}>{item.reason}</div>
                            <div style={{ 
                              fontSize: '20px', 
                              fontWeight: 'bold',
                              color: '#F44336'
                            }}>
                              {item.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bloco 4 — Detalhamento */}
                  {lossReport.detailed_losses && lossReport.detailed_losses.length > 0 && (
                    <div>
                      <h4 style={{ color: '#607D8B', marginBottom: '15px' }}>Detalhamento das Perdas</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#ECEFF1' }}>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #CFD8DC' }}>Loja</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #CFD8DC' }}>Salada</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #CFD8DC' }}>Lote</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #CFD8DC' }}>Motivo</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #CFD8DC' }}>Qtd</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #CFD8DC' }}>Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lossReport.detailed_losses.slice(0, 20).map((item, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid #E0E0E0' }}>
                                <td style={{ padding: '12px' }}>{item.store_name}</td>
                                <td style={{ padding: '12px' }}>{item.salad_type}</td>
                                <td style={{ padding: '12px', fontFamily: 'monospace' }}>{item.batch_number}</td>
                                <td style={{ padding: '12px' }}>{item.reason}</td>
                                <td style={{ 
                                  padding: '12px', 
                                  textAlign: 'center',
                                  color: '#F44336',
                                  fontWeight: 'bold'
                                }}>
                                  {item.quantity}
                                </td>
                                <td style={{ padding: '12px' }}>{item.date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {lossReport.detailed_losses.length > 20 && (
                        <div style={{ textAlign: 'center', marginTop: '15px', color: '#666' }}>
                          Mostrando 20 de {lossReport.detailed_losses.length} registros
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 3️⃣ LUCRO × PERDA */}
          {selectedReport === 'profit-loss' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                  💰 Eficiência Operacional - {startDate} a {endDate}
                </h3>
              </div>
              
              {profitLossEfficiency.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nenhum dado encontrado para o período selecionado.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Loja</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Enviado</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Perdido</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Aproveitamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitLossEfficiency.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.store_name}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{item.sent}</td>
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center',
                            color: '#F44336',
                            fontWeight: 'bold'
                          }}>
                            {item.lost}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{
                              padding: '8px 12px',
                              backgroundColor: item.efficiency >= 80 ? '#E8F5E9' : 
                                           item.efficiency >= 60 ? '#FFF3E0' : '#FFEBEE',
                              color: item.efficiency >= 80 ? '#2E7D32' : 
                                     item.efficiency >= 60 ? '#EF6C00' : '#C62828',
                              borderRadius: '20px',
                              fontWeight: 'bold',
                              display: 'inline-block',
                              minWidth: '80px'
                            }}>
                              {item.efficiency}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4️⃣ PERDAS POR LOTE */}
          {selectedReport === 'batch-loss' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                  🏷️ Perdas por Lote - {startDate} a {endDate}
                </h3>
                <span style={{ color: '#666', fontSize: '14px' }}>
                  {batchLossReport.length} lotes analisados
                </span>
              </div>
              
              {batchLossReport.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nenhum lote com perdas encontrado para o período selecionado.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Lote</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Produzido</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Vendido</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Perdido</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>% Perda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchLossReport.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.batch_number}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{item.produced}</td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#4CAF50', fontWeight: 'bold' }}>
                            {item.sold}
                          </td>
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center',
                            color: '#F44336',
                            fontWeight: 'bold'
                          }}>
                            {item.lost}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{
                              padding: '6px 10px',
                              backgroundColor: item.loss_percentage > 20 ? '#FFEBEE' : 
                                           item.loss_percentage > 10 ? '#FFF3E0' : '#E8F5E9',
                              color: item.loss_percentage > 20 ? '#C62828' : 
                                     item.loss_percentage > 10 ? '#EF6C00' : '#2E7D32',
                              borderRadius: '15px',
                              fontWeight: 'bold',
                              display: 'inline-block',
                              minWidth: '60px'
                            }}>
                              {item.loss_percentage}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5️⃣ ENVIO × SOLICITAÇÃO */}
          {selectedReport === 'comparative' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                  ⚖️ Envio × Solicitação - {startDate} a {endDate}
                </h3>
              </div>
              
              {comparativeReport.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nenhum dado encontrado para o período selecionado.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Loja</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Solicitado</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Produzido</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Enviado</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Diferença</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Eficiência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativeReport.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.store_name}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{item.requested}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{item.produced}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{item.sent}</td>
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center',
                            color: item.difference < 0 ? '#F44336' : '#4CAF50',
                            fontWeight: 'bold'
                          }}>
                            {item.difference > 0 ? '+' : ''}{item.difference}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{
                              padding: '8px 12px',
                              backgroundColor: item.efficiency_rate >= 95 ? '#E8F5E9' : 
                                           item.efficiency_rate >= 90 ? '#FFF3E0' : '#FFEBEE',
                              color: item.efficiency_rate >= 95 ? '#2E7D32' : 
                                     item.efficiency_rate >= 90 ? '#EF6C00' : '#C62828',
                              borderRadius: '20px',
                              fontWeight: 'bold',
                              display: 'inline-block',
                              minWidth: '80px'
                            }}>
                              {item.efficiency_rate}%
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* AUDITORIA - LISTA DE CORREÇÕES */}
          {selectedReport === 'corrections-list' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '25px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                  📋 Correções Realizadas
                </h3>
                <span style={{ color: '#666', fontSize: '14px' }}>
                  {correctionsList.length} registros
                </span>
              </div>
        
              {correctionsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Nenhuma correção registrada.
                </div>
              ) : (
                <>
                  {/* Estatísticas rápidas */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px',
                    marginBottom: '25px'
                  }}>
                    <div style={{
                      padding: '15px',
                      backgroundColor: '#E3F2FD',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#1565C0', marginBottom: '5px' }}>Total Correções</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                        {correctionsList.length}
                      </div>
                    </div>
                    
                    <div style={{
                      padding: '15px',
                      backgroundColor: '#FFF3E0',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#E65100', marginBottom: '5px' }}>Valor Total</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                        R$ {correctionsList.reduce((sum, item) => sum + (item.total_value || 0), 0).toFixed(2)}
                      </div>
                    </div>
                    
                    <div style={{
                      padding: '15px',
                      backgroundColor: '#E8F5E9',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#2E7D32', marginBottom: '5px' }}>Média Atraso</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                        {correctionsList.length > 0 
                          ? (correctionsList.reduce((sum, item) => sum + (item.delay_days || 0), 0) / correctionsList.length).toFixed(1)
                          : '0'
                        } dias
                      </div>
                    </div>
                  </div>

                  {/* Tabela */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Data Perda</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Loja</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Itens</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Valor</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Motivo</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Atraso</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Corrigido por</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Data Correção</th>
                        </tr>
                      </thead>
                      <tbody>
                        {correctionsList.map((correction) => (
                          <tr key={correction.loss_id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px' }}>
                              {new Date(correction.loss_date).toLocaleDateString('pt-BR')}
                            </td>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>
                              {correction.store_name}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                width: '30px',
                                height: '30px',
                                backgroundColor: '#E3F2FD',
                                borderRadius: '50%',
                                lineHeight: '30px',
                                fontWeight: 'bold'
                              }}>
                                {correction.total_items}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ fontWeight: 'bold', color: '#F44336' }}>
                                R$ {correction.total_value?.toFixed(2) || '0.00'}
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ 
                                padding: '4px 8px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px',
                                fontSize: '13px'
                              }}>
                                {correction.correction_reason || 'Não informado'}
                              </div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{
                                padding: '6px 10px',
                                backgroundColor: correction.delay_days > 0 ? '#FFEBEE' : '#E8F5E9',
                                color: correction.delay_days > 0 ? '#C62828' : '#2E7D32',
                                borderRadius: '15px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'inline-block',
                                minWidth: '80px'
                              }}>
                                {correction.delay_days > 0 
                                  ? `+${correction.delay_days} dias` 
                                  : 'No prazo'}
                              </span>
                            </td>
                            <td style={{ padding: '12px' }}>
                              {correction.corrected_by || 'Sistema'}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                              {new Date(correction.correction_date).toLocaleString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Botão exportar */}
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                      onClick={exportCorrectionsToExcel}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      📥 Exportar Correções
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}