# Cominvi Frontend (Webflow + Vite)

Ce dépôt contient le JavaScript/CSS custom chargé sur le site Webflow.

## Commandes (Yarn uniquement)

```sh
yarn
yarn dev
yarn build
yarn clean
yarn lint:fix
```

## Fonctionnement global

- Webflow reste la source de vérité pour le HTML/CSS structurel.
- Ce projet produit un bundle JS/CSS Vite chargé dans Webflow.
- Le build utilise du code-splitting : `main.js` + chunks dynamiques (ex: `deferred-inits`).
- Les initialisations non critiques sont déportées en différé pour améliorer la priorité du hero (notamment home).

## Intégration Webflow (important)

Charger le script de production en **module** :

```html
<script type="module" src="https://precious-hotteok-8da21f.netlify.app/main.js"></script>
```

Ne pas conserver un second chargement `main.js` sans `type="module"` (sinon conflits/404 sur les chunks).

## Netlify, CORS et chunks

- Le fichier `public/_headers` ajoute les headers CORS nécessaires pour le chargement cross-origin depuis Webflow.
- Le build Vite est configuré avec une base d’assets de production (`base`) pointant vers Netlify, afin que les chunks/CSS dynamiques soient résolus sur le bon domaine.

## Changement de domaine Netlify

Si l’URL Netlify change, mettre à jour la variable d’environnement :

```sh
VITE_ASSET_BASE=https://votre-nouveau-domaine.netlify.app/
```

Puis rebuilder/redéployer.

Par défaut, le projet est configuré pour :

`https://precious-hotteok-8da21f.netlify.app/`

## Notes build

- Des warnings CSS peuvent apparaître (Swiper/minification) sans bloquer le build.
- Le build est valide si la commande se termine avec `Done` et un code de sortie `0`.
