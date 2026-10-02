# Marketing fonts

Marketing headings use **Poppins SemiBold (600)** and body text uses **Poppins
Regular (400)**, self-hosted from the Google
Fonts distribution. The Latin and Latin Extended WOFF2 subsets and upstream SIL
Open Font License are in `poppins/`. Poppins permits commercial website use.
Source: https://github.com/google/fonts/tree/main/ofl/poppins

`BrandHead.astro` preloads Poppins 600 Latin and Poppins 400 Latin. The older
Google Sans Flex and Inter files remain available for design comparison but are not loaded.
Marketing text, including controls and diagrams, uses Poppins. Code examples, inline code on Product code and the copyable agent prompt use the original system monospace stack (SFMono-Regular, Consolas, Liberation Mono, monospace). Customer wordmarks retain their own brand typography.

## Previous Inter assets

The previous Inter setup used the upstream variable font (weights 100–900). Source:
https://github.com/rsms/inter/blob/master/docs/font-files/InterVariable.woff2
The SIL Open Font License is included in `inter/LICENSE.txt`.

To regenerate its Latin subset with `fonttools[woff]`:

```sh
pyftsubset public/fonts/inter/InterVariable.woff2 --flavor=woff2 --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2100-22FF,U+25A0-27FF,U+FEFF,U+FFFD" --output-file=public/fonts/inter/InterVariable-latin.woff2
```

The older Inter Regular and InterVariable files remain as source assets.

## Original static font assets

The original TTF files are the source for the lossless WOFF2 files. The Latin
subsets cover the English marketing copy, Western European accents, punctuation,
and arrows. They are preserved as source assets for the previous typography.

Marketing pages preload only their active heading and body Latin subsets. Keep preload URLs and the
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

When reactivating an older font, align its CSS Unicode ranges with the generated subsets.
