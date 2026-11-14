'use client';
import { useEffect, useState } from 'react';

type OperatorUser = {
  id: string;
  email: string;
  displayName: string;
  memberships: Array<{ unitId: string; role: string }>;
};

type Broadcast = {
  id: string;
  slug: string;
  title: string;
  status: 'SCHEDULED' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED' | 'FAILED';
  streamPath: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
};

type Invite = {
  id: string;
  maxUses: number;
  uses: number;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
  _count?: { sessions: number };
};

type StreamHealth = {
  srtConnected: boolean;
  hlsAvailable: boolean;
  sourceType?: string;
  readersCount?: number;
  message?: string;
};

type AuditItem = {
  id: string;
  occurredAt: string;
  action: string;
  actor?: { displayName: string; email: string };
  details?: Record<string, unknown>;
};

export default function OperatorPage() {
  const [user, setUser] = useState<OperatorUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dashboard Data
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [health, setHealth] = useState<StreamHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  // Modals
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState(2);
  const [expiresInHours, setExpiresInHours] = useState(4);
  const [confirmModal, setConfirmModal] = useState<{
    action: 'start' | 'pause' | 'resume' | 'end';
    title: string;
    description: string;
  } | null>(null);
  const [sacramentConfirmed, setSacramentConfirmed] = useState(false);

  // New Broadcast Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newScheduledAt, setNewScheduledAt] = useState('');
  const [newStreamPath, setNewStreamPath] = useState('ala01');

  // MFA Modal
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaActivationCode, setMfaActivationCode] = useState('');

  // Headers helper with Anti-CSRF
  const authHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // Check login
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/v1/operator/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // não autenticado
      }
    }
    void checkAuth();
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (!user) return;
    void loadBroadcasts();
    void loadHealth();
    void loadAudit();

    const interval = setInterval(() => {
      void loadHealth();
    }, 10_000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (selectedBroadcast) {
      void loadInvites(selectedBroadcast.id);
    }
  }, [selectedBroadcast]);

  async function loadBroadcasts() {
    try {
      const res = await fetch('/api/v1/operator/broadcasts');
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data);
        if (data.length > 0 && !selectedBroadcast) {
          setSelectedBroadcast(data[0]);
        }
      }
    } catch {}
  }

  async function loadInvites(broadcastId: string) {
    try {
      const res = await fetch(`/api/v1/operator/broadcasts/${broadcastId}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch {}
  }

  async function loadHealth() {
    try {
      const res = await fetch('/api/v1/operator/stream-health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {}
  }

  async function loadAudit() {
    try {
      const res = await fetch('/api/v1/operator/audit?limit=20');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch {}
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/operator/login', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha na autenticação');
      }

      const data = await res.json();
      if (data.mfaRequired) {
        setMfaRequired(true);
      } else {
        setUser(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao efetuar login');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/operator/mfa/verify', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, code: mfaCode }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Código MFA inválido');
      }

      const data = await res.json();
      setUser(data.user);
    } catch (err: any) {
      setError(err.message || 'Erro ao validar MFA');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/v1/operator/logout', { method: 'POST', headers: authHeaders }).catch(() => {});
    setUser(null);
    setSelectedBroadcast(null);
  }

  async function executeTransition(action: 'start' | 'pause' | 'resume' | 'end') {
    if (!selectedBroadcast) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/operator/broadcasts/${selectedBroadcast.id}/${action}`, {
        method: 'POST',
        headers: authHeaders,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Falha ao executar ${action}`);
      }

      const updated = await res.json();
      setSelectedBroadcast(updated);
      setBroadcasts((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setConfirmModal(null);
      setSacramentConfirmed(false);
      void loadAudit();
    } catch (err: any) {
      setError(err.message || 'Erro na transição');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/operator/broadcasts', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: newTitle.trim(),
          scheduledAt: new Date(newScheduledAt).toISOString(),
          streamPath: newStreamPath.trim() || 'ala01',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao agendar reunião');
      }

      const created = await res.json();
      setBroadcasts((prev) => [created, ...prev]);
      setSelectedBroadcast(created);
      setShowCreateModal(false);
      setNewTitle('');
      setNewScheduledAt('');
      setSuccessMsg('Reunião agendada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadAudit();
    } catch (err: any) {
      setError(err.message || 'Falha ao agendar transmissão');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBroadcast) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/operator/broadcasts/${selectedBroadcast.id}/invites`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ maxUses, expiresInHours }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao gerar convite');
      }

      const data = await res.json();
      setCreatedToken(data.token);
      void loadInvites(selectedBroadcast.id);
      void loadAudit();
    } catch (err: any) {
      setError(err.message || 'Falha ao criar convite');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!confirm('Deseja realmente revogar este convite e todas as sessões vinculadas a ele?')) return;
    try {
      const res = await fetch(`/api/v1/operator/invites/${inviteId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok && selectedBroadcast) {
        void loadInvites(selectedBroadcast.id);
        void loadAudit();
      }
    } catch {}
  }

  async function openMfaSetup() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/operator/mfa/setup', {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao inicializar MFA');
      }
      const data = await res.json();
      setMfaSetupData(data);
      setShowMfaModal(true);
    } catch (err: any) {
      setError(err.message || 'Falha ao obter chave MFA');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaSetupData) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/operator/mfa/enable', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ secret: mfaSetupData.secret, code: mfaActivationCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Código de ativação inválido');
      }
      setShowMfaModal(false);
      setMfaSetupData(null);
      setMfaActivationCode('');
      setSuccessMsg('Autenticação em Dois Fatores (MFA) ativada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadAudit();
    } catch (err: any) {
      setError(err.message || 'Erro ao ativar MFA');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurgeData() {
    if (!confirm('Executar limpeza de segurança? Todas as sessões e convites com mais de 7 dias serão permanentemente expurgados.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/operator/purge-expired?days=7', {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Limpeza concluída: ${data.deletedViewerSessions} sessões e ${data.deletedInvites} convites removidos.`);
        setTimeout(() => setSuccessMsg(''), 5000);
        void loadAudit();
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  // Se não autenticado, exibe tela de login
  if (!user) {
    return (
      <main className="container" style={{ maxWidth: 460 }}>
        <header style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="eyebrow">Acesso Restrito</span>
          <h1>Painel do Operador</h1>
          <p>Área autorizada para tecnologia e transmissão da ala.</p>
        </header>

        <section className="card">
          {error && <div className="alert alert-warning">{error}</div>}

          {!mfaRequired ? (
            <form onSubmit={handleLogin}>
              <label htmlFor="op-email">E-mail do Operador</label>
              <input
                id="op-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@ala.local"
                required
              />

              <label htmlFor="op-password">Senha (Argon2id)</label>
              <input
                id="op-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar no Painel'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfa}>
              <div className="alert alert-info">Digite o código de 6 dígitos do seu aplicativo autenticador (TOTP).</div>
              <label htmlFor="mfa-code">Código Autenticador (MFA)</label>
              <input
                id="mfa-code"
                type="text"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000000"
                required
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Validando...' : 'Confirmar Código MFA'}
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  // Dashboard do Operador Autenticado
  return (
    <main className="container">
      <div className="nav-bar">
        <div>
          <span className="eyebrow">Transmissão da Ala</span>
          <h1 style={{ fontSize: 24, margin: '2px 0' }}>Painel Operacional</h1>
          <p style={{ margin: 0 }}>
            Operador: <strong>{user.displayName}</strong> ({user.memberships[0]?.role})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={openMfaSetup} className="btn btn-secondary" style={{ fontSize: 13 }}>
            🔐 Configurar MFA
          </button>
          <button type="button" onClick={handleLogout} className="btn btn-secondary" style={{ fontSize: 13 }}>
            Sair do Painel
          </button>
        </div>
      </div>

      {error && <div className="alert alert-warning">{error}</div>}
      {successMsg && <div className="alert alert-info">{successMsg}</div>}

      {/* Monitoramento de Ingest SRT MediaMTX */}
      <section className="card" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>📡 Monitoramento de Sinal (MediaMTX / SRT)</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {health?.srtConnected ? (
            <span className="status-badge status-live" style={{ background: '#dcfce7', color: '#15803d' }}>
              <span className="dot" /> Sinal SRT Conectado (Encoder Ativo)
            </span>
          ) : (
            <span className="status-badge status-paused">
              <span className="dot" /> Aguardando Transmissão do OBS / Encoder
            </span>
          )}
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Porta UDP 8890 | {health?.readersCount ?? 0} espectadores conectados
          </span>
        </div>
      </section>

      {/* Seleção e Agendamento de Transmissão */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: '0 0 6px 0' }}>📅 Transmissões da Ala</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                style={{ width: 'auto', margin: 0, padding: '8px 12px' }}
                value={selectedBroadcast?.id ?? ''}
                onChange={(e) => {
                  const b = broadcasts.find((x) => x.id === e.target.value);
                  if (b) setSelectedBroadcast(b);
                }}
              >
                {broadcasts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.status}) - {new Date(b.scheduledAt).toLocaleDateString('pt-BR')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ padding: '8px 16px', fontSize: 14 }}
          >
            + Agendar Nova Transmissão
          </button>
        </div>

        {/* Detalhes e Ações da Transmissão Selecionada */}
        {selectedBroadcast && (
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 18, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{selectedBroadcast.title}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Canal: <code>{selectedBroadcast.streamPath}</code> | Data:{' '}
                  {new Date(selectedBroadcast.scheduledAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <span className={`status-badge status-${selectedBroadcast.status.toLowerCase()}`}>
                <span className="dot" /> {selectedBroadcast.status}
              </span>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, margin: '0 0 8px 0', color: '#475569' }}>Ações de Controle:</h4>
              <div className="btn-group">
                {['SCHEDULED', 'READY'].includes(selectedBroadcast.status) && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() =>
                      setConfirmModal({
                        action: 'start',
                        title: 'Iniciar Transmissão AO VIVO',
                        description: 'A transmissão será liberada para todos os espectadores autorizados.',
                      })
                    }
                  >
                    ▶ Iniciar Transmissão (AO VIVO)
                  </button>
                )}

                {selectedBroadcast.status === 'LIVE' && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() =>
                      setConfirmModal({
                        action: 'pause',
                        title: 'Pausar Transmissão para o Sacramento',
                        description:
                          'O sinal HLS será IMEDIATAMENTE bloqueado no servidor para todos os navegadores. Certifique-se de também desligar a origem no encoder.',
                      })
                    }
                  >
                    ⏸ Pausar para o Sacramento
                  </button>
                )}

                {selectedBroadcast.status === 'PAUSED' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setConfirmModal({
                        action: 'resume',
                        title: 'Retomar Transmissão Após Sacramento',
                        description: 'A administração da ordenança foi concluída e o sinal ao vivo será reaberto.',
                      })
                    }
                  >
                    ▶ Retomar Transmissão (Pós-Sacramento)
                  </button>
                )}

                {['SCHEDULED', 'READY', 'LIVE', 'PAUSED'].includes(selectedBroadcast.status) && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() =>
                      setConfirmModal({
                        action: 'end',
                        title: 'Encerrar Transmissão Definitivamente',
                        description: 'Esta ação é irreversível. Todas as sessões ativas serão imediatamente revogadas.',
                      })
                    }
                  >
                    ⏹ Finalizar Transmissão
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Gerenciador de Convites */}
      {selectedBroadcast && (
        <section className="card">
          <h2 style={{ fontSize: 18, marginTop: 0 }}>🎟️ Emissão e Gestão de Convites</h2>

          <form onSubmit={handleCreateInvite} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="max-uses">Limite de Usos</label>
              <select id="max-uses" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}>
                <option value={1}>1 dispositivo (Uso Único)</option>
                <option value={2}>2 dispositivos (Padrão)</option>
                <option value={5}>5 dispositivos</option>
              </select>
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="expires-hours">Validade</label>
              <select id="expires-hours" value={expiresInHours} onChange={(e) => setExpiresInHours(Number(e.target.value))}>
                <option value={2}>2 horas</option>
                <option value={4}>4 horas (Padrão)</option>
                <option value={8}>8 horas</option>
                <option value={24}>24 horas</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginBottom: 14 }} disabled={loading}>
              + Gerar Novo Convite
            </button>
          </form>

          {createdToken && (
            <div className="alert alert-info" style={{ marginTop: 14 }}>
              <strong>⚠️ CONVITE GERADO (EXIBIDO APENAS UMA VEZ):</strong>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                <input readOnly value={createdToken} style={{ fontFamily: 'monospace', fontWeight: 700, margin: 0 }} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdToken);
                    alert('Código copiado para a área de transferência!');
                  }}
                >
                  Copiar
                </button>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Criado Em</th>
                  <th>Usos</th>
                  <th>Expira Em</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td>{new Date(inv.createdAt).toLocaleTimeString('pt-BR')}</td>
                    <td>
                      {inv.uses} / {inv.maxUses}
                    </td>
                    <td>{new Date(inv.expiresAt).toLocaleTimeString('pt-BR')}</td>
                    <td>
                      {inv.revokedAt ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Revogado</span>
                      ) : new Date(inv.expiresAt) < new Date() ? (
                        <span style={{ color: '#64748b' }}>Expirado</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Ativo</span>
                      )}
                    </td>
                    <td>
                      {!inv.revokedAt && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => handleRevokeInvite(inv.id)}
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {invites.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>
                      Nenhum convite gerado para esta transmissão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Trilha de Auditoria e Limpeza */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>📋 Trilha de Auditoria Operacional</h2>
          {user.memberships[0]?.role === 'ADMIN' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePurgeData}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              🧹 Limpar Dados &gt; 7 dias (LGPD)
            </button>
          )}
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                <th>Ação</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.occurredAt).toLocaleString('pt-BR')}</td>
                  <td>
                    <code>{log.action}</code>
                  </td>
                  <td>{log.actor?.displayName ?? 'Sistema'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>
                    Nenhum registro de auditoria disponível.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Confirmação Dupla para Ações Críticas */}
      {confirmModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>{confirmModal.title}</h3>
            <p style={{ color: '#475569', fontSize: 14 }}>{confirmModal.description}</p>

            {confirmModal.action === 'start' && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '16px 0', fontSize: 13 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto', marginTop: 3 }}
                  checked={sacramentConfirmed}
                  onChange={(e) => setSacramentConfirmed(e.target.checked)}
                />
                Confirmo que verifiquei as regras institucionais e que a administração do sacramento NÃO será transmitida.
              </label>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setConfirmModal(null);
                  setSacramentConfirmed(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`btn btn-${confirmModal.action === 'end' ? 'danger' : 'primary'}`}
                disabled={confirmModal.action === 'start' && !sacramentConfirmed}
                onClick={() => executeTransition(confirmModal.action)}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamento de Nova Transmissão */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>📅 Agendar Nova Transmissão</h3>
            <form onSubmit={handleCreateBroadcast}>
              <label htmlFor="b-title">Título da Transmissão</label>
              <input
                id="b-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Conferência de Ala / Reunião Sacramental"
                required
              />

              <label htmlFor="b-date">Data e Horário</label>
              <input
                id="b-date"
                type="datetime-local"
                value={newScheduledAt}
                onChange={(e) => setNewScheduledAt(e.target.value)}
                required
              />

              <label htmlFor="b-path">Caminho SRT / StreamPath</label>
              <input
                id="b-path"
                value={newStreamPath}
                onChange={(e) => setNewStreamPath(e.target.value)}
                placeholder="ala01"
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Transmissão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configuração de MFA */}
      {showMfaModal && mfaSetupData && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>🔐 Configurar Autenticação em Dois Fatores</h3>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Adicione a chave abaixo ao seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy):
            </p>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, margin: '14px 0', border: '1px solid #cbd5e1' }}>
              <label style={{ fontSize: 12, color: '#64748b' }}>Chave Secreta Base32:</label>
              <code style={{ fontSize: 16, fontWeight: 700, wordBreak: 'break-all', display: 'block', color: '#0f172a' }}>
                {mfaSetupData.secret}
              </code>
            </div>

            <form onSubmit={handleEnableMfa}>
              <label htmlFor="mfa-verify-code">Digite o código de 6 dígitos gerado:</label>
              <input
                id="mfa-verify-code"
                maxLength={6}
                pattern="[0-9]*"
                value={mfaActivationCode}
                onChange={(e) => setMfaActivationCode(e.target.value)}
                placeholder="000000"
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMfaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Ativando...' : 'Ativar MFA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
