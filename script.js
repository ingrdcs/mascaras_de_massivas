const LOCAIS_KEY = 'mascara_locais_v1';
const API_KEY_STORAGE = 'mascara_gemini_key_v1';
const GEMINI_MODEL = 'gemini-flash-lite-latest';

const apiKeyInput = document.getElementById('apiKey');
const savedTag = document.getElementById('savedTag');

const optSemSinal = document.getElementById('optSemSinal');
const optDegradada = document.getElementById('optDegradada');
const optAbrangencia = document.getElementById('optAbrangencia');
const uploadCardSemSinal = document.getElementById('uploadCardSemSinal');
const uploadCardDegradada = document.getElementById('uploadCardDegradada');
const uploadCardAbrangencia = document.getElementById('uploadCardAbrangencia');
let maskType = 'semSinal';

function setMaskType(t) {
  maskType = t;
  optSemSinal.classList.toggle('active', t === 'semSinal');
  optDegradada.classList.toggle('active', t === 'degradada');
  optAbrangencia.classList.toggle('active', t === 'abrangencia');
  uploadCardSemSinal.classList.toggle('hidden', t !== 'semSinal');
  uploadCardDegradada.classList.toggle('hidden', t !== 'degradada');
  uploadCardAbrangencia.classList.toggle('hidden', t !== 'abrangencia');
}
optSemSinal.addEventListener('click', () => setMaskType('semSinal'));
optDegradada.addEventListener('click', () => setMaskType('degradada'));
optAbrangencia.addEventListener('click', () => setMaskType('abrangencia'));

function loadLocais() {
  try { return JSON.parse(localStorage.getItem(LOCAIS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function saveLocal(localidade, endereco) {
  if (!localidade || !endereco) return;
  const locais = loadLocais();
  locais[localidade] = endereco;
  try { localStorage.setItem(LOCAIS_KEY, JSON.stringify(locais)); } catch (e) {}
}

try {
  const savedKey = localStorage.getItem(API_KEY_STORAGE);
  if (savedKey) { apiKeyInput.value = savedKey; savedTag.style.display = 'flex'; }
} catch (e) {}

apiKeyInput.addEventListener('input', () => {
  try {
    if (apiKeyInput.value.trim()) {
      localStorage.setItem(API_KEY_STORAGE, apiKeyInput.value.trim());
      savedTag.style.display = 'flex';
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
      savedTag.style.display = 'none';
    }
  } catch (e) {}
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    r.readAsDataURL(file);
  });
}

async function callGemini(file, apiKey, prompt) {
  const b64 = await fileToBase64(file);
  const mimeType = file.type || 'image/png';
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: b64 } }] }]
      })
    }
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API retornou ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  let text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  text = text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(text);
}

/* ================= Resultado (compartilhado) ================= */

const resultCard = document.getElementById('resultCard');
const resultText = document.getElementById('resultText');
const copyBtn = document.getElementById('copyBtn');
const newBtn = document.getElementById('newBtn');

function showResult(text) {
  resultText.value = text;
  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function oltLine(olt, localidade) {
  const oltVal = olt || '';
  return localidade ? `Olt: ${oltVal} (${localidade})` : `Olt: ${oltVal}`;
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultText.value);
    copyBtn.textContent = 'Copiado!';
    setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 1500);
  } catch (e) {}
});

/* ================= CTO SEM SINAL ================= */

const drop = document.getElementById('drop');
const fileInput = document.getElementById('fileInput');
const fileListEl = document.getElementById('fileList');
const readBtnSemSinal = document.getElementById('readBtnSemSinal');
const statusSemSinal = document.getElementById('statusSemSinal');

let currentFiles = [];

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

function addFiles(fileListLike) {
  for (const f of fileListLike) currentFiles.push(f);
  renderFileList();
  readBtnSemSinal.disabled = currentFiles.length === 0;
}

