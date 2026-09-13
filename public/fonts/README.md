# Marketing fonts

The original TTF files are the source for the lossless WOFF2 files. The Latin
subsets cover the English marketing copy, Western European accents, punctuation,
and arrows. `src/styles/marketing-fonts.css` declares these after the full faces with `unicode-range`,
so other characters remain available through the full WOFF2 fonts.

Marketing pages preload only the two Latin subsets. Keep preload URLs and the
`@font-face` sources aligned to avoid duplicate downloads.

To regenerate, install `fonttools[woff]` in an isolated Python environment, then
run this from the repository root with that environment's Python:

```python
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

unicodes = (
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,'
    'U+0304,U+0308,U+0329,U+2000-206F,U+2100-22FF,U+25A0-27FF,U+FEFF,U+FFFD'
)
for source in Path('public/fonts').glob('*/*.ttf'):
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(source.with_suffix('.woff2'))
    subset.main([
        str(source), '--unicodes=' + unicodes, '--flavor=woff2',
        '--output-file=' + str(source.with_name(source.stem + '-latin.woff2')),
    ])
```

Keep the Unicode ranges in `src/styles/marketing-fonts.css` aligned with this subset definition.
