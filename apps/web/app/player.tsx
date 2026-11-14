'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

type Current = { id?: string; title?: string; status: string; scheduledAt?: string };
export default function Player() {
  const [token, setToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState('NONE');
  const [message, setMessage] = useState('Informe o convite privado.');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const res = await fetch('/api/v1/broadcasts/current', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as Current;
        if (active) setStatus(data.status);
      } catch { /* status anterior e mensagem de rede no player */ }
    }
    void refresh();
    void fetch('/api/v1/viewer/session', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : { authorized: false })
      .then(data => { if (active && data.authorized) { setAuthorized(true); setMessage('Acesso reconhecido.'); } })
      .catch(() => {});
    const id = setInterval(() => void refresh(), 15_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (status !== 'LIVE' && videoRef.current) {
      videoRef.current.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
      setPlaying(false);
    }
  }, [status]);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setMessage('Validando convite...');
    try {
      const response = await fetch('/api/v1/viewer/redeem', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('Convite inválido, expirado ou indisponível.');
      setAuthorized(true);
      setToken('');
      setMessage('Convite validado. Aguarde o início da transmissão.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao validar convite.');
    }
  }

  function startPlayback() {
    const video = videoRef.current;
    if (!video || status !== 'LIVE') return;
    const src = '/hls/ala01/index.m3u8';
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      setMessage('Este navegador não suporta HLS.');
      return;
    }
    void video.play().then(() => {
      setPlaying(true);
      setMessage('Reproduzindo transmissão ao vivo.');
    }).catch(() => setMessage('Toque em reproduzir no player para iniciar.'));
    // O efeito de status interrompe e limpa o stream quando não estiver LIVE.
  }

  return <section className="card">
    <div className="status"><span className="dot" />Estado: <strong>{status === 'LIVE' ? 'AO VIVO' : status === 'PAUSED' ? 'INTERROMPIDA' : status === 'NONE' ? 'NÃO AGENDADA' : 'AGUARDANDO'}</strong></div>
    {!authorized && <form onSubmit={redeem}>
      <label htmlFor="token">Código de convite</label>
      <input id="token" value={token} onChange={e => setToken(e.target.value)} autoComplete="off" placeholder="Cole o código recebido" required />
      <button type="submit">Validar convite</button>
    </form>}
    <video ref={videoRef} controls playsInline preload="none" />
    {authorized && status === 'LIVE' && !playing && <button type="button" onClick={startPlayback}>Assistir à transmissão</button>}
    <p role="status">{message}</p>
    <p className="help">Durante a administração do sacramento, a transmissão deve permanecer desligada.</p>
  </section>;
}