function renderFileList() {
  fileListEl.innerHTML = '';
  currentFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'fileitem';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.name;
    const rm = document.createElement('button');
    rm.className = 'clear';
    rm.textContent = 'remover';
    rm.addEventListener('click', () => {
      currentFiles.splice(idx, 1);
      renderFileList();
      readBtnSemSinal.disabled = currentFiles.length === 0;
    });
    row.appendChild(img); row.appendChild(name); row.appendChild(rm);
    fileListEl.appendChild(row);
  });
}

const EXTRACTION_PROMPT_ALARME = `Você recebeu a captura de tela de um alarme de "massivo" de uma OLT/rede de fibra.
Extraia os seguintes campos e responda APENAS com um JSON válido, sem nenhum texto antes ou depois, sem marcação de código, no formato:

{
  "olt": "<nome/identificação da OLT>",
  "localidade": "<nome da localidade>",
  "placa": "<número da placa>",
  "pon": "<número do pon>",
  "queda": "<data e hora de início do alarme, ex: 25/09 14:29>",
  "clientes": <número total de clientes afetados nessa tela>,
  "problema": "<descrição curta do problema, ex: CTO sem sinal>",
  "caixas": ["<código da caixa 1>", "<código da caixa 2>", ...]
}

Para "placa" e "pon": procure um padrão tipo endereço IP seguido de "·" e dois números separados por barra, tipo "10.0.65.12 · 5/2" (placa "5", pon "2").
Para "localidade": se houver um nome entre parênteses depois do identificador da OLT, use esse nome. Se não houver parênteses, normalmente é o último pedaço do nome da OLT depois do último hífen. Se ainda assim não conseguir, procure em outros textos da tela antes de usar null.
Para "problema": não copie rótulos genéricos da interface como "Problemas técnicos - Geral". Descreva o problema técnico real, no padrão "CTO sem sinal" ou "CTOs sem sinal" quando for isso que o alarme indica.
Para "caixas", pegue todos os códigos de caixa (formatos tipo "CC ACZ 0560" ou "CC VIA 0046") que aparecem na tabela da tela, na ordem em que aparecem, ignorando as colunas de clientes e "no mapa".
Se algum campo não estiver visível, use null.`;

function buildMaskSemSinal(shared, blocks) {
  const blocksText = blocks.map(b =>
    `Placa: ${b.placa}\nPon: ${b.pon}\nCaixa: ${b.caixas}`
  ).join('\n\n');

  return `${oltLine(shared.olt, shared.localidade)}

${blocksText}

Queda: ${shared.queda}
Endereço: ${shared.endereco}

Problema: ${shared.problema}, afetando ${shared.clientes} clientes`;
}

readBtnSemSinal.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusSemSinal.textContent = 'Cola sua chave gratuita do Gemini acima antes de ler as fotos.';
    statusSemSinal.classList.add('err');
    return;
  }
  if (currentFiles.length === 0) return;

  readBtnSemSinal.disabled = true;
  statusSemSinal.classList.remove('err');
  const results = [];
  try {
    for (let i = 0; i < currentFiles.length; i++) {
      statusSemSinal.textContent = `Lendo foto ${i + 1} de ${currentFiles.length}...`;
      results.push(await callGemini(currentFiles[i], apiKey, EXTRACTION_PROMPT_ALARME));
    }

    const first = results[0] || {};
    const localidade = first.localidade || '';
    const totalClientes = results.reduce((sum, r) => {
      const n = parseInt(r.clientes, 10);
      return sum + (isNaN(n) ? 0 : n);
    }, 0);

    const shared = {
      olt: first.olt || '',
      localidade,
      queda: first.queda || '',
      clientes: totalClientes || '',
      problema: first.problema || '',
      endereco: loadLocais()[localidade] || ''
    };

    const blocks = results.map(r => ({
      placa: r.placa || '',
      pon: r.pon || '',
      caixas: (r.caixas || []).join(', ')
    }));

    statusSemSinal.textContent = '';
    showResult(buildMaskSemSinal(shared, blocks));
  } catch (e) {
    statusSemSinal.textContent = 'Erro: ' + e.message;
    statusSemSinal.classList.add('err');
  } finally {
    readBtnSemSinal.disabled = false;
  }
});

