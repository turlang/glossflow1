// Local data only. This server never connects to MongoDB or an external provider.
const http = require('node:http');
const { URL } = require('node:url');
const console = require('node:console');
const service = {
  id: '507f1f77bcf86cd799439012',
  name: 'Corte e escova',
  price: 100,
  durationMin: 60,
  active: true
};
const professional = { id: '507f1f77bcf86cd799439013', name: 'Ana', specialty: 'Cabelo', active: true };
const salon = {
  id: '507f1f77bcf86cd799439011',
  slug: 'ci-fixture',
  name: 'GlossFlow — dados fictícios',
  description: 'Ambiente de validação do agendamento',
  heroTitle: 'Seu horário, com simplicidade',
  heroImage: '',
  openingHours: '09h às 19h',
  address: 'Ambiente local',
  whatsapp: '5500000000000',
  modulesConfigured: true,
  enabledModules: ['AGENDA', 'SITE']
};
http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, 'http://localhost');
    let data;
    if (url.pathname === '/public/salon') data = salon;
    else if (url.pathname === '/services') data = [service];
    else if (url.pathname === '/professionals') data = [professional];
    else if (url.pathname === '/portfolio') data = [];
    else if (url.pathname === '/commercial/plans') data = { plans: [] };
    else if (url.pathname === '/appointments/availability') {
      const month = url.searchParams.get('month');
      if (month) {
        const [year, number] = month.split('-').map(Number);
        data = {
          days: Array.from({ length: new Date(year, number, 0).getDate() }, (_, index) => ({
            date: `${month}-${String(index + 1).padStart(2, '0')}`,
            totalCapacity: 2,
            professionals: [
              { professionalId: professional.id, professionalName: professional.name, capacity: 2 }
            ]
          }))
        };
      } else {
        const date = url.searchParams.get('date');
        data = {
          professionals: [
            { ...professional, slots: [{ label: '09:00', startTime: `${date}T12:00:00.000Z` }] }
          ]
        };
      }
    } else {
      res.writeHead(404);
      data = { message: 'Rota não definida na fixture pública' };
    }
    res.end(JSON.stringify(data));
  })
  .listen(3333, '127.0.0.1', () => console.log('Fixture pública disponível em 127.0.0.1:3333'));
