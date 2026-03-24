# STORY-046: Select Model & Effort Level

## Status: PASS

## Steps Performed
1. Clicked "Model" tab in profile editor
2. Observed model selector dropdown with options: Default, Sonnet 4.6, Opus 4.6, Haiku 4.5
3. Effort level buttons: Low, Medium, High, Max
4. Extended Thinking Budget slider and spinbutton (range: 1,000 - 100,000 tokens)
5. Current value: 10,000 tokens

## Observations
- Model dropdown defaults to "Default" (uses session default)
- Help text: "Override the model used when this profile is active. Leave empty to use the session default."
- Effort buttons show descriptive text when selected (e.g., "Balanced performance. Recommended for most tasks.")
- Extended thinking budget has both a slider and numeric spinbutton for precise control
- Range is 1,000 to 100,000 tokens
- Note: "The Effort setting automatically adjusts the thinking budget. Override the budget manually below."

## Findings
None -- model and effort configuration works as expected.
