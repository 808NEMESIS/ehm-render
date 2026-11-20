# Remotion: Ehm en de templates

Ehm is hier een React-component (`src/ehm/Ehm.tsx`), gelijk aan de rig in `assets/ehm/ehm_rig.py`.
De vorm verandert nooit; alleen ogen, wenkbrauwen, mond, armen en props wisselen en bewegen.

| Compositie | Formaat | Wat |
|---|---|---|
| `EhmVideo` | 1080 x 1920, 15 s | Situatie als hook, "ehm..."-ballon, niet dit (koraal), wel dit (mint), afloop, oproep per platform |
| `Carrousel` | 1080 x 1350, 6 slides | Cover, niet dit, drie keer wel dit, slotslide in nachtblauw |
| `ExpressionSheet` | 1600 x 900 | Controle van alle acht expressies |

Invoer is `PostInput` (`src/data/situatie.ts`). In productie geeft de worker die mee als `--props`
vanuit `posts.content`; de oproep hangt af van `platform` (op TikTok alleen iets gratis).

```bash
npm install
npx remotion studio                                   # bekijken en schuiven
npx remotion render EhmVideo out/video.mp4 --props=post.json
npx remotion render Carrousel out/carrousel --sequence --image-format=png --props=post.json
```

Geluiden staan in `public/sounds` (synthetisch, vrij van rechten). Muziek komt later uit de
bibliotheek met licenties. Zonder browserdownload (bijvoorbeeld in een container) zet je
`REMOTION_BROWSER` op een Chromium headless shell.
