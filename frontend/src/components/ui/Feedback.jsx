import React from 'react';

/** Estados visuais compartilhados: carregamento e mensagens de erro/vazio. */

export function SkeletonPage() {
  return (
    <main className="container skeleton-container" aria-label="Carregando conteúdo">
      <section className="skeleton-hero">
        <div className="skeleton-line short" />
        <div className="skeleton-line title" />
        <div className="skeleton-line" />
        <div className="skeleton-line medium" />
      </section>
      <section className="skeleton-grid">
        {Array.from({ length: 6 }).map((_, index) => <div className="skeleton-card" key={index} />)}
      </section>
    </main>
  );
}

export function StateMessage({ title, text, danger = false }) {
  return (
    <main className="container">
      <section className={`state-card ${danger ? 'danger' : ''}`}>
        <h1>{title}</h1>
        <p>{text}</p>
      </section>
    </main>
  );
}
