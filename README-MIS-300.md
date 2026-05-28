# MIS-300 : Résolution du problème de layout de la section "next"

## 🎯 Objectif

Uniformiser le layout de la section "next" sur toutes les pages du site. Actuellement, la page **Technology** a un layout différent des autres pages (Home, Our Services, Join the Team, About Us).

## 📦 Fichiers fournis

| Fichier | Description |
|---------|-------------|
| `validate-next-section.js` | Script de validation automatique qui détecte les incohérences |
| `MIS-300-RESOLUTION.md` | Vue d'ensemble complète du problème et de la solution |
| `WEBFLOW_NEXT_SECTION_FIX.md` | Documentation technique détaillée avec comparaison des structures |
| `INSTRUCTIONS_WEBFLOW.md` | Guide pas-à-pas pour corriger dans Webflow Designer |

## 🚀 Démarrage rapide

### 1. Vérifier le problème

```bash
node validate-next-section.js
```

**Résultat actuel :**
```
📄 Validation de technology.html...
Erreurs: 12 erreurs détectées
❌ Des corrections sont nécessaires.
```

### 2. Corriger dans Webflow

Suivre les instructions dans **`INSTRUCTIONS_WEBFLOW.md`**

**Méthode rapide (5 minutes) :**
1. Ouvrir Webflow Designer
2. Copier la section `.next-button-wrapper` de la page Home
3. Coller dans la page Technology
4. Ajuster le texte et les URLs
5. Ajouter `<p class="body-next">Next page</p>`
6. Corriger l'eyebrow : "Next Page" → "Link"
7. Publier

### 3. Valider la correction

```bash
# Après avoir exporté et remplacé technology.html
node validate-next-section.js
```

**Résultat attendu :**
```
✅ Validation réussie !
Pages validées: 5
Erreurs totales: 0
✅ Toutes les sections "next" sont conformes !
```

## 📖 Documentation détaillée

### Pour les développeurs

- **`MIS-300-RESOLUTION.md`** : Lisez ce fichier en premier pour comprendre le problème
- **`validate-next-section.js`** : Script de validation à utiliser avant/après les corrections

### Pour les designers Webflow

- **`INSTRUCTIONS_WEBFLOW.md`** : Instructions pas-à-pas pour corriger dans le Designer
- **`WEBFLOW_NEXT_SECTION_FIX.md`** : Référence technique des modifications nécessaires

## 🔍 Détails du problème

La page **technology.html** présente 12 erreurs de structure :

1. ❌ `<p class="body-next">` manquant
2. ❌ Eyebrow "Next Page" au lieu de "Link"
3. ❌ Classe `button` au lieu de `button-white`
4. ❌ Attribut `data-wf--button--variant` superflu
5. ❌ Classes internes incorrectes
6. ❌ Structure HTML différente
7. ❌ Dimensions SVG incorrectes (32x32 au lieu de 34x34)

## ✅ Checklist de résolution

- [x] Analyser le problème
- [x] Créer le script de validation
- [x] Documenter les corrections nécessaires
- [x] Créer les instructions pour Webflow
- [ ] Appliquer les corrections dans Webflow Designer
- [ ] Publier le site Webflow
- [ ] Exporter le HTML mis à jour
- [ ] Remplacer `technology.html` dans le dépôt
- [ ] Valider avec `node validate-next-section.js`
- [ ] Merger la PR
- [ ] Fermer l'issue MIS-300

## 🔗 Liens

- **PR GitHub** : https://github.com/jb-holographik/Cominvi/pull/4
- **Issue Linear** : MIS-300
- **Label** : Today

## 💡 Aide

Si vous avez des questions :

1. Consultez d'abord `MIS-300-RESOLUTION.md` pour la vue d'ensemble
2. Référez-vous à `INSTRUCTIONS_WEBFLOW.md` pour les étapes détaillées
3. Utilisez `WEBFLOW_NEXT_SECTION_FIX.md` pour les détails techniques

Le script `validate-next-section.js` peut être exécuté à tout moment pour vérifier l'état actuel.
