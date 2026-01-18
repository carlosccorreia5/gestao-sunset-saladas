// src/components/auth/Login.tsx - ROTAS CORRIGIDAS
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ProfileInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export default function Login() {
  const { profileType } = useParams<{ profileType: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

  // Informações dos perfis
  const profiles: Record<string, ProfileInfo> = {
    producao: {
      id: 'producao',
      name: '🏭 Produção',
      color: '#4CAF50',
      icon: '🏭',
      description: 'Acesso ao controle de produção'
    },
    lojas: {
      id: 'lojas',
      name: '🏪 Lojas',
      color: '#2196F3',
      icon: '🏪',
      description: 'Acesso às lojas Sunset'
    },
    admin: {
      id: 'admin',
      name: '👑 Administrativo',
      color: '#9C27B0',
      icon: '👑',
      description: 'Acesso administrativo'
    }
  };

  useEffect(() => {
    if (profileType && profiles[profileType]) {
      setProfileInfo(profiles[profileType]);
      
      // Set placeholder email baseado no perfil
      if (profileType === 'producao') {
        setEmail('producao@acaisunset.com');
      } else if (profileType === 'admin') {
        setEmail('admin@acaisunset.com');
      }
    } else {
      navigate('/');
    }
  }, [profileType, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Login no Auth do Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (authError) {
        setError('Credenciais inválidas. Verifique seu email e senha.');
        setLoading(false);
        return;
      }

      // 2. Buscar usuário na SUA tabela users COM JOIN com profiles
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          profiles (
            username
          )
        `)
        .eq('email', authData.user.email)  // Relaciona pelo email
        .single();

      if (userError || !userData) {
        setError('Usuário não encontrado na base de dados.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // 3. Verificar se tem perfil associado
      if (!userData.profiles || !userData.profiles.username) {
        setError('Perfil não configurado para este usuário.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // 4. Validar se o perfil do usuário corresponde ao selecionado
      const userProfile = userData.profiles.username;
      
      if (profileType === 'admin' && userProfile !== 'admin') {
        setError('Acesso permitido apenas para administradores.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      
      if (profileType === 'producao' && userProfile !== 'producao') {
        setError('Acesso permitido apenas para produção.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      
      if (profileType === 'lojas' && userProfile !== 'lojas') {
        setError('Acesso permitido apenas para lojas.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // 5. ASSOCIAÇÃO AUTH → USERS (se não tiver auth_id)
      if (userData.auth_id === null || userData.auth_id === undefined) {
        try {
          await supabase
            .from('users')
            .update({ 
              auth_id: authData.user.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', userData.id);
          console.log('Auth ID associado ao usuário:', authData.user.id);
        } catch (updateError) {
          console.warn('Não foi possível atualizar auth_id, continuando...');
        }
      }

      // 6. Login bem-sucedido
      console.log('Login bem-sucedido para:', {
        email: userData.email,
        perfil: userProfile,
        nome: userData.full_name,
        store_id: userData.store_id
      });
      
      // 7. REDIRECIONAMENTO CORRETO - ROTAS FIXADAS! ✅
      console.log(`Redirecionando ${userProfile} para dashboard correto...`);
      
      setTimeout(() => {
        switch(userProfile) {
          case 'admin':
            console.log('Redirecionando para /admin/dashboard');
            navigate('/admin/dashboard');
            break;
          case 'producao':
            console.log('Redirecionando para /production/dashboard'); // ← CORRIGIDO!
            navigate('/production/dashboard');
            break;
          case 'lojas':
            console.log('Redirecionando para /store/dashboard'); // ← CORRIGIDO!
            navigate('/store/dashboard');
            break;
          default:
            console.log('Redirecionando para /dashboard');
            navigate('/dashboard');
        }
      }, 100); // Reduzido para 100ms para ser mais rápido
      
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (!profileInfo) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Botão voltar */}
      <button
        onClick={handleBack}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '10px 20px',
          backgroundColor: 'transparent',
          color: '#666',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        ← Voltar
      </button>

      {/* Card de Login */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '450px',
        textAlign: 'center'
      }}>
        {/* Ícone e Nome do Perfil */}
        <div style={{
          fontSize: '48px',
          marginBottom: '15px',
          color: profileInfo.color
        }}>
          {profileInfo.icon}
        </div>
        
        <h2 style={{
          fontSize: '24px',
          color: '#333',
          marginBottom: '8px'
        }}>
          {profileInfo.name}
        </h2>
        
        <p style={{
          color: '#666',
          fontSize: '14px',
          marginBottom: '30px'
        }}>
          {profileInfo.description}
        </p>

        {/* Formulário */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              textAlign: 'left',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#555',
              fontSize: '14px'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '16px',
                transition: 'border-color 0.3s'
              }}
              placeholder="seu@email.com"
              required
              onFocus={(e) => e.target.style.borderColor = profileInfo.color}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              textAlign: 'left',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#555',
              fontSize: '14px'
            }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '16px',
                transition: 'border-color 0.3s'
              }}
              placeholder="••••••••"
              required
              onFocus={(e) => e.target.style.borderColor = profileInfo.color}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              textAlign: 'left'
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: loading ? '#ccc' : profileInfo.color,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Informações de teste */}
        {profileType === 'producao' && (
          <div style={{
            marginTop: '25px',
            padding: '15px',
            backgroundColor: '#f0f9ff',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#1976d2',
            textAlign: 'left'
          }}>
            <strong>👥 Usuário:</strong>
            <div style={{ marginTop: '5px' }}>
              <div>Email: producao@acaisunset.com</div>
            </div>
          </div>
        )}

        {profileType === 'admin' && (
          <div style={{
            marginTop: '25px',
            padding: '15px',
            backgroundColor: '#f3e5f5',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#7b1fa2',
            textAlign: 'left'
          }}>
            <strong>👑 Usuários admin:</strong>
            <div style={{ marginTop: '5px' }}>
              <div>Email: admin1@acaisunset.com / admin2@acaisunset.com</div>
            </div>
          </div>
        )}

        {profileType === 'lojas' && (
          <div style={{
            marginTop: '25px',
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#2e7d32',
            textAlign: 'left'
          }}>
            <strong>🏪 Usuários das lojas:</strong>
            <div style={{ marginTop: '5px' }}>
              <div>Email: sunset.nomedaLoja@acaisunset.com</div>
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                Ex: sunset.cohajap@acaisunset.com, sunset.tropical@acaisunset.com, etc.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{
        marginTop: '30px',
        textAlign: 'center',
        color: '#888',
        fontSize: '14px'
      }}>
        <p>Sunset Saladas © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}