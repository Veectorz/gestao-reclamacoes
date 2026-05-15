// SUBSTITUA pelas suas credenciais do Supabase
const SUPABASE_URL = 'https://jfhzqnjxekxdwpaddgvp.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaHpxbmp4ZWt4ZHdwYWRkZ3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTY3NTYsImV4cCI6MjA5NDM5Mjc1Nn0.YYXKQucG2547oWWlGwJBzCbckvG6JM0B-WznE3X3fR4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('form-reclamacao');
const lista = document.getElementById('lista');
const tabs = document.querySelectorAll('.tab');
let statusAtual = 'nao_prioridade';

// Atualiza a lista a cada 30 segundos
setInterval(carregarPainel, 30000);
carregarPainel();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = {
    nome: document.getElementById('nome').value,
    telefone: document.getElementById('telefone').value,
    reclamacao: document.getElementById('reclamacao').value,
    modelo_moto: document.getElementById('modelo_moto').value,
    placa: document.getElementById('placa').value,
    loja: document.getElementById('loja').value,
    plataforma_denuncia: document.getElementById('plataforma').value,
    classificacao_inicial: document.getElementById('classificacao').value,
    status: document.getElementById('classificacao').value,
    data_abertura: new Date().toISOString(),
    data_ultima_mudanca: new Date().toISOString(),
    prazo_limite: calcularPrazo(document.getElementById('classificacao').value)
  };
  const { error } = await supabase.from('reclamacoes').insert([dados]);
  if (error) alert('Erro ao cadastrar: ' + error.message);
  else {
    form.reset();
    carregarPainel();
  }
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    statusAtual = tab.dataset.status;
    carregarPainel();
  });
});

async function carregarPainel() {
  const { data, error } = await supabase
    .from('reclamacoes')
    .select('*')
    .eq('status', statusAtual)
    .order('data_abertura', { ascending: false });
  if (error) return;
  renderLista(data);
  //carregarDashboard();
}

