# ehm-render

Rendert de video's en carrousels van Ehm Club in GitHub Actions. Dit is een kopie van alleen de rendercode uit de
private repository `808NEMESIS/ehm-club`. Wijzig hier niets: de bron staat daar en wordt met
`scripts/render_repo_sync.sh` hierheen gekopieerd.

- **Wat er gebeurt:** de workflow `render` haalt klaarstaande posts op bij de Edge Function `runner` in Supabase,
  rendert ze met Remotion en zet de bestanden in Storage.
- **Wie mag renderen:** de runner bewijst wie hij is met het OIDC-token van GitHub, dus er staat geen sleutel in deze
  repository of in GitHub. Supabase accepteert alleen tokens van `render.yml` in deze repository
  (`brands.render_repo`).
- **Waar de inhoud vandaan komt:** uit de database, niet uit deze repository.
- **Starten:** Actions > render > Run workflow.

De beelden van Ehm horen bij Ehm Club en vallen niet onder een open licentie. De lettertypen Fredoka en Nunito vallen
onder de SIL Open Font License 1.1. De geluiden zijn eigen synthese (`scripts/geluid.py`).
