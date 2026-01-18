// src/components/auth/ProfileSelector.tsx - VERSÃO FINAL AJUSTADA
import { useNavigate } from 'react-router-dom';

export default function ProfileSelector() {
  const navigate = useNavigate();

  const profiles = [
    {
      id: 'producao',
      name: 'Produção',
      description: 'Controle de produção e estoque',
      color: '#4CAF50',
      icon: '🏭',
      bgColor: '#E8F5E9',
      textColor: '#2E7D32'
    },
    {
      id: 'lojas',
      name: 'Lojas',
      description: 'Acesso às 12 lojas Sunset',
      color: '#2196F3',
      icon: '🏪',
      bgColor: '#E3F2FD',
      textColor: '#1565C0'
    },
    {
      id: 'admin',
      name: 'Administrativo',
      description: 'Relatórios e gestão completa',
      color: '#9C27B0',
      icon: '👑',
      bgColor: '#F3E5F5',
      textColor: '#7B1FA2'
    }
  ];

  const handleProfileSelect = (profileId: string) => {
    navigate(`/login/${profileId}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      {/* Cabeçalho */}
      <div style={{
        textAlign: 'center',
        marginBottom: '50px',
        width: '100%'
      }}>
        <div style={{
          marginBottom: '15px'
        }}>
          {/* LOGO */}
          <img 
            src="/src/assets/logo.png" 
            alt="Logo Sunset Saladas"
            style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              marginBottom: '12px',
              objectFit: 'contain'
            }}
          />
          
          {/* EMOJI */}
          <div style={{
            fontSize: '36px',
            marginBottom: '8px',
            marginTop: '-3px'
          }}>
            🥗
          </div>
          
          {/* TÍTULO COM LILÁS ESCURO */}
          <h1 style={{
            fontSize: '42px',
            fontWeight: 'bold',
            color: '#8B008B',  // ← LILÁS ESCURO (roxo escuro/vinho)
            marginBottom: '5px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
          }}>
            Sunset Saladas
          </h1>
          
          <p style={{
            fontSize: '16px',
            color: '#666',
            marginBottom: '30px'
          }}>
            Sistema de Gestão Integrada
          </p>
        </div>
        
        {/* LINHA DECORATIVA TAMBÉM EM LILÁS */}
        <div style={{
          width: '100px',
          height: '4px',
          backgroundColor: '#8B008B',  // ← Mesmo lilás escuro
          borderRadius: '2px',
          margin: '0 auto'
        }} />
      </div>
      
      {/* Container dos 3 cards - AGORA PERFEITAMENTE ALINHADOS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '25px',
        maxWidth: '950px',
        width: '100%',
        margin: '0 auto'
      }}>
        {profiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => handleProfileSelect(profile.id)}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px 25px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '1px solid #eee',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%' // Garante mesma altura
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.12)';
              e.currentTarget.style.borderColor = profile.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = '#eee';
            }}
          >
            {/* Ícone */}
            <div style={{
              width: '60px',
              height: '60px',
              backgroundColor: profile.bgColor,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              fontSize: '24px',
              color: profile.textColor
            }}>
              {profile.icon}
            </div>
            
            {/* Nome */}
            <h2 style={{
              fontSize: '20px',
              color: '#333',
              marginBottom: '10px',
              fontWeight: '600'
            }}>
              {profile.name}
            </h2>
            
            {/* Descrição */}
            <p style={{
              color: '#666',
              fontSize: '14px',
              lineHeight: '1.5',
              marginBottom: '20px',
              flex: 1
            }}>
              {profile.description}
            </p>
            
            {/* Indicador de seleção */}
            <div style={{
              padding: '8px 20px',
              backgroundColor: profile.bgColor,
              color: profile.textColor,
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '500',
              border: `1px solid ${profile.color}20`
            }}>
              Selecionar
            </div>
          </div>
        ))}
      </div>

      {/* Responsivo para mobile */}
      <div style={{
        display: 'none',
        flexDirection: 'column',
        gap: '15px',
        width: '100%',
        maxWidth: '400px',
        marginTop: '30px'
      }}>
        {/* Mesmo conteúdo para mobile */}
      </div>

      {/* Rodapé */}
      <div style={{
        marginTop: '50px',
        textAlign: 'center',
        color: '#888',
        fontSize: '14px',
        width: '100%'
      }}>
        <p>Selecione seu perfil de acesso</p>
        <p style={{ marginTop: '5px', fontSize: '12px' }}>
          © Sunset Saladas {new Date().getFullYear()} • Versão 2.8
        </p>
      </div>
    </div>
  );
}