/* ================= CTO DEGRADADA ================= */

const readBtnDegradada = document.getElementById('readBtnDegradada');
const statusDegradada = document.getElementById('statusDegradada');

function setupSlot(prefix) {
  const dropEl = document.getElementById('slotDrop' + prefix);
  const fileEl = document.getElementById('slotFile' + prefix);
  const previewEl = document.getElementById('slotPreview' + prefix);
  const imgEl = document.getElementById('slotImg' + prefix);
  const nameEl = document.getElementById('slotName' + prefix);
  const clearEl = document.getElementById('slotClear' + prefix);

  const state = { file: null };

  function setFile(f) {
    state.file = f;
    imgEl.src = URL.createObjectURL(f);
    nameEl.textContent = f.name;
    previewEl.classList.add('show');
    dropEl.style.display = 'none';
    updateDegradadaReadBtn();
  }
  function clearFile() {
    state.file = null;
    fileEl.value = '';
    previewEl.classList.remove('show');
    dropEl.style.display = 'block';
    updateDegradadaReadBtn();
  }

  dropEl.addEventListener('click', () => fileEl.click());
  dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('over'));
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault(); dropEl.classList.remove('over');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  fileEl.addEventListener('change', () => { if (fileEl.files[0]) setFile(fileEl.files[0]); });
  clearEl.addEventListener('click', clearFile);

  return state;
}

const slotU2000 = setupSlot('U2000');
const slotBusca = setupSlot('Busca');
const slotPower = setupSlot('Power');

function updateDegradadaReadBtn() {
  readBtnDegradada.disabled = !(slotU2000.file || slotBusca.file || slotPower.file);
}

const PROMPT_U2000 = `Você recebeu uma captura de tela do sistema U2000 (gerência de OLT). Extraia e responda APENAS com um JSON válido, sem texto antes/depois, sem marcação de código:
{
  "olt": "<nome/identificação da OLT>",
  "localidade": "<nome da localidade, se identificável>",
  "placa": "<número da placa>",
  "pon": "<número do pon>"
}
Placa e Pon costumam aparecer em campos ou árvore de navegação identificados como tal. Se algum campo não estiver visível, use null.`;

const PROMPT_BUSCA_CAIXA = `Você recebeu uma captura de tela de uma busca/consulta de caixa (CTO) num sistema de rede óptica, mostrando o código da caixa, a potência de validação e a média de sinal (RX médio, em dBm) dela. Extraia e responda APENAS com um JSON válido, sem texto antes/depois, sem marcação de código:
{
  "caixa": "<código da caixa, ex: CC PMA 0255>",
  "potencia": "<valor numérico da potência de validação em dBm, ex: -22>",
  "media": "<valor numérico da média de sinal/RX médio em dBm, ex: -25.33>"
}
"potencia" costuma aparecer com o rótulo "Potência de validação". "media" costuma aparecer como "Média RX" ou similar. Se algum campo não estiver visível, use null.`;

const PROMPT_POWER_METER = `Você recebeu uma captura de tela de um aplicativo de power meter (medidor óptico) usado por um técnico em campo, que também exibe a localização atual do técnico. Extraia e responda APENAS com um JSON válido, sem texto antes/depois, sem marcação de código:
{
  "endereco": "<endereço em texto, o mais completo possível: rua, bairro, cidade>"
}
Muito importante: use o ENDEREÇO ESCRITO (rua/avenida, bairro, cidade), nunca coordenadas de GPS/latitude/longitude. Se só houver coordenadas na tela e nenhum endereço em texto, use null em vez de devolver as coordenadas.`;

function buildMaskDegradada(d) {
  return `${oltLine(d.olt, d.localidade)}

Placa: ${d.placa}
Pon: ${d.pon}
Caixa: ${d.caixa}
Potência de validação: ${d.potencia}

Endereço: ${d.endereco}

Problema: Verificado que CTO está com a media de sinal ${d.mediaCaixa}dBm, fora do padrão de validação.
Necessária verificação em campo, restante da pon segue com sinal entre ${d.mediaPonMin}dBm e ${d.mediaPonMax}dBm.`;
}

