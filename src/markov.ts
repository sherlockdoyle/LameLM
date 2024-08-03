import runTask from './task';

function weightedRandomIndex(weights: Array<number>): number {
  const weightSum = weights.reduce((a, b) => a + b);
  if (weightSum === 0) return Math.floor(Math.random() * weights.length);

  const random = Math.random() * weightSum;
  let sum = 0;
  for (let i = 0; i < weights.length; ++i) {
    sum += weights[i];
    if (sum > random) return i;
  }
  return weights.length - 1;
}

export default class MarkovChain {
  private char2num: Record<string, number> = {};
  private num2char: Array<string> = [];
  private inputSeq: Uint32Array;

  private probabilityTable: Float32Array;
  public trained: boolean = false;

  constructor(
    public prefixLength: number,
    inputText: string,
  ) {
    const chars = new Set(inputText);
    for (const char of chars) {
      this.char2num[char] = this.num2char.length;
      this.num2char.push(char);
    }

    this.inputSeq = this.string2nums(inputText);

    this.probabilityTable = new Float32Array(this.num2char.length ** (prefixLength + 1));
  }

  async train(progressCallback: (progress: number) => void) {
    let prefixIndex = 0;
    for (let i = 0; i < this.prefixLength; ++i)
      // build the initial prefix
      prefixIndex = prefixIndex * this.num2char.length + this.inputSeq[i];

    const pow = this.num2char.length ** this.prefixLength;
    await runTask(
      (start, end) => {
        for (let i = start; i < end; ++i) {
          // remove the leftmost, append to right
          prefixIndex = (prefixIndex % pow) * this.num2char.length + this.inputSeq[i];
          this.probabilityTable[prefixIndex] += 1;
        }
        progressCallback((end / this.inputSeq.length) * 0.5);
      },
      this.prefixLength,
      this.inputSeq.length,
    );

    await runTask(
      (start, end) => {
        for (let i = start; i < end; ++i) {
          // normalize the probabilities
          let sum = 0;
          for (let j = 0; j < this.num2char.length; ++j) sum += this.probabilityTable[i * this.num2char.length + j];
          if (sum)
            for (let j = 0; j < this.num2char.length; ++j) this.probabilityTable[i * this.num2char.length + j] /= sum;
        }
        progressCallback((end / pow) * 0.5 + 0.5);
      },
      0,
      pow,
    );

    progressCallback(1);
    this.trained = true;
  }

  get emptyProbsRatio(): number {
    return this.probabilityTable.filter(p => p === 0).length / this.probabilityTable.length;
  }

  get emptyPrefixesRatio(): number {
    let count = 0;
    const pow = this.num2char.length ** this.prefixLength;
    for (let i = 0; i < pow; ++i)
      if (this.probabilityTable.slice(i * this.num2char.length, (i + 1) * this.num2char.length).every(p => p === 0))
        ++count;
    return count / pow;
  }

  private string2nums(string: string): Uint32Array {
    const nums = new Uint32Array(string.length);
    for (let i = 0; i < string.length; ++i) nums[i] = this.char2num[string[i]];
    return nums;
  }

  private nums2string(nums: Array<number>): string {
    return nums.map(n => this.num2char[n]).join('');
  }

  private prefixIndex2string(prefix: number): string {
    const string = new Array(this.prefixLength);
    for (let i = this.prefixLength - 1; i >= 0; --i) {
      string[i] = this.num2char[prefix % this.num2char.length];
      prefix = Math.floor(prefix / this.num2char.length);
    }
    return string.join('');
  }

  getBestPrefix(): string {
    const values = Array<number>(),
      prefixes = Array<number>();
    const pow = this.num2char.length ** this.prefixLength;
    for (let i = 0; i < pow; ++i) {
      let value = 1;
      for (let j = 0; j < this.num2char.length; ++j) value *= this.probabilityTable[i * this.num2char.length + j] + 1;

      if (value > 1) {
        values.push(value);
        prefixes.push(i);
      }
    }

    return this.prefixIndex2string(prefixes[weightedRandomIndex(values)]);
  }

  async generate(
    startSequence: string,
    length: number,
    topK: number,
    probabilityPower: number,
    looseMode: boolean,
    flush: (text: string) => void,
  ) {
    let prefixIndex = 0;
    for (let i = 0; i < startSequence.length; ++i)
      // build the initial prefix
      prefixIndex = prefixIndex * this.num2char.length + this.char2num[startSequence[i]];
    flush(startSequence);

    const pow = this.num2char.length ** this.prefixLength;
    await runTask(
      (start, end) => {
        const nums = Array<number>();
        for (let _ = start; _ < end; ++_) {
          // get the probabilities for the prefix
          let probAndIndex = Array.from<number, [number, number]>(
            this.probabilityTable.slice(prefixIndex * this.num2char.length, (prefixIndex + 1) * this.num2char.length),
            (p, i) => [p, i],
          );

          if (looseMode) probAndIndex = probAndIndex.map(p => [p[0] + 1e-4, p[1]]); // add a small probability so that nothing is 0
          if (topK) probAndIndex = probAndIndex.sort((a, b) => b[0] - a[0]).slice(0, topK); // get the top K
          const probs = probAndIndex.map(p => Math.pow(p[0], probabilityPower)),
            indices = probAndIndex.map(p => p[1]);

          const index = indices[weightedRandomIndex(probs)];
          nums.push(index);
          prefixIndex = (prefixIndex * this.num2char.length + index) % pow;
        }
        flush(this.nums2string(nums));
      },
      0,
      length,
    );
  }
}