function renderLista(registros) {
  lista.innerHTML = registros.map(r => {
    const atrasado = r.status === 'urgente' && new Date(r.prazo_limite) < new Date();
    return `
    <div class="card ${r.status} ${atrasado ? 'atrasado' : ''}">
      <p><strong>${r.nome}</strong> - ${r.loja}</p>
      <p>${r.reclamacao.substring(0, 100)}...</p>
      <p>Prazo: ${formatarPrazo(r.prazo_limite, r.status)}</p>
      <div class="acoes">
        ${r.status !== 'solucionado' ? `<button onclick="marcarSolucionado('${r.id}')">Solucionar</button>` : ''}
        ${r.status !== 'solucionado' && r.status !== 'em_aguardo' && !r.foi_para_aguardo ?
          `<button onclick="moverParaAguardo('${r.id}')">Em Aguardo</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function calcularPrazo(classificacao) {
  const agora = new Date();
  switch (classificacao) {
    case 'nao_prioridade': agora.setHours(agora.getHours() + 36); break;
    case 'atencao': agora.setHours(agora.getHours() + 24); break;
    case 'urgente': agora.setHours(agora.getHours() + 12); break;
    default: return null;
  }
  return agora.toISOString();
}

function formatarPrazo(iso, status) {
  if (!iso) return '—';
  const dataLimite = new Date(iso);
  const agora = new Date();
  const diff = dataLimite - agora;
  const absDiff = Math.abs(diff);
  const horas = Math.floor(absDiff / 3600000);
  const minutos = Math.floor((absDiff % 3600000) / 60000);
  if (diff >= 0) {
    return `${horas}h ${minutos}min restantes`;
  } else {
    if (status === 'urgente') {
      return `<span class="atraso">ATRASADO em ${horas}h ${minutos}min</span>`;
    } else {
      return `Vencido (${horas}h ${minutos}min)`;
    }
  }
}

async function marcarSolucionado(id) {
  const { error } = await supabase
    .from('reclamacoes')
    .update({ status: 'solucionado', data_solucao: new Date().toISOString() })
    .eq('id', id);
  if (error) alert('Erro: ' + error.message);
  carregarPainel();
}

async function moverParaAguardo(id) {
  const prazo = new Date();
  prazo.setHours(prazo.getHours() + 24);
  const { error } = await supabase
    .from('reclamacoes')
    .update({
      status: 'em_aguardo',
      data_ultima_mudanca: new Date().toISOString(),
      prazo_limite: prazo.toISOString()
    })
    .eq('id', id);
  if (error) alert('Erro: ' + error.message);
  carregarPainel();
}


// Relatório
async function gerarRelatorio() {
  const inicio = document.getElementById('data-inicio').value;
  const fim = document.getElementById('data-fim').value;
  if (!inicio || !fim) return alert('Selecione as datas.');
  const { data, error } = await supabase
    .from('reclamacoes')
    .select('*')
    .gte('data_abertura', inicio + 'T00:00:00')
    .lte('data_abertura', fim + 'T23:59:59');
  if (error) { alert('Erro ao buscar dados'); return; }
  const container = document.getElementById('conteudo-relatorio');
  if (!data || data.length === 0) {
    container.innerHTML = '<p>Nenhuma reclamação no período.</p>';
    return;
  }
  const total = data.length;
  const resolvidos = data.filter(r => r.status === 'solucionado').length;
  const pendentes = total - resolvidos;
  const porLoja = {};
  data.forEach(r => porLoja[r.loja] = (porLoja[r.loja] || 0) + 1);
  const lojasOrdenadas = Object.entries(porLoja).sort((a,b) => b[1] - a[1]);
  const porClass = {};
  data.forEach(r => porClass[r.classificacao_inicial] = (porClass[r.classificacao_inicial] || 0) + 1);
  const resolvidosComSolucao = data.filter(r => r.data_solucao);
  let tempoMedio = 'N/A';
  if (resolvidosComSolucao.length > 0) {
    const somaHoras = resolvidosComSolucao.reduce((acc, r) => {
      return acc + (new Date(r.data_solucao) - new Date(r.data_abertura)) / 3600000;
    }, 0);
    tempoMedio = (somaHoras / resolvidosComSolucao.length).toFixed(1) + ' horas';
  }
  const problemas = {};
  data.forEach(r => {
    const chave = r.reclamacao.substring(0, 50).trim();
    problemas[chave] = (problemas[chave] || 0) + 1;
  });
  const topProblemas = Object.entries(problemas).sort((a,b) => b[1] - a[1]).slice(0, 5);

  container.innerHTML = `
    <div class="resumo">
      <p><strong>Período:</strong> ${inicio} a ${fim}</p>
      <p><strong>Total de reclamações:</strong> ${total}</p>
      <p><strong>Resolvidos:</strong> ${resolvidos} (${((resolvidos/total)*100).toFixed(1)}%)</p>
      <p><strong>Pendentes:</strong> ${pendentes}</p>
      <p><strong>Tempo médio de solução:</strong> ${tempoMedio}</p>
    </div>
    <h3>Reclamações por Loja</h3>
    <table>
      <tr><th>Loja</th><th>Quantidade</th></tr>
      ${lojasOrdenadas.map(([loja, qtd]) => `<tr><td>${loja}</td><td>${qtd}</td></tr>`).join('')}
    </table>
    <h3>Por Classificação Inicial</h3>
    <table>
      ${Object.entries(porClass).map(([cl, qtd]) => `<tr><td>${cl}</td><td>${qtd}</td></tr>`).join('')}
    </table>
    <h3>Problemas Mais Frequentes</h3>
    <ol>${topProblemas.map(([prob, qtd]) => `<li>${prob}... (${qtd})</li>`).join('')}</ol>
  `;
}

window.addEventListener('load', () => {
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 86400000);
  document.getElementById('data-fim').valueAsDate = hoje;
  document.getElementById('data-inicio').valueAsDate = seteDiasAtras;
  gerarRelatorio();
});