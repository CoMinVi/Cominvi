# MIS-300 : Section next -> layout

## 📋 Résumé du problème

La section "next" sur la page **Technology** utilise un layout différent de celui de la home et des autres pages. Cette incohérence doit être corrigée dans Webflow pour uniformiser toutes les sections "next" du site.

## 🔍 Analyse effectuée

### Pages analysées
- ✅ index.html (Home) - **Conforme**
- ✅ our-services.html - **Conforme**
- ❌ technology.html - **12 erreurs détectées**
- ✅ join-the-team.html - **Conforme**
- ✅ about-us.html - **Conforme**

### Différences identifiées sur technology.html

#### Structure HTML différente
- **Bouton** : Utilise `class="button"` au lieu de `class="button-white"`
- **Attributs** : Présence d'attributs non standard (`data-wf--button--variant`)
- **Classes CSS** : Structure de classes différente (`button_inner` vs `button-white_inner`)
- **SVG** : Dimensions incorrectes (32x32 au lieu de 34x34)
- **Contenu** : Manque le paragraphe `<p class="body-next">Next page</p>`
- **Labels** : Texte "Next Page" au lieu de "Link" dans l'eyebrow

#### Impact visuel et fonctionnel
- Layout visuellement différent
- Possibles problèmes d'animations (attribut `data-w-id` manquant)
- Incohérence de l'expérience utilisateur entre les pages

## 🛠️ Solution proposée

### Fichiers livrés

1. **`validate-next-section.js`**
   - Script de validation automatique
   - Vérifie la conformité de toutes les sections "next"
   - Affiche un rapport détaillé des erreurs et avertissements

2. **`WEBFLOW_NEXT_SECTION_FIX.md`**
   - Documentation technique détaillée
   - Comparaison structure attendue vs structure actuelle
   - Liste exhaustive des modifications nécessaires

3. **`INSTRUCTIONS_WEBFLOW.md`**
   - Guide pas-à-pas pour corriger dans Webflow Designer
   - Deux approches : copier-coller (rapide) ou modification manuelle
   - Procédure de validation post-correction

### Procédure de correction

#### Option 1 : Copier-coller (recommandé - 5 minutes)
1. Ouvrir la page Technology dans Webflow Designer
2. Copier le contenu de `.next-button-wrapper` depuis la page Home
3. Coller dans la page Technology
4. Ajuster le texte du lien et les URLs
5. Ajouter `<p class="body-next">Next page</p>`
6. Corriger l'eyebrow : "Next Page" → "Link"
7. Publier et valider

#### Option 2 : Modification manuelle (30-45 minutes)
Suivre les instructions détaillées dans `INSTRUCTIONS_WEBFLOW.md`

## ✅ Validation

### Commande de vérification
```bash
node validate-next-section.js
```

### Résultat actuel
```
Pages validées: 5
Erreurs totales: 12 (toutes sur technology.html)
Avertissements totaux: 2
```

### Résultat attendu après correction
```
Pages validées: 5
Erreurs totales: 0
Avertissements totaux: 0
✅ Toutes les sections "next" sont conformes !
```

## 📝 Notes techniques

### Structure cible (référence Home)
```html
<div class="section_next">
  <div class="intro_next">
    <div class="eyebrows is-white">
      <div class="is-eyebrow"><span class="eyebrow-s">S.XX</span></div>
      <div class="is-eyebrow"><span class="eyebrow-s">Link</span></div>
    </div>
    <p tr="1" class="body-next">Next page</p>
  </div>
  <div class="next-button-wrapper">
    <a class="button-white w-inline-block" data-w-id="...">
      <div class="button-white_inner">
        <div class="button-white_inner-content">
          <svg viewbox="0 0 34 34"><!-- SVG 34x34 --></svg>
          <span class="button-white_label">Page Name</span>
          <svg viewbox="0 0 34 34"><!-- SVG 34x34 --></svg>
        </div>
      </div>
    </a>
  </div>
  <div class="next_background-wrap">
    <div class="next_background">
      <img class="background" src="..." />
    </div>
  </div>
</div>
```

## 🚀 Prochaines étapes

1. [ ] Ouvrir Webflow Designer sur le site Cominvi
2. [ ] Appliquer les corrections sur la page Technology
3. [ ] Publier le site
4. [ ] Exporter le HTML mis à jour
5. [ ] Remplacer `technology.html` dans le dépôt
6. [ ] Exécuter `node validate-next-section.js`
7. [ ] Vérifier que toutes les validations passent ✅
8. [ ] Commiter et fermer l'issue MIS-300

## 🔗 Ressources

- Documentation technique : `WEBFLOW_NEXT_SECTION_FIX.md`
- Instructions de correction : `INSTRUCTIONS_WEBFLOW.md`
- Script de validation : `validate-next-section.js`
- Issue Linear : MIS-300

---

**Statut** : Analyse complète ✅ | En attente de correction dans Webflow ⏳
