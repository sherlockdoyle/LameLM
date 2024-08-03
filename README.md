# LameLM

LameLM is a simple (lame) language model for text generation, created using plain HTML, CSS, and TypeScript, without any frameworks. It is bundled with Vite.

## How to Use

Some of the terms below might be confusing. Keep reading for more information.

1. **Enter Text**:
   - Type text in the input box. The more text, the better.
   - Alternatively, upload a text file. Any binary file will be read as text.
   - You can also download text from a URL. This might fail if the URL is CORS-enabled.
   - Predefined text samples are available to help you get started.
   - Click "Simplify text" to remove all non-alphanumeric characters and convert the text to lowercase. This helps reduce the number of unique characters and shortens training time.

2. **Set Prefix Length**:
   - Enter a prefix length. Higher values will use more memory and take longer to train, but the output will be more similar to the input. Lower values will produce more random, but still similar, output.

3. **Train the Model**:
   - Click "Train" to start training the model. The training progress will be displayed. After training, two percentages will be shown: the first indicates the number of cells in the probability table that remained 0, and the second shows the number of prefixes not found in the training text.

4. **Enter Starting Sequence**:
   - Enter a starting sequence with as many characters as the prefix length. This will be the beginning of the generated content.
   - You can also click "Auto-choose starting sequence" to select one of the best starting sequences randomly based on the training text. This is chosen to increase variations in the output.
   - Note: If the input text has no lines longer than the prefix length, the auto-choose algorithm might get stuck. This is a known issue and beyond the scope of the text generation algorithm.

5. **Set Content Length**:
   - Enter the desired content length (>=1). This is the number of characters to be generated after the starting sequence.

6. **Set Top K**:
   - Enter top $k$ (>=0). This determines how many of the possible next characters for the prefix will be used to choose the next character randomly.
   - A value of 0 (default) uses all possible next characters.
   - A value of 1 uses only the most probable next character, which may cause the output to enter a cycle after a few characters.

7. **Set Probability Power**:
   - Each probability for the possible next character will be raised to this power.
   - A value >1 amplifies higher probabilities. For example, if the probabilities are $[0.9, 0.1]$, a value of $2$ results in $[0.9, 0.1]^2 = [0.81, 0.01]$, which normalizes to $[0.988, 0.012]$, making the first character even more likely.
   - A value between 0 and 1 does the opposite. For example, a value of $0.5$ with probabilities $[0.9, 0.1]$ results in $[0.949, 0.316]$, which normalizes to $[0.75, 0.25]$, making the first character less likely but still more common.
   - A value of 0 makes all characters equally likely.
   - A negative value reverses the probabilities. For example, a value of $-1$ with the same probabilities results in $[1.11, 10]$, which normalizes to $[0.1, 0.9]$, making the second character more likely.

8. **Use All Characters from Input**:
   - Check this box to add a very small number $(10^{-4})$ to all probabilities, allowing characters with a probability of $0$ to be picked, albeit less often. This makes the output more random and less similar to the input.

9. **Generate Output**:
   - Click "Generate" to produce the output. You can leave most parameters at their default values. If everything is set correctly, the output will appear in the "Generated Output" box.

## How It Works

LameLM operates using a table of probabilities, similar to a Markov chain. It calculates the probability of different characters following a specific prefix. For this explanation, we'll use the training text `abbbba` with a *prefix length* of 2.

### Preparing the Text

We begin by splitting the input into n-grams of a specific length, known as the prefix length. For each possible prefix, we count the occurrences of the following character. In our example, the prefixes and their following characters are as follows:

    Input: abbbba    Prefix Next
           abb    ->   ab    b
            bbb   ->   bb    b
             bbb  ->   bb    b
              bba ->   bb    a

This pair of prefix and next character shows all possible next characters for a given prefix.

| Prefix | Next       |
| ------ | ---------- |
| `ab`   | only `b`   |
| `bb`   | `a` or `b` |

It also indicates how often a character appears after a given prefix. For example, after `bb`, `a` appears once and `b` appears twice. Thus, it is more likely that the next character after `bb` is `b` rather than `a`. Using this information, we can build a table of probabilities.

|      |     `a`     |     `b`     |
| ---- | ----------- | ----------- |
| `ab` |     $0$     |     $1$     |
| `bb` | $1 \over 3$ | $2 \over 3$ |

#### Internal Algorithm

Internally, the probability table is represented as a 1D array. There will be $(\text{number of characters})^{(\text{prefix length})}$ prefixes, and each prefix will have $(\text{number of characters})$ next characters. So, the array size is $(\text{number of characters})^{(\text{prefix length} + 1)}$. In our case (with only 2 characters, `a` and `b`), the array will have $2^{(2+1)} = 8$ cells representing the following (prefix, next) pairs:

    [
      (aa, a), (aa, b),
      (ab, a), (ab, b),
      (ba, a), (ba, b),
      (bb, a), (bb, b)
    ]

If you ignore the fact that they are pairs and just concatenate the prefix with the next character, the array becomes a sequence of all permutations of length $(\text{prefix length} + 1)$ of all characters. This concept is used to calculate the probability table efficiently. A sliding window turns each substring of the input text into a number in base $(\text{number of characters})$. Then, the corresponding element in the probability table is incremented by 1.

After processing the entire input text, each slice of length $(\text{number of characters})$ of the array is normalized to get the final probability table. Normalization is done by summing all elements in the slice and then dividing each element by the sum. For our case, the probability table looks like this:

    [
         0,    0
         0,    1,
         0,    0,
      0.33, 0.67
    ]

    Percentage of empty cells = (5 cells with 0) / (8 total cells) = 62.5%
    Percentage of non-existing prefixes = (2 rows with only 0) / (4 total rows) = 50%

Note that with this method, the size of the probability table increases exponentially with the prefix length. However, most of the array remains at 0, which is very inefficient. As discussed above, after the training completes, we show the percentage of empty cells and rows. For all realistic texts, the number of empty cells is close to 99%. You can check this with the provided sample input. A better approach would be to use a map of prefixes to probabilities.

### Generating Output

1. **Start with the Starting Sequence**:
   - Begin with the starting sequence provided.

2. **Extract Probabilities**:
   - Extract the corresponding probabilities for the current prefix (starting sequence) from the probability table.

3. **Transform the Array**:
   - **Add a Small Value**: Add $10^{-4}$ to each probability if the "Use all characters from input" option is checked.
   - **Top $k$ Characters**: Select the top $k$ characters with the highest probabilities.
   - **Raise to the Power**: Raise each probability to the given power to adjust their influence.

4. **Normalize the Array**:
   - If necessary, normalize the transformed array by dividing each probability by the sum of all probabilities to ensure they add up to 1.

5. **Choose the Next Character**:
   - Randomly select the next character based on the weighted probabilities.

6. **Update the Sequence**:
   - Add the chosen character to the starting sequence.
   - Form the next prefix by including the newly generated character.

7. **Repeat the Process**:
   - Repeat steps 2-6 until the desired content length is reached.

By following these steps, the model generates text that continues from the starting sequence, using the probabilities to ensure the output resembles the input training text.

## Why Use It?

This project was a fun exercise I did during my academic years while learning about Markov chains. The main use I found for it was in my database management class, where I needed to generate dummy data. Instead of using real data, I chose to create realistic-looking data.

## Samples

Several sample input texts are available in the project's [`src/data`](./src/data) folder. All these texts were collected from publicly available sources.

---

If you have any questions or encounter issues, feel free to create an issue. Enjoy generating text with LameLM!
