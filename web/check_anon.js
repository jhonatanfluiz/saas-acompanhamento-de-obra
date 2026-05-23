const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yraiexdgtovfyfqrqryn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyYWlleGRndG92ZnlmcXJxcnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjExOTcsImV4cCI6MjA5NDQzNzE5N30.GE6rtfZdGgqSEYPadWgB-nCej7zDHiEqPiPSS_s1tdU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- SIMULATING ANON CLIENT ---');

  // Query obras
  const { data: obras, error: oErr } = await supabase.from('obras').select('*');
  console.log('Obras select:', { count: obras ? obras.length : null, error: oErr ? oErr.message : null });

  // Query fases
  const { data: fases, error: fErr } = await supabase.from('fases').select('*');
  console.log('Fases select:', { count: fases ? fases.length : null, error: fErr ? fErr.message : null });

  // Query respostas
  const { data: respostas, error: rErr } = await supabase.from('respostas').select('*');
  console.log('Respostas select:', { count: respostas ? respostas.length : null, error: rErr ? rErr.message : null });
}

main();