readBtnDegradada.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusDegradada.textContent = 'Cola sua chave gratuita do Gemini acima antes de ler os prints.';
    statusDegradada.classList.add('err');
    return;
  }

  readBtnDegradada.disabled = true;
  statusDegradada.classList.remove('err');

  const d = {
    olt: '', localidade: '', placa: '', pon: '',
    caixa: '', potencia: '', mediaCaixa: '',
    mediaPonMin: '', mediaPonMax: '', endereco: ''
  };

  try {
    if (slotU2000.file) {
      statusDegradada.textContent = 'Lendo print do U2000...';
      const r = await callGemini(slotU2000.file, apiKey, PROMPT_U2000);
      d.olt = r.olt || '';
      d.localidade = r.localidade || '';
      d.placa = r.placa || '';
      d.pon = r.pon || '';
    }

    if (slotBusca.file) {
      statusDegradada.textContent = 'Lendo print do busca caixa...';
      const r = await callGemini(slotBusca.file, apiKey, PROMPT_BUSCA_CAIXA);
      d.caixa = r.caixa || '';
      d.potencia = r.potencia || '';
      d.mediaCaixa = r.media || '';
    }

    if (slotPower.file) {
      statusDegradada.textContent = 'Lendo print do power meter...';
      const r = await callGemini(slotPower.file, apiKey, PROMPT_POWER_METER);
      d.endereco = r.endereco || '';
    }

    if (!d.endereco && d.localidade) {
      d.endereco = loadLocais()[d.localidade] || '';
    }
    if (d.endereco) saveLocal(d.localidade, d.endereco);

    statusDegradada.textContent = '';
    showResult(buildMaskDegradada(d));
  } catch (e) {
    statusDegradada.textContent = 'Erro: ' + e.message;
    statusDegradada.classList.add('err');
  } finally {
    readBtnDegradada.disabled = false;
  }
});

/* ================= MASSIVA GRANDE ABRANGÊNCIA ================= */

const dropAbr = document.getElementById('dropAbr');
const fileInputAbr = document.getElementById('fileInputAbr');
const fileListAbrEl = document.getElementById('fileListAbr');
const readBtnAbrangencia = document.getElementById('readBtnAbrangencia');
const statusAbrangencia = document.getElementById('statusAbrangencia');

let currentFilesAbr = [];

dropAbr.addEventListener('click', () => fileInputAbr.click());
dropAbr.addEventListener('dragover', (e) => { e.preventDefault(); dropAbr.classList.add('over'); });
dropAbr.addEventListener('dragleave', () => dropAbr.classList.remove('over'));
dropAbr.addEventListener('drop', (e) => { e.preventDefault(); dropAbr.classList.remove('over'); addFilesAbr(e.dataTransfer.files); });
fileInputAbr.addEventListener('change', () => { addFilesAbr(fileInputAbr.files); fileInputAbr.value = ''; });

function addFilesAbr(fileListLike) {
  for (const f of fileListLike) currentFilesAbr.push(f);
  renderFileListAbr();
  readBtnAbrangencia.disabled = currentFilesAbr.length === 0;
}

function renderFileListAbr() {
  fileListAbrEl.innerHTML = '';
  currentFilesAbr.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'fileitem';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.name;
    const rm = document.createElement('button');
    rm.className = 'clear';
    rm.textContent = 'remover';
    rm.addEventListener('click', () => {
      currentFilesAbr.splice(idx, 1);
      renderFileListAbr();
      readBtnAbrangencia.disabled = currentFilesAbr.length === 0;
    });
    row.appendChild(img); row.appendChild(name); row.appendChild(rm);
    fileListAbrEl.appendChild(row);
  });
}

