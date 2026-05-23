const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yraiexdgtovfyfqrqryn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyYWlleGRndG92ZnlmcXJxcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg2MTE5NywiZXhwIjoyMDk0NDM3MTk3fQ.77XD8ue1Waee56vPZgzgC0q-qS7JUNmHTJE_cVhYYy4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- TESTING INSERT THAT DISPARAGES CAST ERROR ---');
  
  // Let's insert a response for an existing question of Paulo Fernandes (e.g. fundações profundas, question 2)
  // Let's get the question 2 of fundações profundas (ID of phase: f3cfd826-cbe7-4b64-99db-b7129cbfcf5d)
  const phaseId = 'f3cfd826-cbe7-4b64-99db-b7129cbfcf5d';
  const { data: questions } = await supabase.from('perguntas').select('id, texto_pergunta, ordem').eq('fase_id', phaseId).order('ordem');
  
  console.log('Questions for Fundações Profundas:', questions);
  
  const q2 = questions.find(q => q.ordem === 2);
  if (!q2) {
    console.error('Could not find question 2!');
    return;
  }
  
  // Insert response for Q2
  console.log(`Inserting response 'SIM' for question 2: ${q2.texto_pergunta} (${q2.id})...`);
  const { data, error } = await supabase.from('respostas').insert({
    obra_id: 'b822e2ac-de44-4c99-b035-318b25f19277',
    fase_id: phaseId,
    pergunta_id: q2.id,
    resposta: 'SIM'
  });
  
  if (error) {
    console.error('Insertion failed with error:', error.message);
    console.error('Error object:', error);
  } else {
    console.log('Insertion succeeded! Data:', data);
  }
}

main();
