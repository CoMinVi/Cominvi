# Fallback Netlify pour Minerals

## Objectif

Utiliser la séquence `.af` quand WebCodecs est disponible et les 600 images AVIF locales servies par Netlify quand WebCodecs est indisponible.

## Architecture

- `.minerals-stage` reste l'unique élément `fc-image-scrubbing="component"` et le déclencheur de scroll.
- `.minerals_content` contient un seul `.minerals-slider_sequence` et un seul canvas.
- Le fallback n'utilise plus l'attribut Webflow de 600 URLs.
- Les images sources restent dans `public/minerals/`; Vite les copie dans `dist/minerals/`.

## Nommage des frames

Les URLs Netlify suivent le nommage réel des fichiers :

- frame 1 : `https://cominvi.netlify.app/minerals/minerals-0001.avif`
- frame 10 : `https://cominvi.netlify.app/minerals/minerals-00010.avif`
- frame 100 : `https://cominvi.netlify.app/minerals/minerals-000100.avif`
- frame 600 : `https://cominvi.netlify.app/minerals/minerals-000600.avif`

Le format commun est `minerals-000${frame}.avif`.

## Validation

- Test automatisé des frames 1, 10, 100 et 600.
- Vérification des 600 fichiers dans `public/minerals/`.
- Lint et build Vite.
