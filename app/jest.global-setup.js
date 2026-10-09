// Fuso fixo nos testes: rótulos de hora/dia dependem do fuso do processo, e o projeto
// trabalha em America/Sao_Paulo (mesmo fuso do backend, app.timezone).
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
