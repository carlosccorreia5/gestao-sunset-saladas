// src/components/admin/LossCorrection.tsx - VERSÃO COM DUAS DATAS
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Store {
  id: string;
  name: string;
}

interface SaladType {
  id: string;
  name: string;
  price: number;
  shelf_life_days: number;
}

interface CorrectionForm {
  store_id: string;
  salad_type_id: string;
  quantity: number;
  batch_date: string;       // Data do lote (quando produção enviou)
  loss_date: string;        // Data real da perda (quando venceu/não vendeu)
  correction_date: string;  // Data da correção (hoje - automático)
  batch_number: string;
  loss_reason: string;
  correction_reason: string;
  notes: string;
}

export default function LossCorrection() {
  const [stores, setStores] = useState<Store[]>([]);
  const [saladTypes, setSaladTypes] = useState<SaladType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Calcular datas padrão
  const today = new Date();
  const defaultLossDate = new Date();
  defaultLossDate.setDate(today.getDate() - 2); // 2 dias atrás (perda)
  
  const defaultBatchDate = new Date();
  defaultBatchDate.setDate(today.getDate() - 5); // 5 dias atrás (lote)

  const [form, setForm] = useState<CorrectionForm>({
    store_id: '',
    salad_type_id: '',
    quantity: 1,
    batch_date: defaultBatchDate.toISOString().split('T')[0],
    loss_date: defaultLossDate.toISOString().split('T')[0],
    correction_date: today.toISOString().split('T')[0],
    batch_number: '',
    loss_reason: 'vencimento',
    correction_reason: 'loja_esqueceu',
    notes: ''
  });

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Carregar lojas
      const { data: storesData } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      setStores(storesData || []);

      // Carregar tipos de salada
      const { data: saladData } = await supabase
        .from('salad_types')
        .select('id, name, price, shelf_life_days')
        .order('name');
      setSaladTypes(saladData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Validar datas
  const validateDates = () => {
    const batchDate = new Date(form.batch_date);
    const lossDate = new Date(form.loss_date);
    const today = new Date(form.correction_date);
    
    if (lossDate < batchDate) {
      return "❌ Data da perda não pode ser anterior à data do lote";
    }
    
    if (lossDate > today) {
      return "❌ Data da perda não pode ser futura";
    }
    
    if (batchDate > today) {
      return "❌ Data do lote não pode ser futura";
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage('');

    try {
      // 1. Validar datas
      const dateError = validateDates();
      if (dateError) {
        throw new Error(dateError);
      }

      // 2. Validar formulário
      if (!form.store_id || !form.salad_type_id || !form.quantity) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      // 3. Buscar ID do usuário admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) throw new Error('Usuário não encontrado');

      // 4. Buscar preço da salada
      const selectedSalad = saladTypes.find(s => s.id === form.salad_type_id);
      if (!selectedSalad) throw new Error('Tipo de salada não encontrado');

      const totalValue = form.quantity * selectedSalad.price;

      // 5. Verificar se já existe perda registrada para esta data
      const { data: existingLoss } = await supabase
        .from('losses')
        .select('id')
        .eq('store_id', form.store_id)
        .eq('salad_type_id', form.salad_type_id)
        .eq('loss_date', form.loss_date)
        .eq('batch_number', form.batch_number || '')
        .eq('reason', form.loss_reason)
        .single();

      if (existingLoss) {
        const confirm = window.confirm(
          `Já existe uma perda registrada para:\n` +
          `Data: ${form.loss_date}\n` +
          `Loja: ${stores.find(s => s.id === form.store_id)?.name}\n` +
          `Salada: ${selectedSalad.name}\n\n` +
          `Deseja adicionar mais ${form.quantity} unidade(s) a esta perda?`
        );
        
        if (!confirm) {
          setSubmitting(false);
          return;
        }
      }

      // 6. Registrar a perda
      const lossData = {
        store_id: form.store_id,
        salad_type_id: form.salad_type_id,
        batch_number: form.batch_number || `CORR-${Date.now()}`,
        quantity: form.quantity,
        reason: form.loss_reason,
        loss_date: form.loss_date,     // Data real da perda
        batch_date: form.batch_date,   // Data do lote
        value: totalValue,
        status: 'confirmed',
        reported_by: userData.id,
        reported_at: new Date().toISOString(),
        is_manual_adjustment: true,
        should_have_been_reported_on: form.loss_date, // Data que loja deveria ter informado
        actual_reported_on: form.correction_date,     // Data que admin informou
        adjustment_notes: form.notes,
        correction_reason: form.correction_reason
      };

      const { data: insertedLoss, error: lossError } = await supabase
        .from('losses')
        .insert(lossData)
        .select()
        .single();

      if (lossError) throw lossError;

      // 7. Registrar no log de correções
      const { error: correctionError } = await supabase
        .from('loss_corrections')
        .insert({
          store_id: form.store_id,
          salad_type_id: form.salad_type_id,
          quantity: form.quantity,
          batch_date: form.batch_date,
          loss_date: form.loss_date,
          correction_date: form.correction_date,
          reason: form.loss_reason,
          corrected_by: userData.id,
          correction_reason: form.correction_reason,
          original_loss_id: insertedLoss.id,
          notes: form.notes,
          total_value: totalValue,
          ip_address: 'web',
          user_agent: navigator.userAgent
        });

      if (correctionError) throw correctionError;

      // 8. Sucesso - Mensagem detalhada
      const storeName = stores.find(s => s.id === form.store_id)?.name || 'Loja';
      const saladName = selectedSalad.name;
      
      setSuccessMessage(`
✅ **CORREÇÃO REGISTRADA COM SUCESSO!**

**📋 Detalhes da Correção:**
• **Loja:** ${storeName}
• **Salada:** ${saladName} (${form.quantity} unidade(s))
• **Valor Total:** R$ ${totalValue.toFixed(2)}

**📅 Timeline da Correção:**
• **Produção enviou:** ${new Date(form.batch_date).toLocaleDateString('pt-BR')}
• **Perda ocorreu:** ${new Date(form.loss_date).toLocaleDateString('pt-BR')}
• **Loja deveria informar:** ${new Date(form.loss_date).toLocaleDateString('pt-BR')}
• **Admin corrigiu:** ${new Date(form.correction_date).toLocaleDateString('pt-BR')}

**📝 Motivos:**
• **Motivo da perda:** ${form.loss_reason}
• **Motivo da correção:** ${form.correction_reason}

Esta correção será refletida em todos os relatórios automaticamente.
      `);

      // 9. Limpar formulário (mantendo datas)
      setForm(prev => ({
        ...prev,
        store_id: '',
        salad_type_id: saladTypes.length > 0 ? saladTypes[0].id : '',
        quantity: 1,
        batch_number: '',
        notes: ''
      }));

    } catch (error: any) {
      console.error('Erro ao registrar correção:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e0e0e0',
          borderTop: '4px solid #2196F3',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <p>Carregando dados...</p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '30px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#2196F3' }}>
          🔧 Corrigir Perda Não Informada
        </h2>
        <p style={{ color: '#666', marginTop: '10px' }}>
          Registre perdas que as lojas esqueceram de informar
        </p>
      </div>

      {successMessage && (
        <div style={{
          padding: '20px',
          backgroundColor: '#E8F5E9',
          borderRadius: '8px',
          marginBottom: '20px',
          borderLeft: '4px solid #4CAF50'
        }}>
          <div style={{ whiteSpace: 'pre-line' }}>{successMessage}</div>
          <button
            onClick={() => setSuccessMessage('')}
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ✕ Fechar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Cabeçalho informativo */}
        <div style={{
          padding: '15px',
          backgroundColor: '#E3F2FD',
          borderRadius: '8px',
          marginBottom: '25px',
          borderLeft: '4px solid #2196F3'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>ℹ️</span>
            <strong style={{ color: '#0D47A1' }}>Como usar este formulário:</strong>
          </div>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#1565C0' }}>
            <li>Informe a <strong>loja</strong> que esqueceu de reportar</li>
            <li>Selecione o <strong>tipo de salada</strong> e <strong>quantidade</strong> perdida</li>
            <li>Informe a <strong>data do lote</strong> (quando a produção enviou)</li>
            <li>Informe a <strong>data da perda</strong> (quando realmente venceu/não vendeu)</li>
            <li>Preencha os <strong>motivos</strong> e clique em registrar</li>
          </ol>
        </div>

        {/* Seção 1: Dados Básicos */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2196F3', marginBottom: '15px', borderBottom: '2px solid #E3F2FD', paddingBottom: '5px' }}>
            1. Dados Básicos
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '20px',
            marginBottom: '20px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Loja *
              </label>
              <select
                value={form.store_id}
                onChange={(e) => setForm({...form, store_id: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="">Selecione a loja</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Tipo de Salada *
              </label>
              <select
                value={form.salad_type_id}
                onChange={(e) => setForm({...form, salad_type_id: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="">Selecione a salada</option>
                {saladTypes.map(salad => (
                  <option key={salad.id} value={salad.id}>
                    {salad.name} (R$ {salad.price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '20px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Quantidade Perdida *
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 1})}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Número do Lote (opcional)
              </label>
              <input
                type="text"
                value={form.batch_number}
                onChange={(e) => setForm({...form, batch_number: e.target.value})}
                placeholder="Ex: 2024-01-10-BATCH01"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Datas */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2196F3', marginBottom: '15px', borderBottom: '2px solid #E3F2FD', paddingBottom: '5px' }}>
            2. Datas Importantes
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '20px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Data do Lote *
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  (quando a produção enviou)
                </span>
              </label>
              <input
                type="date"
                value={form.batch_date}
                onChange={(e) => setForm({...form, batch_date: e.target.value})}
                required
                max={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Data da Perda *
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  (quando venceu/não vendeu)
                </span>
              </label>
              <input
                type="date"
                value={form.loss_date}
                onChange={(e) => setForm({...form, loss_date: e.target.value})}
                required
                max={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            <strong>Lembrando:</strong> A loja deveria ter informado esta perda na <strong>Data da Perda</strong>
          </div>
        </div>

        {/* Seção 3: Motivos */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2196F3', marginBottom: '15px', borderBottom: '2px solid #E3F2FD', paddingBottom: '5px' }}>
            3. Motivos
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '20px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Motivo da Perda *
              </label>
              <select
                value={form.loss_reason}
                onChange={(e) => setForm({...form, loss_reason: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="vencimento">Vencimento</option>
                <option value="qualidade">Problema de Qualidade</option>
                <option value="avaria">Avaria/Quebra</option>
                <option value="contaminacao">Contaminação</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                Motivo da Correção *
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  (por que a loja não informou?)
                </span>
              </label>
              <select
                value={form.correction_reason}
                onChange={(e) => setForm({...form, correction_reason: e.target.value})}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                <option value="loja_esqueceu">Loja esqueceu de informar</option>
                <option value="funcionario_ausente">Funcionário ausente/folga</option>
                <option value="erro_sistema">Erro no sistema/ausência de energia</option>
                <option value="falha_comunicacao">Falha na comunicação</option>
                <option value="auditoria">Descoberto em auditoria</option>
                <option value="outro">Outro motivo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção 4: Observações */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#2196F3', marginBottom: '15px', borderBottom: '2px solid #E3F2FD', paddingBottom: '5px' }}>
            4. Observações
          </h3>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
              Detalhes Adicionais (opcional)
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                Ex: "Funcionário João estava de férias", "Sistema offline no dia"
              </span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({...form, notes: e.target.value})}
              placeholder="Informe detalhes que ajudem a entender por que a perda não foi informada..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Resumo Visual */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#FFF3E0',
          borderRadius: '8px',
          marginBottom: '30px',
          borderLeft: '4px solid #FF9800'
        }}>
          <h4 style={{ marginTop: 0, color: '#E65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📋</span> Resumo da Correção
          </h4>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px',
            marginTop: '15px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Data do Lote</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2196F3' }}>
                {form.batch_date ? new Date(form.batch_date).toLocaleDateString('pt-BR') : '-'}
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Data da Perda</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#F44336' }}>
                {form.loss_date ? new Date(form.loss_date).toLocaleDateString('pt-BR') : '-'}
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Data da Correção</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4CAF50' }}>
                {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Valor Estimado</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2E7D32' }}>
                R$ {
                  (() => {
                    const salad = saladTypes.find(s => s.id === form.salad_type_id);
                    return salad ? (form.quantity * salad.price).toFixed(2) : '0.00';
                  })()
                }
              </div>
            </div>
          </div>
          
          {validateDates() && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#FFEBEE',
              borderRadius: '6px',
              borderLeft: '4px solid #F44336'
            }}>
              <span style={{ color: '#C62828', fontWeight: 'bold' }}>⚠️ Atenção:</span> {validateDates()}
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              // Limpar formulário
              setForm({
                store_id: '',
                salad_type_id: saladTypes.length > 0 ? saladTypes[0].id : '',
                quantity: 1,
                batch_date: defaultBatchDate.toISOString().split('T')[0],
                loss_date: defaultLossDate.toISOString().split('T')[0],
                correction_date: today.toISOString().split('T')[0],
                batch_number: '',
                loss_reason: 'vencimento',
                correction_reason: 'loja_esqueceu',
                notes: ''
              });
              setSuccessMessage('');
            }}
            style={{
              padding: '15px 30px',
              backgroundColor: '#f5f5f5',
              color: '#666',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🔄 Limpar Formulário
          </button>
          
          <button
            type="submit"
            disabled={submitting || !!validateDates()}
            style={{
              padding: '15px 40px',
              backgroundColor: submitting ? '#ccc' : (validateDates() ? '#FF9800' : '#2196F3'),
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: (submitting || validateDates()) ? 'not-allowed' : 'pointer',
              minWidth: '200px'
            }}
          >
            {submitting ? '⏳ Registrando...' : '✅ Registrar Correção'}
          </button>
        </div>

        {/* Nota de rodapé */}
        <div style={{ 
          fontSize: '12px', 
          color: '#888', 
          marginTop: '30px', 
          textAlign: 'center',
          padding: '15px',
          backgroundColor: '#f9f9f9',
          borderRadius: '6px',
          borderTop: '1px solid #eee'
        }}>
          <strong>💡 Importante:</strong> Esta correção será registrada como uma perda real no sistema e afetará:
          <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <span>• Relatório de Perdas</span>
            <span>• Eficiência da Loja</span>
            <span>• Lucro/Perda</span>
            <span>• KPIs Operacionais</span>
          </div>
        </div>
      </form>
    </div>
  );
}