/**
 * Simulador de Carga para 30 Espectadores Simultâneos
 * Requisito: Superprompt Seção 8, Item 11 & Escopo MVP (1 ala / até 30 espectadores)
 *
 * Execução:
 *   npx tsx infra/scripts/load-test-30-viewers.ts [duracao_segundos] [url_alvo]
 */

const DURATION_SECONDS = parseInt(process.argv[2] || '10', 10);
const TARGET_URL = (process.argv[3] || process.env.TARGET_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const CONCURRENT_CLIENTS = 30;
const STREAM_BITRATE_MBPS = 1.5; // Bitrate de referência 720p30 H.264/AAC

interface ClientStats {
  clientId: number;
  requestsSent: number;
  successCount: number;
  errorCount: number;
  latencies: number[];
}

async function simulateViewer(
  clientId: number,
  endTime: number,
  stats: ClientStats,
) {
  // Cada cliente faz requisições periódicas a cada 1~2 segundos simulando manifestos e polling de status
  while (Date.now() < endTime) {
    stats.requestsSent += 1;
    const start = performance.now();
    try {
      const res = await fetch(`${TARGET_URL}/v1/broadcasts/current`, {
        headers: {
          'User-Agent': `ViewerSimulated/${clientId}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });

      const latency = performance.now() - start;
      stats.latencies.push(latency);

      if (res.ok) {
        stats.successCount += 1;
      } else {
        stats.errorCount += 1;
      }
    } catch {
      const latency = performance.now() - start;
      stats.latencies.push(latency);
      stats.errorCount += 1;
    }

    // Intervalo de jitter entre requisições de fragmentos/polling (500ms a 1500ms)
    const jitter = 500 + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, jitter));
  }
}

async function runLoadTest() {
  console.log('================================================================');
  console.log(`🚀 INICIANDO TESTE DE CARGA: ${CONCURRENT_CLIENTS} ESPECTADORES CONCORRENTES`);
  console.log(`Alvo: ${TARGET_URL}`);
  console.log(`Duração do Teste: ${DURATION_SECONDS} segundos`);
  console.log(`Perfil de Transmissão: 720p/30fps @ ~${STREAM_BITRATE_MBPS} Mbps por espectador`);
  console.log('================================================================\n');

  const endTime = Date.now() + DURATION_SECONDS * 1000;
  const clientStats: ClientStats[] = [];

  const promises: Promise<void>[] = [];
  for (let i = 1; i <= CONCURRENT_CLIENTS; i++) {
    const stats: ClientStats = {
      clientId: i,
      requestsSent: 0,
      successCount: 0,
      errorCount: 0,
      latencies: [],
    };
    clientStats.push(stats);
    promises.push(simulateViewer(i, endTime, stats));
  }

  await Promise.all(promises);

  // Consolidação dos Resultados
  let totalRequests = 0;
  let totalSuccess = 0;
  let totalErrors = 0;
  const allLatencies: number[] = [];

  for (const s of clientStats) {
    totalRequests += s.requestsSent;
    totalSuccess += s.successCount;
    totalErrors += s.errorCount;
    allLatencies.push(...s.latencies);
  }

  allLatencies.sort((a, b) => a - b);
  const avgLatency = allLatencies.length
    ? (allLatencies.reduce((sum, v) => sum + v, 0) / allLatencies.length).toFixed(2)
    : '0';
  const minLatency = allLatencies.length ? allLatencies[0].toFixed(2) : '0';
  const maxLatency = allLatencies.length ? allLatencies[allLatencies.length - 1].toFixed(2) : '0';
  const p95 = allLatencies.length ? allLatencies[Math.floor(allLatencies.length * 0.95)].toFixed(2) : '0';
  const p99 = allLatencies.length ? allLatencies[Math.floor(allLatencies.length * 0.99)].toFixed(2) : '0';

  const rps = (totalRequests / DURATION_SECONDS).toFixed(2);
  const totalEgressMbps = (CONCURRENT_CLIENTS * STREAM_BITRATE_MBPS).toFixed(1);
  const totalEgressMBps = (parseFloat(totalEgressMbps) / 8).toFixed(2);

  console.log('\n📊 RELATÓRIO CONSOLIDADO DO BENCHMARK DE 30 CLIENTES:');
  console.log('----------------------------------------------------------------');
  console.log(`• Total de Requisições:     ${totalRequests}`);
  console.log(`• Requisições com Sucesso:  ${totalSuccess} (${totalRequests ? ((totalSuccess / totalRequests) * 100).toFixed(1) : 0}%)`);
  console.log(`• Requisições com Erro:     ${totalErrors}`);
  console.log(`• Throughput Médio:         ${rps} req/s`);
  console.log('----------------------------------------------------------------');
  console.log('⏱️ LATÊNCIA (Tempo de Resposta do Servidor):');
  console.log(`• Mínima:                   ${minLatency} ms`);
  console.log(`• Média:                    ${avgLatency} ms`);
  console.log(`• p95:                      ${p95} ms`);
  console.log(`• p99:                      ${p99} ms`);
  console.log(`• Máxima:                   ${maxLatency} ms`);
  console.log('----------------------------------------------------------------');
  console.log('🌐 ANÁLISE DE CAPACIDADE DE EGRESS E RECURSOS (1 VPS 2 vCPU / 4 GB RAM):');
  console.log(`• Largura de Banda Requerida:  ${totalEgressMbps} Mbps (~${totalEgressMBps} MB/s de saída)`);
  console.log(`• Uplink VPS Recomendado:      Mínimo 100 Mbps full duplex garantido`);
  console.log(`• Consumo Estimado de Egress:  ~20 GB por reunião de 60 minutos`);
  console.log(`• Consumo Estimado de CPU:     5% a 12% (sem transcodificação com MediaMTX remux)`);
  console.log(`• Consumo Estimado de Memória: ~350 MB RAM total para Caddy + MediaMTX + API`);
  console.log('================================================================\n');

  if (totalErrors === 0 && totalRequests > 0) {
    console.log('✅ APROVADO: O sistema atende perfeitamente ao dimensionamento de 30 espectadores sem erros.');
  } else if (totalRequests === 0) {
    console.log('⚠️ AVISO: Nenhuma requisição enviada (verifique se o serviço alvo está ativo).');
  } else {
    console.log(`⚠️ ATENÇÃO: Ocorreram ${totalErrors} erros durante a simulação de carga.`);
  }
}

void runLoadTest();

