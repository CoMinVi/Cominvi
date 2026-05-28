# Script de validation de la section "next"

## Description

Ce script valide que toutes les sections "next" du site ont une structure HTML cohérente et conforme au design system.

## Usage

```bash
node validate-next-section.js
```

## Ce que le script vérifie

### Structure HTML
- Présence de tous les éléments requis
- Classes CSS correctes
- Attributs nécessaires (data-w-id, etc.)

### Contenu
- Texte des eyebrows (doit être "Link")
- Présence du paragraphe "Next page"
- Structure du bouton (button-white)

### Dimensions SVG
- ViewBox correct (0 0 34 34)
- Dimensions rect (34x34)
- Path des icônes

### Assets
- Image de background
- Lien de prefetch

## Sortie

Le script affiche :
- ✅ Pour les pages conformes
- ❌ Pour les erreurs bloquantes
- ⚠️  Pour les avertissements

Exemple de sortie :

```
📄 Validation de index.html...
✅ Validation réussie !

📄 Validation de technology.html...
Erreurs:
  ❌ Bouton devrait avoir la classe "button-white"
  ❌ SVG 1: viewBox devrait être "0 0 34 34" mais est "0 0 32 32"
```

## Code de sortie

- `0` : Toutes les validations ont réussi
- `1` : Au moins une erreur a été détectée

Utilisable dans les CI/CD :

```bash
node validate-next-section.js && echo "Validation OK" || echo "Corrections nécessaires"
```

## Dépendances

Le script utilise uniquement les modules Node.js natifs :
- `fs` : lecture des fichiers HTML
- `path` : gestion des chemins de fichiers

Aucune dépendance externe n'est requise.

## Pages validées

- index.html
- our-services.html
- technology.html
- join-the-team.html
- about-us.html

## Personnalisation

Pour ajouter une page à valider, éditez le tableau `PAGES` dans le script :

```javascript
const PAGES = [
  'index.html',
  'our-services.html',
  'technology.html',
  'join-the-team.html',
  'about-us.html',
  'nouvelle-page.html'  // Ajouter ici
];
```

## Maintenance

Le script utilise des regex pour analyser le HTML. Si la structure change significativement, il faudra adapter :

1. Le tableau `EXPECTED_STRUCTURE` pour les valeurs attendues
2. Les regex dans `validateNextSection()` pour l'extraction
3. Les messages d'erreur si nécessaire

## Intégration CI/CD

Exemple pour GitHub Actions :

```yaml
- name: Valider sections next
  run: node validate-next-section.js
```

Exemple pour package.json :

```json
{
  "scripts": {
    "validate:next": "node validate-next-section.js"
  }
}
```

## Améliorations futures possibles

- [ ] Support de jsdom pour un parsing HTML plus robuste
- [ ] Export JSON des résultats
- [ ] Mode verbose avec plus de détails
- [ ] Validation des chemins d'images
- [ ] Vérification de la cohérence des URLs
- [ ] Tests unitaires du script lui-même
