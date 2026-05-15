const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    const agora = new Date().toISOString();
    const { data: vencidos, error } = await supabase
      .from('reclamacoes')
      .select('*')
      .neq('status', 'solucionado')
      .lt('prazo_limite', agora);

    if (error) throw error;

    for (const r of vencidos) {
      let novoStatus, novoPrazo;
      const agoraDate = new Date();
      switch (r.status) {
        case 'nao_prioridade':
          novoStatus = 'atencao';
          agoraDate.setHours(agoraDate.getHours() + 24);
          novoPrazo = agoraDate.toISOString();
          break;
        case 'atencao':
          novoStatus = 'urgente';
          agoraDate.setHours(agoraDate.getHours() + 12);
          novoPrazo = agoraDate.toISOString();
          break;
        case 'urgente':
          await supabase.from('reclamacoes').update({ data_ultima_mudanca: agora }).eq('id', r.id);
          continue;
        case 'em_aguardo':
          novoStatus = 'urgente';
          agoraDate.setHours(agoraDate.getHours() + 12);
          novoPrazo = agoraDate.toISOString();
          await supabase.from('reclamacoes').update({
            status: novoStatus,
            data_ultima_mudanca: agora,
            prazo_limite: novoPrazo,
            foi_para_aguardo: true
          }).eq('id', r.id);
          continue;
        default:
          continue;
      }
      await supabase.from('reclamacoes').update({
        status: novoStatus,
        data_ultima_mudanca: agora,
        prazo_limite: novoPrazo
      }).eq('id', r.id);
    }
    return { statusCode: 200, body: 'Atualização concluída' };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};