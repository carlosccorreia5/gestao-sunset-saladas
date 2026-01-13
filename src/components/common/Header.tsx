// src/components/common/Header.tsx
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  title: string;
  userEmail?: string;
  storeName?: string;
  profileType?: 'admin' | 'producao' | 'lojas';
}

export default function Header({ title, userEmail, storeName, profileType }: HeaderProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <header style={{
      backgroundColor: 'white',
      padding: '15px 30px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div>
        <h1 style={{
          margin: 0,
          fontSize: '24px',
          color: '#333',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ color: '#FF6B6B' }}>🥗</span>
          {title}
        </h1>
        
        {storeName && (
          <p style={{
            margin: '5px 0 0 0',
            fontSize: '14px',
            color: '#666'
          }}>
            🏪 Loja: <strong>{storeName}</strong>
          </p>
        )}
        
        {userEmail && (
          <p style={{
            margin: '5px 0 0 0',
            fontSize: '12px',
            color: '#888'
          }}>
            👤 {userEmail}
          </p>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {profileType === 'lojas' && (
          <div style={{
            padding: '5px 15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#1976d2'
          }}>
            MODO LOJA
          </div>
        )}
        
        {profileType === 'producao' && (
          <div style={{
            padding: '5px 15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#2e7d32'
          }}>
            MODO PRODUÇÃO
          </div>
        )}
        
        {profileType === 'admin' && (
          <div style={{
            padding: '5px 15px',
            backgroundColor: '#f3e5f5',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#7b1fa2'
          }}>
            MODO ADMIN
          </div>
        )}
        
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 20px',
            backgroundColor: '#f5f5f5',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '500',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ffebee';
            e.currentTarget.style.color = '#d32f2f';
            e.currentTarget.style.borderColor = '#ffcdd2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.borderColor = '#ddd';
          }}
        >
          <span>🚪</span>
          Sair
        </button>
      </div>
    </header>
  );
}