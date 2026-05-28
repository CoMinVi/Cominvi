# Instructions pour corriger la section "next" dans Webflow

## État actuel

✅ **Pages conformes** : index.html, our-services.html, join-the-team.html, about-us.html
❌ **Page à corriger** : technology.html

## Erreurs identifiées sur technology.html

Le script de validation a détecté 12 erreurs sur la page Technology :

1. ❌ `<p class="body-next">` manquant dans intro_next
2. ❌ Deuxième eyebrow devrait être "Link" mais est "Next Page"
3. ❌ Bouton devrait avoir la classe "button-white"
4. ❌ Attribut `data-wf--button--variant` ne devrait pas être présent
5. ❌ Classe "button-white_inner" manquante
6. ❌ Classe "button-white_inner-content" manquante
7. ❌ Classe "button-white_label" manquante
8. ❌ div.label-wrap ne devrait pas être présent
9. ❌ SVG 1: viewBox devrait être "0 0 34 34" mais est "0 0 32 32"
10. ❌ SVG 2: viewBox devrait être "0 0 34 34" mais est "0 0 32 32"
11. ❌ SVG rect 1: devrait être 34x34 mais est 32x32
12. ❌ SVG rect 2: devrait être 34x34 mais est 32x32

### Avertissements

- ⚠️ Attribut data-w-id manquant (peut affecter les animations)
- ⚠️ Élément .sr-only présent (devrait être supprimé pour uniformité)

---

## Instructions de correction dans Webflow Designer

### Étape 1 : Ouvrir la page Technology dans le Designer

1. Se connecter à Webflow
2. Ouvrir le site Cominvi
3. Naviguer vers la page "Technology"
4. Localiser la section avec la classe `section_next` en bas de page

### Étape 2 : Corriger la section intro_next

**Action :** Ajouter le paragraphe manquant

1. Sélectionner le div `.intro_next`
2. Après les eyebrows, ajouter un nouveau paragraphe `<p>`
3. Lui assigner la classe `body-next`
4. Ajouter l'attribut personnalisé `tr="1"`
5. Mettre le texte : "Next page"

**Action :** Corriger le deuxième eyebrow

1. Localiser le deuxième `.is-eyebrow > .eyebrow-s`
2. Changer le texte de "Next Page" à "Link"

### Étape 3 : Remplacer le bouton

**Option A : Copier-coller depuis une autre page**

1. Ouvrir la page "Our Services" (ou Home, About Us, Join the Team)
2. Dans la section `.section_next`, sélectionner tout le contenu du div `.next-button-wrapper`
3. Copier (Cmd/Ctrl + C)
4. Revenir à la page Technology
5. Sélectionner le contenu du div `.next-button-wrapper`
6. Supprimer l'ancien bouton
7. Coller le nouveau (Cmd/Ctrl + V)
8. Mettre à jour :
   - Le texte du label : "Safety" (ou la page suivante appropriée)
   - L'URL du lien : "safety.html"
   - L'URL du prefetch : "/safety"

**Option B : Modification manuelle (plus long)**

1. Sélectionner le lien `<a>` dans `.next-button-wrapper`
2. Modifier les classes :
   - Supprimer la classe `button`
   - Supprimer la variante `w-variant-a211fbf9-8f10-d13e-69e9-810a5e3873c2`
   - Ajouter la classe `button-white`
3. Ajouter l'attribut personnalisé : `data-w-id="687c3d2f-385d-93aa-43fe-a460e90d552d"`
4. Supprimer l'attribut : `data-wf--button--variant`
5. Modifier le div enfant :
   - Changer la classe de `button_inner` à `button-white_inner`
6. Modifier le div suivant :
   - Changer la classe de `button-inner_content` à `button-white_inner-content`
7. Supprimer le div `.label-wrap`
8. Mettre le span directement dans le div content
9. Modifier le span :
   - Changer la classe de `button_label-small` à `button-white_label`
   - Supprimer la variante
10. Supprimer l'élément `<span class="sr-only">`
11. Pour chaque SVG (il y en a 2) :
    - Changer le viewBox de "0 0 32 32" à "0 0 34 34"
    - Sur le `<rect>` : changer width="32" à width="34" et height="32" à height="34"
    - Mettre à jour le path avec les nouvelles coordonnées :
      ```
      d="M14.0295 9.26572C14.0295 8.67179 14.7476 8.37434 15.1676 8.79432L22.8718 16.4986C23.1322 16.7589 23.1322 17.181 22.8718 17.4414L15.1676 25.1456C14.7476 25.5656 14.0295 25.2681 14.0295 24.6742V9.26572Z"
      ```

### Étape 4 : Vérifier la section background

1. S'assurer que le div `.next_background-wrap` existe après `.next-button-wrapper`
2. Vérifier qu'il contient :
   - Un div `.next_background`
   - Une image avec la classe `background`
   - L'image devrait pointer vers l'image de la page suivante (ex: safety-hero.avif)

### Étape 5 : Publier et valider

1. Sauvegarder les modifications
2. Publier le site
3. Exporter le HTML mis à jour
4. Remplacer `technology.html` dans le projet
5. Exécuter le script de validation :
   ```bash
   node validate-next-section.js
   ```
6. Vérifier que toutes les pages passent la validation ✅

---

## Approche recommandée

**🎯 La méthode la plus simple et la plus sûre :**

1. Copier la section `.next-button-wrapper` complète depuis la page Home
2. Coller dans la page Technology
3. Ajuster uniquement le texte du lien et les URLs
4. Ajouter le paragraphe `<p class="body-next">Next page</p>`
5. Corriger l'eyebrow "Next Page" → "Link"

Cela garantit que toutes les classes, attributs, et dimensions SVG sont identiques.

---

## Validation finale

Après les corrections, le script devrait afficher :

```
📄 Validation de technology.html...
✅ Validation réussie !

📊 Résumé:
   Pages validées: 5
   Erreurs totales: 0
   Avertissements totaux: 0

✅ Toutes les sections "next" sont conformes !
```
