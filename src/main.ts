import './style.css';
import getInputText from './input';
import { $ } from './util';
import MarkovChain from './markov';

const prefixLength = $<HTMLInputElement>('prefixLength'),
  train = $<HTMLButtonElement>('train'),
  trainingProgress = $<HTMLProgressElement>('trainingProgress');

let mc: MarkovChain | null = null;

train.addEventListener('click', () => {
  trainingProgress.value = 0;
  if (!prefixLength.value) prefixLength.value = '3';

  const prefixLengthValue = parseInt(prefixLength.value);
  const inputTextValue = getInputText();
  if (!inputTextValue) return alert('Input text is required!');
  if (inputTextValue.length <= prefixLengthValue) return alert('Input text must be longer than prefix length!');

  mc = new MarkovChain(prefixLengthValue, inputTextValue);
  mc.train(progress => {
    trainingProgress.value = progress;
  });
});

const startSequence = $<HTMLInputElement>('startSequence'),
  autoStartSequence = $<HTMLButtonElement>('autoStartSequence'),
  contentLength = $<HTMLInputElement>('contentLength'),
  topK = $<HTMLInputElement>('topK'),
  probabilityPower = $<HTMLInputElement>('probabilityPower'),
  looseMode = $<HTMLInputElement>('looseMode'),
  generate = $<HTMLButtonElement>('generate'),
  output = $<HTMLTextAreaElement>('output');

autoStartSequence.addEventListener('click', () => {
  if (!mc?.trained) return alert('Train the model first!');
  startSequence.value = mc.getBestPrefix();
});

generate.addEventListener('click', () => {
  if (!mc?.trained) return alert('Train the model first!');
  if (!startSequence.value) return alert('Start sequence is required!');
  if (startSequence.value.length !== mc.prefixLength)
    return alert('Start sequence should have as many characters as the prefix length!');

  if (!contentLength.value) contentLength.value = '500';
  if (!topK.value) topK.value = '0';
  if (!probabilityPower.value) probabilityPower.value = '1';

  const contentLengthValue = Math.max(parseInt(contentLength.value), 1),
    topKValue = Math.max(parseInt(topK.value), 0),
    probabilityPowerValue = parseFloat(probabilityPower.value);

  output.innerText = '';
  mc.generate(startSequence.value, contentLengthValue, topKValue, probabilityPowerValue, looseMode.checked, text => {
    output.innerText += text;
  });
});
