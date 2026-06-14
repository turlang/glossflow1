import React, { useState } from 'react';

/**
 * Componentes reutilizáveis do GlossFlow.
 * Padronizam formulários, listas e ações para reduzir duplicação e manter consistência visual.
 */

export function SectionTitle({ label, title, text }) {
  return (
    <div className="section-title">
      <span>{label}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function AdminCrud({ title, children, onSubmit, submitLabel = 'Salvar' }) {
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    setMessage('');
    try { await onSubmit(); setMessage('Registro salvo com sucesso.'); }
    catch (err) { setMessage(err.message); }
  }
  return <form className="panel-card form-grid" onSubmit={submit}><h2>{title}</h2>{children}<button className="primary full" type="submit">{submitLabel}</button>{message && <p className="feedback">{message}</p>}</form>;
}

export function List({ items, render, onDelete }) {
  return (
    <div className="list full-span">
      {items.map((item) => <div className="list-row" key={item.id}><span>{render(item)}</span><button type="button" className="danger-button" onClick={() => onDelete(item.id)}>Excluir</button></div>)}
    </div>
  );
}

export function EditableList({ items, render, thumbnail, onEdit, onDelete }) {
  return (
    <div className="list full-span editable-list">
      {items.map((item) => (
        <div className="list-row editable-row" key={item.id}>
          {thumbnail?.(item) && <img className="list-thumb" src={thumbnail(item)} alt="Prévia" />}
          <span>{render(item)}</span>
          <div className="row-actions">
            <button type="button" className="edit-button" onClick={() => onEdit(item)}>Editar</button>
            <button type="button" className="danger-button" onClick={() => onDelete(item.id)}>Excluir</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImageInput({ label, value, onChange, required = false }) {
  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <label className="field image-field full-span">
      <span>{label}</span>
      <div className="image-input-grid">
        <input type="url" value={value?.startsWith('data:') ? '' : value} placeholder="Cole uma URL de imagem ou envie um arquivo" required={required && !value} onChange={(e) => onChange(e.target.value)} />
        <input type="file" accept="image/*" onChange={handleFile} />
      </div>
      {value && <img className="image-preview" src={value} alt="Pré-visualização" />}
      <small>Para apresentação local, o arquivo é convertido em base64. Em produção, o ideal é usar Cloudinary, S3 ou storage equivalente.</small>
    </label>
  );
}

export function Input({ label, value, onChange, type = 'text', required = false }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} /></label>;
}

export function Textarea({ label, value, onChange, required = false }) {
  return <label className="field full-span"><span>{label}</span><textarea value={value} required={required} onChange={(e) => onChange(e.target.value)} /></label>;
}

export function Select({ label, value, onChange, options, required = false }) {
  return <label className="field"><span>{label}</span><select value={value} required={required} onChange={(e) => onChange(e.target.value)}><option value="">Selecione</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
