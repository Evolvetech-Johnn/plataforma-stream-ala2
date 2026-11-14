'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

type CurrentBroadcast = {
  id?: string;
  title?: string;
  status: string;
  scheduledAt?: string;
};

export default function Player() {
  const [token, setToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [broadcast, setBroadcast] = useState<CurrentBroadcast>({ status: 'NONE' });
  const [message, setMessage] = useState('Insira o código de convite privado para acessar.');
  const [loading, setLoading] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  async function checkSession() {
    try {
      const res = await fetch('/api/v1/viewer/session', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authorized) {
          setAuthorized(true);
          setMessage('Sessão ativa e autorizada.');
        } else {
          setAuthorized(false);
        }
      }
    } catch {
      // offline / sem rede
    }
  }

  async function refreshBroadcast() {
    try {
      const res = await fetch('/api/v1/broadcasts/current', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as CurrentBroadcast;
      setBroadcast(data);
    } catch {
      // mantém status anterior
    }
  }

  useEffect(() => {
    let active = true;
    void refreshBroadcast();
    void checkSession();

    const interval = setInterval(() => {
      if (active) void refreshBroadcast();
    }, 10_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Interrompe imediatamente e limpa o buffer do vídeo quando não estiver LIVE
  useEffect(() => {
    if (broadcast.status !== 'LIVE') {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setPlaying(false);
      setBuffering(false);
    }
  }, [broadcast.status]);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('Validando convite...');
    try {
      const response = await fetch('/api/v1/viewer/redeem', {
        method: 'POST',
        credentials: 'same-origin',
        headers: authHeaders,
        body: JSON.stringify({ token: token.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Convite inválido, esgotado ou expirado.');
      }

      setAuthorized(true);
      setToken('');
      setMessage('Convite aceito com sucesso. Transmissão vinculada à sua sessão.');
      void refreshBroadcast();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha na validação do convite.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch('/api/v1/viewer/logout', { method: 'POST', headers: authHeaders });
    } catch {
      // ignora
    }
    setAuthorized(false);
    setPlaying(false);
    setBuffering(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setMessage('Sessão encerrada com sucesso.');
  }

  function startPlayback() {
    const video = videoRef.current;
    if (!video || broadcast.status !== 'LIVE') return;
    const src = '/hls/ala01/index.m3u8';

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Configura eventos nativos de buffer e stalls
    video.onwaiting = () => {
      setBuffering(true);
      setMessage('Ajustando buffer de vídeo...');
    };
    video.onplaying = () => {
      setBuffering(false);
      setPlaying(true);
      setMessage('Reproduzindo áudio e vídeo ao vivo.');
    };
    video.onstalled = () => {
      setBuffering(true);
      setMessage('Conexão instável. Aguardando novos fragmentos...');
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          setBuffering(true);
          setMessage('Conexão oscilando. Reconectando buffer...');
        } else if (data.fatal) {
          setBuffering(true);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setMessage('Tentando restabelecer conexão com o servidor...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setMessage('Recuperando decodificação de mídia...');
              hls.recoverMediaError();
              break;
            default:
              setMessage('Erro na reprodução. Tentando reiniciar player...');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      setMessage('Seu navegador não possui suporte à reprodução HLS.');
      return;
    }

    video
      .play()
      .then(() => {
        setPlaying(true);
        setMessage('Reproduzindo áudio e vídeo ao vivo.');
      })
      .catch(() => {
        setMessage('Pressione o botão Play no player de vídeo para iniciar com som.');
      });
  }

  const getStatusBadge = () => {
    switch (broadcast.status) {
      case 'LIVE':
        return <span className="status-badge status-live"><span className="dot" /> AO VIVO</span>;
      case 'PAUSED':
        return <span className="status-badge status-paused"><span className="dot" /> TRANSMISSÃO INTERROMPIDA (SACRAMENTO)</span>;
      case 'SCHEDULED':
      case 'READY':
        return <span className="status-badge status-scheduled"><span className="dot" /> AGENDADA</span>;
      case 'ENDED':
        return <span className="status-badge status-ended"><span className="dot" /> TRANSMISSÃO ENCERRADA</span>;
      default:
        return <span className="status-badge status-ended"><span className="dot" /> NENHUMA TRANSMISSÃO ATIVA</span>;
    }
  };

  return (
    <section className="card" aria-label="Portal de visualização privada">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>{getStatusBadge()}</div>
        {authorized && (
          <button type="button" onClick={logout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>
            Sair do Acesso
          </button>
        )}
      </div>

      {broadcast.title && (
        <h2 style={{ fontSize: 20, margin: '0 0 16px 0', color: '#1e293b' }}>
          {broadcast.title}
        </h2>
      )}

      {!authorized && (
        <form onSubmit={redeem} style={{ margin: '18px 0' }}>
          <label htmlFor="token">Código de Convite Privado</label>
          <input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            placeholder="Cole aqui o código fornecido pelo líder"
            required
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Validando...' : 'Acessar Transmissão'}
          </button>
        </form>
      )}

      <div style={{ position: 'relative' }}>
        <video
          ref={videoRef}
          controls
          playsInline
          preload="none"
          aria-label="Transmissão ao vivo da reunião"
        />
        {buffering && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(15, 23, 42, 0.85)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            ⏳ Conexão lenta / Ajustando sinal...
          </div>
        )}
      </div>

      {authorized && broadcast.status === 'LIVE' && !playing && (
        <div style={{ textAlign: 'center', margin: '14px 0' }}>
          <button type="button" onClick={startPlayback} className="btn btn-success" style={{ fontSize: 17, padding: '14px 28px' }}>
            ▶ Iniciar Reprodução
          </button>
        </div>
      )}

      {broadcast.status === 'PAUSED' && (
        <div className="alert alert-warning" role="alert">
          <strong>Atenção:</strong> A transmissão está temporariamente desligada em reverência à administração do sacramento. A transmissão retornará automaticamente quando a ordenança for concluída.
        </div>
      )}

      <div className="alert alert-info" role="status">
        {message}
      </div>

      <p className="help" style={{ marginTop: 24, fontSize: 13, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
        🔒 Transmissão privada e confidencial, autorizada estritamente para membros da ala impossibilitados de comparecer presencialmente.
        Não é permitido gravar, retransmitir ou compartilhar convites.
      </p>
    </section>
  );
}
