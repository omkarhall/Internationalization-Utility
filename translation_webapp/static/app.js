const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const statusEl = document.getElementById('status');

let jsonFiles = [];
let csvFile = null;

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    clearStatus();
  });
});

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function clearStatus() {
  setStatus('');
}

function setInlineMessage(elementId, message = '', type = '') {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `inline-message ${type}`.trim();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateSummary(elementId, count, singularLabel, pluralLabel) {
  const el = document.getElementById(elementId);
  if (!count) {
    el.textContent = singularLabel.startsWith('No') ? singularLabel : 'No files selected';
    return;
  }
  el.textContent = count === 1 ? `1 ${singularLabel} selected` : `${count} ${pluralLabel} selected`;
}

function renderFileList(listId, files, mode) {
  const list = document.getElementById(listId);
  list.innerHTML = '';

  if (!files.length) {
    list.classList.add('empty');
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = mode === 'json'
      ? 'No JSON files selected yet.'
      : 'No CSV file selected yet.';
    list.appendChild(li);
    return;
  }

  list.classList.remove('empty');

  files.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const meta = document.createElement('div');
    meta.className = 'file-meta';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;

    const details = document.createElement('div');
    details.className = 'file-size';
    details.textContent = formatFileSize(file.size);

    meta.appendChild(name);
    meta.appendChild(details);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost small';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      if (mode === 'json') {
        jsonFiles = jsonFiles.filter((_, i) => i !== index);
        syncJsonUI();
      } else {
        csvFile = null;
        syncCsvUI();
      }
      clearStatus();
    });

    li.appendChild(meta);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function setLoading(buttonId, isLoading, defaultText, loadingText) {
  const button = document.getElementById(buttonId);
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
}

function openInput(inputId) {
  document.getElementById(inputId).click();
}

function normalizeAcceptedFiles(files, extensions, allowMultiple) {
  const valid = [];
  const invalid = [];

  files.forEach(file => {
    const lower = file.name.toLowerCase();
    if (extensions.some(ext => lower.endsWith(ext))) {
      valid.push(file);
    } else {
      invalid.push(file.name);
    }
  });

  return {
    valid: allowMultiple ? valid : valid.slice(0, 1),
    invalid
  };
}

function setupDropzone({ dropzoneId, inputId, allowMultiple, extensions, onFilesSelected }) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => {
    onFilesSelected([...input.files]);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', event => {
    const files = [...event.dataTransfer.files];
    const normalized = normalizeAcceptedFiles(files, extensions, allowMultiple);
    onFilesSelected(normalized.valid, normalized.invalid);
  });
}

function syncJsonUI(message = '', type = '') {
  renderFileList('jsonFileList', jsonFiles, 'json');
  updateSummary('jsonSelectedSummary', jsonFiles.length, 'file', 'files');
  document.getElementById('jsonSubmit').disabled = jsonFiles.length === 0;
  setInlineMessage('jsonValidation', message, type);
}

function syncCsvUI(message = '', type = '') {
  renderFileList('csvFileList', csvFile ? [csvFile] : [], 'csv');
  document.getElementById('csvSelectedSummary').textContent = csvFile ? '1 file selected' : 'No file selected';
  document.getElementById('csvSubmit').disabled = !csvFile;
  setInlineMessage('csvValidation', message, type);
}

setupDropzone({
  dropzoneId: 'jsonDropzone',
  inputId: 'jsonFiles',
  allowMultiple: true,
  extensions: ['.json'],
  onFilesSelected: (files, invalid = []) => {
    const normalized = normalizeAcceptedFiles(files, ['.json'], true);
    jsonFiles = normalized.valid;
    const allInvalid = [...invalid, ...normalized.invalid];
    syncJsonUI(
      allInvalid.length ? `Ignored invalid files: ${allInvalid.join(', ')}` : '',
      allInvalid.length ? 'error' : ''
    );
    clearStatus();
  }
});

setupDropzone({
  dropzoneId: 'csvDropzone',
  inputId: 'csvFile',
  allowMultiple: false,
  extensions: ['.csv'],
  onFilesSelected: (files, invalid = []) => {
    const normalized = normalizeAcceptedFiles(files, ['.csv'], false);
    csvFile = normalized.valid[0] || null;
    const allInvalid = [...invalid, ...normalized.invalid];
    syncCsvUI(
      allInvalid.length ? `Ignored invalid files: ${allInvalid.join(', ')}` : '',
      allInvalid.length ? 'error' : ''
    );
    clearStatus();
  }
});

document.getElementById('jsonReplace').addEventListener('click', () => openInput('jsonFiles'));
document.getElementById('csvReplace').addEventListener('click', () => openInput('csvFile'));

document.getElementById('jsonClear').addEventListener('click', () => {
  jsonFiles = [];
  syncJsonUI();
  clearStatus();
});

document.getElementById('csvClear').addEventListener('click', () => {
  csvFile = null;
  syncCsvUI();
  clearStatus();
});

async function downloadFromResponse(response, fallbackName) {
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename=([^;]+)/i);
  const filename = match ? match[1].replace(/"/g, '') : fallbackName;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

document.getElementById('jsonSubmit').addEventListener('click', async () => {
  if (!jsonFiles.length) {
    setStatus('Please add at least one JSON file.', 'error');
    return;
  }

  const formData = new FormData();
  jsonFiles.forEach(file => formData.append('files', file));
  formData.append('preserve_order', document.getElementById('preserveOrder').checked);

  try {
    setLoading('jsonSubmit', true, 'Generate CSV', 'Generating CSV...');
    setStatus('Uploading files and generating CSV...');
    const response = await fetch('/api/json-to-csv', { method: 'POST', body: formData });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed.');
    }
    await downloadFromResponse(response, 'merged_output.csv');
    setStatus('CSV generated successfully.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    setLoading('jsonSubmit', false, 'Generate CSV', 'Generating CSV...');
  }
});

document.getElementById('csvSubmit').addEventListener('click', async () => {
  if (!csvFile) {
    setStatus('Please add a CSV file.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', csvFile);

  try {
    setLoading('csvSubmit', true, 'Generate JSON ZIP', 'Generating JSON ZIP...');
    setStatus('Uploading CSV and generating JSON ZIP...');
    const response = await fetch('/api/csv-to-json', { method: 'POST', body: formData });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed.');
    }
    await downloadFromResponse(response, 'translated_json_files.zip');
    setStatus('JSON ZIP generated successfully.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    setLoading('csvSubmit', false, 'Generate JSON ZIP', 'Generating JSON ZIP...');
  }
});

syncJsonUI();
syncCsvUI();
