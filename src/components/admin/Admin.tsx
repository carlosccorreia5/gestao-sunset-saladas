// Removi a importação do React pois não é mais necessária em projetos modernos
// O Vercel estava reclamando que estava declarado mas não usado

import Header from '../common/Header'; // Importação correta (default import)

export function Admin() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      <Header title="Administrativo" profileType="admin" />
      
      <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#1F2937', marginBottom: '1rem' }}>
            📊 Painel Administrativo
          </h2>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>
            Acesso total, relatórios e auditoria (em desenvolvimento)
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginTop: '2rem'
          }}>
            <div style={{
              background: '#F0F9FF',
              padding: '1.5rem',
              borderRadius: '8px',
              borderLeft: '4px solid #0EA5E9'
            }}>
              <h4 style={{ color: '#0369A1' }}>📈 Relatórios</h4>
              <p style={{ color: '#075985', fontSize: '14px' }}>
                Produção, envios, perdas, vendas estimadas
              </p>
            </div>
            
            <div style={{
              background: '#FEF3C7',
              padding: '1.5rem',
              borderRadius: '8px',
              borderLeft: '4px solid #F59E0B'
            }}>
              <h4 style={{ color: '#92400E' }}>🔍 Auditoria</h4>
              <p style={{ color: '#92400E', fontSize: '14px' }}>
                Registro completo de todos os ajustes
              </p>
            </div>
            
            <div style={{
              background: '#D1FAE5',
              padding: '1.5rem',
              borderRadius: '8px',
              borderLeft: '4px solid #10B981'
            }}>
              <h4 style={{ color: '#065F46' }}>⚙️ Configurações</h4>
              <p style={{ color: '#065F46', fontSize: '14px' }}>
                Lojas, tipos de salada, usuários
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}