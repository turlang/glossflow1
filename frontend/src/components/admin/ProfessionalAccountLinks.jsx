import React, { useEffect, useState } from 'react';
import { request } from '../../services/api.js';

export function ProfessionalAccountLinks({ professionals, users }) {
  const [links, setLinks] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { request('/admin/professionals/user-links').then(setLinks).catch(error => setMessage(error.message)); }, []);
  async function link(id, userId) {
    setBusy(true); setMessage('');
    try {
      await request(`/admin/professionals/${id}/user-link`, { method: 'PUT', body: JSON.stringify({ userId: userId || null }) });
      setLinks(await request('/admin/professionals/user-links'));
      setMessage('Vínculo atualizado. A conta acessará somente a agenda deste profissional.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="panel-card"><h2>Contas da equipe</h2><p>Vincule cada conta de acesso ao profissional correspondente.</p>
    {professionals.map(p => <label className="form-field" key={p.id}>{p.name}<select disabled={busy} value={links.find(l => l.id === p.id)?.userId || ''} onChange={e => link(p.id, e.target.value)}>
      <option value="">Sem conta vinculada</option>{users.filter(u => u.role === 'PROFESSIONAL' && u.active).map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
    </select></label>)}<p role="status">{message}</p></section>;
}