const PROMPT_ABRANGENCIA = `Você recebeu uma captura de tela de uma tabela de status de portas PON de uma OLT (sistema U2000 ou similar), com um indicador de status colorido, o status em texto, e uma coluna no formato "Frame:X/Slot:Y/Port:Z".

Considere APENAS as linhas cujo status seja "Activated (Offline, with ONU)" — indicador VERMELHO, portas que têm ONU/cliente conectado mas estão offline (problema real). IGNORE COMPLETAMENTE as linhas "Activated (Offline, without ONU)" (indicador roxo/lilás, sem ONU conectada, não é um problema real) e qualquer linha com outro status (ex: "Activated (Online...)").

Para cada linha "Offline, with ONU" considerada, extraia o número do Slot e o número do Port da coluna "Frame:X/Slot:Y/Port:Z".

Se o nome/identificação da OLT aparecer em algum lugar da tela, extraia também.

Responda APENAS com um JSON válido, sem texto antes/depois, sem marcação de código, no formato:
{
  "olt": "<identificação da OLT, ou null se não aparecer>",
  "linhas": [ {"placa": "<slot>", "pon": "<port>"} ]
}`;

function groupByPlaca(rows) {
  const map = new Map();
  rows.forEach(({ placa, pon }) => {
    if (!map.has(placa)) map.set(placa, []);
    if (!map.get(placa).includes(pon)) map.get(placa).push(pon);
  });
  return [...map.entries()].map(([placa, pons]) => ({ placa, pons }));
}

function buildMaskAbrangencia(shared, blocks) {
  const blocksText = blocks.map((b) => `Placa: ${b.placa} Pon: ${b.pons}`).join('\n');
  return `${oltLine(shared.olt, '')}

${blocksText}

Queda: ${shared.queda}
Endereço: ${shared.endereco}
Corporativos: ${shared.corporativos}

Problema: ${shared.problema}, afetando ${shared.clientes} clientes.`;
}

readBtnAbrangencia.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusAbrangencia.textContent = 'Cola sua chave gratuita do Gemini acima antes de ler os prints.';
    statusAbrangencia.classList.add('err');
    return;
  }
  if (currentFilesAbr.length === 0) return;

  readBtnAbrangencia.disabled = true;
  statusAbrangencia.classList.remove('err');

  let oltFound = '';
  const allRows = [];
  try {
    for (let i = 0; i < currentFilesAbr.length; i++) {
      statusAbrangencia.textContent = `Lendo print ${i + 1} de ${currentFilesAbr.length}...`;
      const r = await callGemini(currentFilesAbr[i], apiKey, PROMPT_ABRANGENCIA);
      if (r.olt && !oltFound) oltFound = r.olt;
      (r.linhas || []).forEach((l) => {
        if (l.placa != null && l.pon != null) allRows.push({ placa: String(l.placa), pon: String(l.pon) });
      });
    }

    const shared = {
      olt: oltFound || '',
      queda: '',
      clientes: allRows.length ? String(allRows.length) : '',
      endereco: '',
      corporativos: '',
      problema: 'CTOS sem sinal'
    };

    const blocks = groupByPlaca(allRows).map(g => ({ placa: g.placa, pons: g.pons.join(', ') }));

    statusAbrangencia.textContent = '';
    showResult(buildMaskAbrangencia(shared, blocks));
  } catch (e) {
    statusAbrangencia.textContent = 'Erro: ' + e.message;
    statusAbrangencia.classList.add('err');
  } finally {
    readBtnAbrangencia.disabled = false;
  }
});

/* ================= Novo alarme ================= */

newBtn.addEventListener('click', () => {
  currentFiles = [];
  fileInput.value = '';
  renderFileList();
  readBtnSemSinal.disabled = true;
  statusSemSinal.textContent = '';

  [slotU2000, slotBusca, slotPower].forEach((s) => { s.file = null; });
  ['U2000', 'Busca', 'Power'].forEach((p) => {
    document.getElementById('slotFile' + p).value = '';
    document.getElementById('slotPreview' + p).classList.remove('show');
    document.getElementById('slotDrop' + p).style.display = 'block';
  });
  readBtnDegradada.disabled = true;
  statusDegradada.textContent = '';

  currentFilesAbr = [];
  fileInputAbr.value = '';
  renderFileListAbr();
  readBtnAbrangencia.disabled = true;
  statusAbrangencia.textContent = '';

  resultCard.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
