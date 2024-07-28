import { $ } from './util';

const PREDEFINED_TEXTS: Record<string, () => Promise<typeof import('*.txt')>> = {
  'Periodic Elements': () => import('./data/element.txt?raw'),
  Countries: () => import('./data/country.txt?raw'),
  'Scientific Names': () => import('./data/scientific-name.txt?raw'),
  Medicines: () => import('./data/medicine.txt?raw'),
  Names: () => import('./data/name.txt?raw'),
  Celebrities: () => import('./data/celebrity.txt?raw'),
  Shakespeare: () => import('./data/shakespeare.txt?raw'),
  'Lorem Ipsum': () => import('./data/lorem.txt?raw'),
};

const inputText = $<HTMLInputElement>('inputText'),
  uploadFile = $<HTMLButtonElement>('uploadFile'),
  downloadUrl = $<HTMLButtonElement>('downloadUrl'),
  predefinedText = $<HTMLSelectElement>('predefinedText'),
  simplifyText = $<HTMLButtonElement>('simplifyText');

function resetPredefinedText() {
  predefinedText.value = '';
}

uploadFile.addEventListener('click', () => {
  resetPredefinedText();
  inputText.value = 'Reading file...';
  const input = document.createElement('input');
  input.type = 'file';
  input.addEventListener('change', event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        inputText.value = reader.result as string;
      });
      reader.readAsText(file);
    }
  });
  input.click();
});

downloadUrl.addEventListener('click', () => {
  resetPredefinedText();
  inputText.value = 'Downloading file...';
  const input = prompt('Enter URL to download');
  if (input)
    fetch(input)
      .then(response => response.text())
      .then(data => {
        inputText.value = data;
      })
      .catch(error => {
        inputText.value = 'Error: ' + error;
      });
  else inputText.value = 'Error: No URL provided';
});

for (const key in PREDEFINED_TEXTS) {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = key;
  predefinedText.appendChild(option);
}
predefinedText.addEventListener('change', () => {
  if (predefinedText.value) {
    inputText.value = 'Getting text...';
    PREDEFINED_TEXTS[predefinedText.value]()
      .then(data => {
        inputText.value = data.default;
      })
      .catch(error => {
        inputText.value = 'Error: ' + error;
      });
  }
});

simplifyText.addEventListener('click', () => {
  resetPredefinedText();
  inputText.value = inputText.value.replace(/[^\w\s]/gi, '').toLowerCase();
});

export default function getInputText(): string | null {
  return inputText.value || null;
}
