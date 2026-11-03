const API_BASE = '/api';

const fornecedorForm = document.getElementById('fornecedorForm');
const usuarioForm = document.getElementById('usuarioForm');
const fornecedorTableBody = document.getElementById('fornecedorTableBody');
const usuarioTableBody = document.getElementById('usuarioTableBody');
const totalFornecedores = document.getElementById('totalFornecedores');
const totalUsuarios = document.getElementById('totalUsuarios');
const totalAtivos = document.getElementById('totalAtivos');
const totalInativos = document.getElementById('totalInativos');

let fornecedorEditId = null;
let usuarioEditId = null;

function getFormValues(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function normalizeBoolean(value) {
  return value === 'on' || value === true || value === 'true';
}

function setStatusCounter() {
  const fornecedores = Array.from(fornecedorTableBody.querySelectorAll('tr')).length;
  const usuarios = Array.from(usuarioTableBody.querySelectorAll('tr')).length;

  const ativos = document.querySelectorAll('.status-badge.active').length;
  const inativos = document.querySelectorAll('.status-badge.inactive').length;

  totalFornecedores.textContent = fornecedores;
  totalUsuarios.textContent = usuarios;
  totalAtivos.textContent = ativos;
  totalInativos.textContent = inativos;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Erro na requisição');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function renderFornecedorRow(item) {
  return `
    <tr data-id="${item.id}">
      <td>${item.id}</td>
      <td>${item.razaoSocial}</td>
      <td>${item.cnpj}</td>
      <td>${item.email || '-'}</td>
      <td>
        <span class="status-badge ${item.ativo ? 'active' : 'inactive'}">
          ${item.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button type="button" class="edit" data-action="edit-fornecedor" data-id="${item.id}">Editar</button>
          <button type="button" class="delete" data-action="delete-fornecedor" data-id="${item.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

function renderUsuarioRow(item) {
  return `
    <tr data-id="${item.id}">
      <td>${item.id}</td>
      <td>${item.nome}</td>
      <td>${item.cargo}</td>
      <td>${item.email}</td>
      <td>
        <span class="status-badge ${item.ativo ? 'active' : 'inactive'}">
          ${item.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="table-actions">
          <button type="button" class="edit" data-action="edit-usuario" data-id="${item.id}">Editar</button>
          <button type="button" class="delete" data-action="delete-usuario" data-id="${item.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

async function loadFornecedores() {
  try {
    const data = await fetchJson(`${API_BASE}/fornecedores`);
    fornecedorTableBody.innerHTML = data.map(renderFornecedorRow).join('');
    setStatusCounter();
  } catch (error) {
    fornecedorTableBody.innerHTML = `<tr><td colspan="6">Erro ao carregar fornecedores.</td></tr>`;
    console.error(error);
  }
}

async function loadUsuarios() {
  try {
    const data = await fetchJson(`${API_BASE}/usuarios`);
    usuarioTableBody.innerHTML = data.map(renderUsuarioRow).join('');
    setStatusCounter();
  } catch (error) {
    usuarioTableBody.innerHTML = `<tr><td colspan="6">Erro ao carregar usuários.</td></tr>`;
    console.error(error);
  }
}

async function loadInitialData() {
  await Promise.all([loadFornecedores(), loadUsuarios()]);
}

fornecedorForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = getFormValues(fornecedorForm);
  const payload = {
    razaoSocial: formData.razaoSocial,
    nomeFantasia: formData.nomeFantasia || null,
    cnpj: formData.cnpj,
    telefone: formData.telefone || null,
    email: formData.email || null,
    endereco: formData.endereco || null,
    ativo: normalizeBoolean(formData.ativo)
  };

  try {
    if (fornecedorEditId) {
      await fetchJson(`${API_BASE}/fornecedores/${fornecedorEditId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson(`${API_BASE}/fornecedores`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    fornecedorForm.reset();
    fornecedorEditId = null;
    fornecedorForm.querySelector('button[type="submit"]').textContent = 'Salvar fornecedor';
    await loadFornecedores();
  } catch (error) {
    alert(error.message);
  }
});

usuarioForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = getFormValues(usuarioForm);
  const payload = {
    nome: formData.nome,
    email: formData.email,
    cargo: formData.cargo,
    ativo: normalizeBoolean(formData.ativo)
  };

  try {
    if (usuarioEditId) {
      await fetchJson(`${API_BASE}/usuarios/${usuarioEditId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await fetchJson(`${API_BASE}/usuarios`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    usuarioForm.reset();
    usuarioEditId = null;
    usuarioForm.querySelector('button[type="submit"]').textContent = 'Salvar usuário';
    await loadUsuarios();
  } catch (error) {
    alert(error.message);
  }
});

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);

  if (action === 'delete-fornecedor') {
    try {
      await fetchJson(`${API_BASE}/fornecedores/${id}`, { method: 'DELETE' });
      await loadFornecedores();
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  if (action === 'delete-usuario') {
    try {
      await fetchJson(`${API_BASE}/usuarios/${id}`, { method: 'DELETE' });
      await loadUsuarios();
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  if (action === 'edit-fornecedor') {
    try {
      const fornecedor = await fetchJson(`${API_BASE}/fornecedores/${id}`);
      fornecedorEditId = fornecedor.id;

      Object.entries({
        razaoSocial: fornecedor.razaoSocial,
        nomeFantasia: fornecedor.nomeFantasia || '',
        cnpj: fornecedor.cnpj,
        telefone: fornecedor.telefone || '',
        email: fornecedor.email || '',
        endereco: fornecedor.endereco || '',
        ativo: fornecedor.ativo
      }).forEach(([key, value]) => {
        const field = fornecedorForm.elements.namedItem(key);
        if (field) {
          field.value = value;
        }
      });

      fornecedorForm.querySelector('button[type="submit"]').textContent = 'Atualizar fornecedor';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      alert(error.message);
    }
    return;
  }

  if (action === 'edit-usuario') {
    try {
      const usuario = await fetchJson(`${API_BASE}/usuarios/${id}`);
      usuarioEditId = usuario.id;

      Object.entries({
        nome: usuario.nome,
        cargo: usuario.cargo,
        email: usuario.email,
        ativo: usuario.ativo
      }).forEach(([key, value]) => {
        const field = usuarioForm.elements.namedItem(key);
        if (field) {
          field.value = value;
        }
      });

      usuarioForm.querySelector('button[type="submit"]').textContent = 'Atualizar usuário';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      alert(error.message);
    }
  }
});

document.getElementById('cancelFornecedorEdit').addEventListener('click', () => {
  fornecedorForm.reset();
  fornecedorEditId = null;
  fornecedorForm.querySelector('button[type="submit"]').textContent = 'Salvar fornecedor';
});

document.getElementById('cancelUsuarioEdit').addEventListener('click', () => {
  usuarioForm.reset();
  usuarioEditId = null;
  usuarioForm.querySelector('button[type="submit"]').textContent = 'Salvar usuário';
});

loadInitialData();
