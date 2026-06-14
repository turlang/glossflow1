# Hotfix — Menu recolhível e Implantação Guiada

## Correções realizadas

### 1. Botão de recolher menu
O botão de recolher/expandir menu lateral agora altera visualmente o layout do painel.

Quando recolhido:
- a sidebar fica estreita;
- os textos dos módulos são ocultados;
- os ícones permanecem visíveis;
- cada item mantém `title` com o nome do módulo para acessibilidade;
- o botão passa a exibir apenas o ícone de expandir.

Arquivos alterados:

```txt
frontend/src/components/admin/AdminDashboard.jsx
frontend/src/styles.css
```

---

### 2. Banner de Implantação Guiada
O bloco “Seu salão pronto para vender mais” não aparece mais em todas as telas.

Agora ele aparece somente no módulo específico:

```txt
Implantação Guiada
```

Também foi adicionado o item correspondente ao menu lateral.

## Validação

O build do frontend foi executado com sucesso:

```txt
cd frontend
npm run build
```
