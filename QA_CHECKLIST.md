# MVP QA Checklist

## Setup
1. Open `index.html` in a browser.
2. Click `Start Practice`.

## A. Question System
1. Confirm sentence session starts at question `1/N`.
2. Complete one sentence and click `Next Question`.
3. Confirm counter advances to `2/N`.
4. Finish all questions and confirm result page appears.

## B. Listening System
1. Click `Play Sentence` and confirm full sentence is spoken.
2. Click `Repeat` and confirm sentence plays again.
3. Move speed slider from `0.7x` to `1.2x`.
4. Click `Play Sentence` after speed change and confirm playback speed changes.

## C. Word Input System
1. Type one correct word and submit with Enter.
2. Confirm a green chip appears and feedback says correct.
3. Type one wrong word and submit.
4. Confirm a red chip appears with first-letter hint.
5. Try typing multiple words in one submit and confirm validation message appears.

## D. Sentence Progress Logic
1. Confirm each submitted word is appended to chip list.
2. After enough submissions to match sentence length, confirm input is locked.
3. Confirm `Next Question` button becomes visible when sentence completes.

## E. Score System
1. Complete a full sentence with all words correct and confirm score increases by `+10`.
2. Complete a sentence with any wrong word and confirm no `+10` is added.
3. Confirm live score updates during practice.
4. Confirm result page shows final score and max score.

## F. Basic UI Pages
1. Confirm app starts on Home page.
2. Confirm practice actions occur on Practice page.
3. Confirm end of session opens Result page.
4. Click `Restart` and confirm a new session starts from question 1 with score reset.

## G. Progress Indicator
1. Confirm progress bar fills as each sentence is completed.
2. Confirm question counter matches current position (e.g. `2/5`).
